import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Groq from "groq-sdk";
import { z } from "zod";

import { type PromptResult } from "@/lib/text-processing";

// ============================================================================
// Configuration
// ============================================================================

const model = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
const maxBatchSize = Number.isFinite(Number(process.env.GROQ_BATCH_SIZE))
  ? Number(process.env.GROQ_BATCH_SIZE)
  : 8;

// OpenRouter: Use :free model by default to avoid credit issues
const openRouterModel = process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";
const openRouterBaseUrl = "https://openrouter.ai/api/v1/chat/completions";
const openRouterSiteUrl = process.env.OPENROUTER_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
const openRouterAppName = process.env.OPENROUTER_APP_NAME ?? "Scripting Tool";

// Google AI Studio: Completely free, no credit card required, 1M context
const googleApiKey = process.env.GOOGLE_API_KEY ?? "";
const googleModel = process.env.GOOGLE_MODEL ?? "gemini-2.0-flash";
const googleBaseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

// Ollama: Local models, completely free, no limits
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.2";

const maxFragmentsPerRequest = Number.isFinite(Number(process.env.MAX_PROMPT_FRAGMENTS_PER_REQUEST))
  ? Number(process.env.MAX_PROMPT_FRAGMENTS_PER_REQUEST)
  : 1000;
const maxFragmentTextLength = Number.isFinite(Number(process.env.MAX_PROMPT_FRAGMENT_TEXT_LENGTH))
  ? Number(process.env.MAX_PROMPT_FRAGMENT_TEXT_LENGTH)
  : 4000;
const maxTotalFragmentChars = Number.isFinite(Number(process.env.MAX_PROMPT_TOTAL_FRAGMENT_CHARS))
  ? Number(process.env.MAX_PROMPT_TOTAL_FRAGMENT_CHARS)
  : 500000;

// ============================================================================
// Zod Schemas
// ============================================================================

const fragmentSchema = z.object({
  id: z.number().int().positive(),
  text: z.string().min(1).max(maxFragmentTextLength),
});

const requestSchema = z
  .object({
    fragments: z.array(fragmentSchema).min(1).max(maxFragmentsPerRequest),
    style: z.string().max(500).optional().default("Cinematic photography, high quality, detailed"),
  })
  .superRefine(({ fragments }, ctx) => {
    // Validate unique fragment IDs
    const ids = fragments.map((f) => f.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fragments"],
        message: "Los fragmentos deben tener IDs únicos",
      });
    }

    const totalFragmentChars = fragments.reduce(
      (sum, fragment) => sum + fragment.text.length,
      0,
    );
    if (totalFragmentChars > maxTotalFragmentChars) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fragments"],
        message: `El texto total de los fragmentos no puede exceder ${maxTotalFragmentChars} caracteres`,
      });
    }
  });

const responseItemSchema = z.object({
  fragment_id: z.number().int().positive(),
  original_text: z.string().min(1),
  image_prompt: z.string().min(1),
});

type PromptFragment = {
  id: number;
  text: string;
};

// ============================================================================
// Groq Client Singleton
// ============================================================================

const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Sanitizes the style string to prevent prompt injection.
 * Strips control characters, newlines, and XML-like tags.
 */
function sanitizeStyle(style: string): string {
  return style
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/<\/?[a-z][^>]*>/gi, "") // Remove XML-like tags
    .trim()
    .slice(0, 500); // Enforce max length
}

/**
 * Builds the system prompt for image generation with XML-delimited style.
 */
function buildSystemPrompt(style: string): string {
  const sanitized = sanitizeStyle(style);
  return [
    "You are an expert prompt engineer for AI image generation models.",
    `The selected image style is defined between <style> tags:`,
    `<style>${sanitized}</style>`,
    "For each input fragment, generate one image prompt in English only.",
    "Prompts must be highly descriptive, cinematic, visual, specific in scene composition, lighting, mood, camera, and materials.",
    "Keep the meaning of the original text, but optimize for visual generation.",
    "Return ONLY valid raw JSON array and nothing else.",
    "Do not include markdown code fences.",
    'Every object must use exactly these keys: "fragment_id", "original_text", "image_prompt". Never use "image_prompt:" or aliases.',
    "Even when there is only one input fragment, return an array with one object.",
    'Expected format: [{"fragment_id":1,"original_text":"...","image_prompt":"..."}]',
    'IMPORTANT: The "fragment_id" in your output JSON MUST exactly match the "id" provided in each input fragment. Do not change, reorder, or invent IDs.',
  ].join(" ");
}

function extractFirstJsonArray(input: string): string {
  const start = input.indexOf("[");
  const end = input.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON array found in model output");
  }
  return input.slice(start, end + 1);
}

function extractFirstJsonObject(input: string): string {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model output");
  }
  return input.slice(start, end + 1);
}

/**
 * Attempts to repair common JSON issues from LLM output:
 * - Strips markdown code blocks (```json ... ```)
 * - Removes trailing commas before } or ]
 * - Attempts to close truncated strings and arrays
 */
function repairJson(input: string): string {
  let fixed = input.trim();

  // Strip markdown code blocks if present
  fixed = fixed.replace(/^```(?:json)?\s*\n?/i, "").replace(/```\s*$/, "");

  // Remove trailing commas before } or ]
  fixed = fixed.replace(/,\s*([}\]])/g, "$1");

  // Count open vs closed brackets and try to close truncated structures
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;

  // Close truncated strings first
  let inString = false;
  let escaped = false;
  for (let i = 0; i < fixed.length; i++) {
    const char = fixed[i];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; }
  }
  if (inString) fixed += '"';

  // Close unclosed braces and brackets
  if (openBraces > closeBraces) fixed += "}".repeat(openBraces - closeBraces);
  if (openBrackets > closeBrackets) fixed += "]".repeat(openBrackets - closeBrackets);

  return fixed.trim();
}

function normalizeObjectKeys(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [
      key.trim().replace(/:+$/g, "").replace(/\s+/g, "_").toLowerCase(),
      fieldValue,
    ]),
  );
}

function firstDefined(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }
  return undefined;
}

function toPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isLowQualityImagePrompt(value: string): boolean {
  const trimmed = value.trim();
  const withoutJsonPunctuation = trimmed.replace(/[\s{}\[\]"',.:;]+/g, "");

  return (
    trimmed.length < 24 ||
    withoutJsonPunctuation.length < 12 ||
    !/[a-zA-Z]/.test(trimmed) ||
    /^[\s{}\[\]"',.:;\\/-]+$/.test(trimmed)
  );
}

function unwrapModelPayload(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (typeof parsed === "object" && parsed !== null) {
    const normalized = normalizeObjectKeys(parsed as Record<string, unknown>);
    for (const key of ["results", "prompts", "items", "data", "response"]) {
      const value = normalized[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  return [parsed];
}

function normalizePromptResult(
  item: unknown,
  expectedFragments: PromptFragment[],
): PromptResult {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    throw new Error("Model item is not a JSON object");
  }

  const expectedById = new Map(expectedFragments.map((fragment) => [fragment.id, fragment]));
  const singleExpected = expectedFragments.length === 1 ? expectedFragments[0] : null;
  const normalized = normalizeObjectKeys(item as Record<string, unknown>);

  const fragmentId =
    toPositiveInt(firstDefined(normalized, ["fragment_id", "fragmentid", "id", "fragment", "fragment_index", "fragmentindex", "index"])) ??
    singleExpected?.id;
  const expectedFragment = fragmentId ? expectedById.get(fragmentId) : singleExpected;

  const originalText = expectedFragment?.text ??
    toNonEmptyString(firstDefined(normalized, ["original_text", "originaltext", "text", "source_text", "sourcetext", "input_text", "inputtext"]));
  const imagePrompt = toNonEmptyString(
    firstDefined(normalized, ["image_prompt", "imageprompt", "prompt", "visual_prompt", "visualprompt", "image", "description"]),
  );

  if (imagePrompt && isLowQualityImagePrompt(imagePrompt)) {
    throw new Error(`image_prompt inválido para fragment_id ${fragmentId ?? "desconocido"}: ${JSON.stringify(imagePrompt)}`);
  }

  return responseItemSchema.parse({
    fragment_id: fragmentId,
    original_text: originalText,
    image_prompt: imagePrompt,
  });
}

function parseModelJson(rawText: string, expectedFragments: PromptFragment[] = []): PromptResult[] {
  const trimmed = rawText.trim();

  // Try multiple extraction strategies
  const candidates = new Set<string>();

  // Strategy 1: Extract first JSON array
  try {
    const extracted = extractFirstJsonArray(trimmed);
    candidates.add(extracted);
  } catch {
    // Ignore
  }

  // Strategy 2: Extract first JSON object
  try {
    const extracted = extractFirstJsonObject(trimmed);
    candidates.add(extracted);
  } catch {
    // Ignore
  }

  // Strategy 3: Try the whole trimmed text
  candidates.add(trimmed);

  // Strategy 4: Try to find JSON array with regex (handles extra text)
  // Using [\s\S] to match any character including newlines (no /s flag needed)
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    candidates.add(arrayMatch[0]);
  }

  // Try parsing each candidate, with repair fallback
  const errors: string[] = [];
  for (const candidate of candidates) {
    // Try direct parse
    try {
      const parsed = JSON.parse(candidate) as unknown;
      return unwrapModelPayload(parsed).map((item) => normalizePromptResult(item, expectedFragments));
    } catch {
      // Try repaired version
      try {
        const repaired = repairJson(candidate);
        const parsed = JSON.parse(repaired) as unknown;
        return unwrapModelPayload(parsed).map((item) => normalizePromptResult(item, expectedFragments));
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }

  // All strategies failed - log for debugging
  console.error("[prompt-generation] JSON parse failed. Raw output (first 1000 chars):", trimmed.slice(0, 1000));
  console.error("[prompt-generation] Parse errors:", errors);
  throw new Error("El modelo devolvió un formato JSON inválido. Intenta con un fragmento más corto o inténtalo de nuevo.");
}

function chunkFragments<T>(items: T[], size: number): T[][] {
  const normalizedSize = Number.isFinite(size) ? Math.max(1, Math.floor(size)) : 8;
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += normalizedSize) {
    chunks.push(items.slice(index, index + normalizedSize));
  }

  return chunks;
}

function getErrorStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  if ("status" in error && typeof (error as { status?: unknown }).status === "number") {
    return (error as { status: number }).status;
  }

  return null;
}

function shouldFallbackToOpenRouter(error: unknown): boolean {
  const statusCode = getErrorStatusCode(error);
  if (statusCode === 429 || statusCode === 503) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("rate") ||
    message.includes("quota") ||
    message.includes("too many requests") ||
    message.includes("context") ||
    message.includes("token")
  );
}

/**
 * Safely extracts an error message from an unknown payload.
 */
function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const err = payload.error;
    if (typeof err === "object" && err !== null && "message" in err) {
      return String(err.message);
    }
  }
  return fallback;
}

/**
 * Safely extracts the content from an OpenRouter response payload.
 */
function extractOpenRouterContent(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "choices" in payload) {
    const choices = (payload as { choices?: unknown[] }).choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const first = choices[0] as { message?: { content?: string } };
      return first?.message?.content ?? "";
    }
  }
  return "";
}

// ============================================================================
// LLM Request Functions
// ============================================================================

async function requestGroqBatch(
  groq: Groq,
  systemPrompt: string,
  batch: PromptFragment[]
): Promise<PromptResult[]> {
  const completion = await groq.chat.completions.create({
    model,
    temperature: 0.5,
    max_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(batch) },
    ],
  });

  const rawOutput = completion.choices[0]?.message?.content ?? "";
  return parseModelJson(rawOutput, batch);
}

async function requestOpenRouterBatch(
  systemPrompt: string,
  batch: PromptFragment[]
): Promise<PromptResult[]> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  const response = await fetch(openRouterBaseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": openRouterSiteUrl,
      "X-Title": openRouterAppName,
    },
    body: JSON.stringify({
      model: openRouterModel,
      temperature: 0.5,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(batch) },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    console.error("[prompt-generation] OpenRouter error response:", JSON.stringify(payload).slice(0, 500));
    throw new Error(extractErrorMessage(payload, "OpenRouter request failed"));
  }

  const rawOutput = extractOpenRouterContent(payload);
  if (!rawOutput) {
    console.error("[prompt-generation] OpenRouter returned empty content. Payload:", JSON.stringify(payload).slice(0, 500));
    throw new Error("OpenRouter devolvió una respuesta vacía");
  }
  return parseModelJson(rawOutput, batch);
}

async function requestGoogleBatch(
  systemPrompt: string,
  batch: PromptFragment[]
): Promise<PromptResult[]> {
  if (!googleApiKey) {
    throw new Error("GOOGLE_API_KEY is missing");
  }

  const url = `${googleBaseUrl}/${googleModel}:generateContent?key=${googleApiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `${systemPrompt}\n\n${JSON.stringify(batch)}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 4096,
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    console.error("[prompt-generation] Google AI error response:", JSON.stringify(payload).slice(0, 500));
    throw new Error(extractErrorMessage(payload, "Google AI request failed"));
  }

  // Extract text from Google AI response
  const text = extractGoogleContent(payload);
  if (!text) {
    console.error("[prompt-generation] Google AI returned empty content. Payload:", JSON.stringify(payload).slice(0, 500));
    throw new Error("Google AI devolvió una respuesta vacía");
  }
  return parseModelJson(text, batch);
}

function extractGoogleContent(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "candidates" in payload) {
    const candidates = (payload as { candidates?: unknown[] }).candidates;
    if (Array.isArray(candidates) && candidates.length > 0) {
      const first = candidates[0] as { content?: { parts?: { text?: string }[] } };
      return first?.content?.parts?.[0]?.text ?? "";
    }
  }
  return "";
}

async function requestOllamaBatch(
  systemPrompt: string,
  batch: PromptFragment[]
): Promise<PromptResult[]> {
  // Ollama tends to be more reliable with one fragment per request.
  if (batch.length > 1) {
    const results: PromptResult[] = [];
    for (const fragment of batch) {
      const single = await requestOllamaBatch(systemPrompt, [fragment]);
      results.push(...single);
    }
    return results;
  }

  const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ollamaModel,
      format: "json",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(batch) },
      ],
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 4096,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("[prompt-generation] Ollama error response:", errorText.slice(0, 500));
    throw new Error(`Ollama request failed: ${errorText}`);
  }

  const payload = (await response.json()) as unknown;
  const rawOutput = extractOllamaContent(payload);
  if (!rawOutput) {
    console.error("[prompt-generation] Ollama returned empty content. Payload:", JSON.stringify(payload).slice(0, 500));
    throw new Error("Ollama devolvió una respuesta vacía");
  }
  return parseModelJson(rawOutput, batch);
}

function extractOllamaContent(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const msg = (payload as { message?: { content?: string } }).message;
    return msg?.content ?? "";
  }
  return "";
}

function summarizeProviderError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getRetryDelayMs(error: unknown, retryCount: number): number | null {
  const message = summarizeProviderError(error).toLowerCase();
  if (message.includes("quota exceeded") || message.includes("limit: 0")) {
    return null;
  }

  const retryMatch = message.match(/retry in ([\d.]+)s/);
  if (retryMatch) {
    return Math.min(parseFloat(retryMatch[1]) * 1000, 30000);
  }

  if (message.includes("rate") || message.includes("too many requests") || message.includes("429")) {
    return Math.min(1000 * Math.pow(2, retryCount), 15000);
  }

  return null;
}

function selectFragmentResult(provider: string, fragment: PromptFragment, results: PromptResult[]): PromptResult {
  const matches = results.filter((result) => result.fragment_id === fragment.id);
  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    throw new Error(`${provider} devolvió fragment_id ${fragment.id} ${matches.length} veces`);
  }

  throw new Error(`${provider} no devolvió fragment_id ${fragment.id}`);
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: Request): Promise<Response> {
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const hasOllama = Boolean(process.env.OLLAMA_BASE_URL || ollamaBaseUrl);

  // Auth check
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const hasGoogle = !!googleApiKey;
  if (!hasGroq && !hasOpenRouter && !hasGoogle && !hasOllama) {
    console.error("[prompt-generation] No LLM provider configured");
    return NextResponse.json(
      { error: "Error del servidor: configuración incompleta. Se requiere GROQ_API_KEY, OPENROUTER_API_KEY, GOOGLE_API_KEY, u OLLAMA_BASE_URL" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsedBody = requestSchema.safeParse(body);

  if (!parsedBody.success) {
    console.warn("[prompt-generation] Invalid request payload:", JSON.stringify(parsedBody.error.flatten(), null, 2));
    return NextResponse.json(
      { error: "Solicitud inválida", details: parsedBody.error.flatten() },
      { status: 400 }
    );
  }

  // Use singleton client or create one if needed
  const groq = groqClient ?? (hasGroq ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null);
  const systemPrompt = buildSystemPrompt(parsedBody.data.style);

  async function requestFragmentWithFallback(fragment: PromptFragment): Promise<PromptResult> {
    const batch = [fragment];
    const providerErrors: string[] = [];

    if (hasOllama) {
      try {
        const results = await requestOllamaBatch(systemPrompt, batch);
        return selectFragmentResult("Ollama", fragment, results);
      } catch (ollamaError) {
        console.warn("[prompt-generation] Ollama failed:", ollamaError);
        providerErrors.push(`Ollama: ${summarizeProviderError(ollamaError)}`);
      }
    }

    if (groq) {
      try {
        const results = await requestGroqBatch(groq, systemPrompt, batch);
        return selectFragmentResult("Groq", fragment, results);
      } catch (groqError) {
        console.warn("[prompt-generation] Groq failed:", groqError);
        providerErrors.push(`Groq: ${summarizeProviderError(groqError)}`);
      }
    }

    if (hasGoogle) {
      for (let retryCount = 0; retryCount <= 2; retryCount++) {
        try {
          const results = await requestGoogleBatch(systemPrompt, batch);
          return selectFragmentResult("Google AI", fragment, results);
        } catch (googleError) {
          const retryDelayMs = getRetryDelayMs(googleError, retryCount);
          if (retryDelayMs !== null && retryCount < 2) {
            console.warn(`[prompt-generation] Google AI rate limited, retrying in ${retryDelayMs}ms (attempt ${retryCount + 1})`);
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            continue;
          }

          console.warn("[prompt-generation] Google AI failed:", googleError);
          providerErrors.push(`Google AI: ${summarizeProviderError(googleError)}`);
          break;
        }
      }
    }

    if (hasOpenRouter) {
      try {
        const results = await requestOpenRouterBatch(systemPrompt, batch);
        return selectFragmentResult("OpenRouter", fragment, results);
      } catch (orError) {
        console.warn("[prompt-generation] OpenRouter failed:", orError);
        providerErrors.push(`OpenRouter: ${summarizeProviderError(orError)}`);
      }
    }

    const details = providerErrors.length > 0 ? ` Último detalle: ${providerErrors.at(-1)}` : "";
    throw new Error(`Todos los proveedores fallaron para el fragmento ${fragment.id}.${details}`);
  }

  // Provider priority per fragment: Ollama (local) > Groq > Google AI > OpenRouter (free)
  async function requestWithFallback(batch: PromptFragment[]): Promise<PromptResult[]> {
    const results: PromptResult[] = [];
    for (const fragment of batch) {
      console.log(`[prompt-generation] Processing fragment ${fragment.id}`);
      results.push(await requestFragmentWithFallback(fragment));
    }
    return results;
  }

  try {
    const batches = chunkFragments(parsedBody.data.fragments, maxBatchSize);

    // Process batches sequentially to respect rate limits
    const allResults: PromptResult[] = [];
    for (let i = 0; i < batches.length; i++) {
      console.log(`[prompt-generation] Processing batch ${i + 1}/${batches.length}`);
      const batchResult = await requestWithFallback(batches[i]);
      allResults.push(...batchResult);
      // Small delay between batches to avoid rate limits
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Validate that all requested fragment IDs are present exactly once
    const requestedIds = new Set(parsedBody.data.fragments.map((f) => f.id));
    const resultCounts = new Map<number, number>();
    for (const result of allResults) {
      resultCounts.set(result.fragment_id, (resultCounts.get(result.fragment_id) ?? 0) + 1);
    }

    // Check for missing or duplicate IDs among requested fragments
    for (const id of requestedIds) {
      const count = resultCounts.get(id) ?? 0;
      if (count === 0) {
        throw new Error(`Falta fragment_id en la respuesta del modelo: ${id}`);
      }
      if (count !== 1) {
        throw new Error(`El modelo devolvió fragment_id ${id} ${count} veces; se esperaba exactamente 1`);
      }
    }

    // Filter to only requested IDs and sort
    const results = allResults
      .filter((r) => requestedIds.has(r.fragment_id))
      .sort((a, b) => a.fragment_id - b.fragment_id);

    console.log(
      `[prompt-generation] Success: user=${userId.slice(0, 4)}****, fragments=${results.length}`
    );

    return NextResponse.json({ results }, { status: 200 });
  } catch (error: unknown) {
    // Log the real error server-side for debugging
    console.error("[prompt-generation] Failed:", error);

    // Return a generic message to the client — never leak internal details
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al generar prompts" },
      { status: 500 }
    );
  }
}
