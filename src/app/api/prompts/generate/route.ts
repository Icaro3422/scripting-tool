import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Groq from "groq-sdk";
import { z } from "zod";

import { type PromptResult } from "@/lib/text-processing";

// ============================================================================
// Configuration
// ============================================================================

const model = process.env.GROQ_MODEL ?? "llama3-8b-8192";
const maxBatchSize = Number.isFinite(Number(process.env.GROQ_BATCH_SIZE))
  ? Number(process.env.GROQ_BATCH_SIZE)
  : 8;
const openRouterModel = process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct";
const openRouterBaseUrl = "https://openrouter.ai/api/v1/chat/completions";
const openRouterSiteUrl = process.env.OPENROUTER_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
const openRouterAppName = process.env.OPENROUTER_APP_NAME ?? "Scripting Tool";

const maxFragmentsPerRequest = Number.isFinite(Number(process.env.MAX_PROMPT_FRAGMENTS_PER_REQUEST))
  ? Number(process.env.MAX_PROMPT_FRAGMENTS_PER_REQUEST)
  : 32;
const maxFragmentTextLength = Number.isFinite(Number(process.env.MAX_PROMPT_FRAGMENT_TEXT_LENGTH))
  ? Number(process.env.MAX_PROMPT_FRAGMENT_TEXT_LENGTH)
  : 4000;
const maxTotalFragmentChars = Number.isFinite(Number(process.env.MAX_PROMPT_TOTAL_FRAGMENT_CHARS))
  ? Number(process.env.MAX_PROMPT_TOTAL_FRAGMENT_CHARS)
  : 20000;

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
    style: z.string().min(1).max(500),
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
    'Expected format: [{"fragment_id":1,"original_text":"...","image_prompt":"..."}]',
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

function parseModelJson(rawText: string): PromptResult[] {
  const jsonArrayText = extractFirstJsonArray(rawText.trim());
  const parsed = JSON.parse(jsonArrayText) as unknown;
  return z.array(responseItemSchema).parse(parsed);
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
  batch: { id: number; text: string }[]
): Promise<PromptResult[]> {
  const completion = await groq.chat.completions.create({
    model,
    temperature: 0.5,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(batch) },
    ],
  });

  const rawOutput = completion.choices[0]?.message?.content ?? "";
  return parseModelJson(rawOutput);
}

async function requestOpenRouterBatch(
  systemPrompt: string,
  batch: { id: number; text: string }[]
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
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(batch) },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, "OpenRouter request failed"));
  }

  const rawOutput = extractOpenRouterContent(payload);
  return parseModelJson(rawOutput);
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: Request): Promise<Response> {
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);

  // Auth check
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!hasGroq && !hasOpenRouter) {
    console.error("[prompt-generation] No LLM provider configured");
    return NextResponse.json(
      { error: "Error del servidor: configuración incompleta" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsedBody = requestSchema.safeParse(body);

  if (!parsedBody.success) {
    console.warn("[prompt-generation] Invalid request payload:", parsedBody.error.flatten());
    return NextResponse.json(
      { error: "Solicitud inválida" },
      { status: 400 }
    );
  }

  // Use singleton client or create one if needed
  const groq = groqClient ?? (hasGroq ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null);
  const systemPrompt = buildSystemPrompt(parsedBody.data.style);

  try {
    const batches = chunkFragments(parsedBody.data.fragments, maxBatchSize);

    // Process batches in parallel for faster response times
    const batchPromises = batches.map(async (batch) => {
      if (groq) {
        try {
          return await requestGroqBatch(groq, systemPrompt, batch);
        } catch (groqError: unknown) {
          if (!hasOpenRouter || !shouldFallbackToOpenRouter(groqError)) {
            throw groqError;
          }
          console.warn("[prompt-generation] Groq failed, falling back to OpenRouter:", groqError);
          return await requestOpenRouterBatch(systemPrompt, batch);
        }
      }
      return await requestOpenRouterBatch(systemPrompt, batch);
    });

    const batchResults = await Promise.all(batchPromises);
    const allResults = batchResults.flat();

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
      `[prompt-generation] Success: userId=${userId}, fragments=${results.length}, provider=${groq ? "groq" : "openrouter"}`
    );

    return NextResponse.json({ results }, { status: 200 });
  } catch (error: unknown) {
    // Log the real error server-side for debugging
    console.error("[prompt-generation] Failed:", error);

    // Return a generic message to the client — never leak internal details
    return NextResponse.json(
      { error: "Error al generar prompts" },
      { status: 500 }
    );
  }
}
