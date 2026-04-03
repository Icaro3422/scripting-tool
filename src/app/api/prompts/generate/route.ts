import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { z } from "zod";

import { IMAGE_STYLES, type PromptResult } from "@/lib/text-processing";

const model = process.env.GROQ_MODEL ?? "llama3-8b-8192";
const maxBatchSize = Number(process.env.GROQ_BATCH_SIZE ?? 8);
const openRouterModel = process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct";
const openRouterBaseUrl = "https://openrouter.ai/api/v1/chat/completions";
const openRouterSiteUrl = process.env.OPENROUTER_SITE_URL ?? "http://localhost:3001";
const openRouterAppName = process.env.OPENROUTER_APP_NAME ?? "Scripting Tool";

const fragmentSchema = z.object({
  id: z.number().int().positive(),
  text: z.string().min(1),
});

const requestSchema = z.object({
  fragments: z.array(fragmentSchema).min(1),
  style: z.string().min(1),
});

const responseItemSchema = z.object({
  fragment_id: z.number().int().positive(),
  original_text: z.string().min(1),
  image_prompt: z.string().min(1),
});

function buildSystemPrompt(style: string): string {
  return [
    "You are an expert prompt engineer for AI image generation models.",
    `The selected image style is: ${style}.`,
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

async function requestGroqBatch(
  groq: Groq,
  style: string,
  batch: { id: number; text: string }[]
): Promise<PromptResult[]> {
  const completion = await groq.chat.completions.create({
    model,
    temperature: 1,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(style),
      },
      {
        role: "user",
        content: JSON.stringify(batch),
      },
    ],
  });

  const rawOutput = completion.choices[0]?.message?.content ?? "";
  return parseModelJson(rawOutput);
}

async function requestOpenRouterBatch(
  style: string,
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
      temperature: 1,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(style),
        },
        {
          role: "user",
          content: JSON.stringify(batch),
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "object" &&
      (payload as { error: { message?: unknown } }).error?.message
        ? String((payload as { error: { message?: unknown } }).error.message)
        : "OpenRouter request failed";
    throw new Error(message);
  }

  const rawOutput =
    typeof payload === "object" &&
    payload !== null &&
    "choices" in payload &&
    Array.isArray((payload as { choices?: unknown[] }).choices)
      ? ((payload as { choices: Array<{ message?: { content?: string } }> }).choices[0]?.message?.content ?? "")
      : "";

  return parseModelJson(rawOutput);
}

export async function POST(request: Request): Promise<Response> {
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);

  if (!hasGroq && !hasOpenRouter) {
    return NextResponse.json(
      { error: "Missing provider credentials. Configure GROQ_API_KEY or OPENROUTER_API_KEY." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsedBody = requestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload",
        details: parsedBody.error.flatten(),
      },
      { status: 400 }
    );
  }

  const groq = hasGroq ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

  try {
    const batches = chunkFragments(parsedBody.data.fragments, maxBatchSize);
    const allResults: PromptResult[] = [];

    for (const batch of batches) {
      let batchResults: PromptResult[];

      if (groq) {
        try {
          batchResults = await requestGroqBatch(groq, parsedBody.data.style, batch);
        } catch (groqError: unknown) {
          if (!hasOpenRouter || !shouldFallbackToOpenRouter(groqError)) {
            throw groqError;
          }
          batchResults = await requestOpenRouterBatch(parsedBody.data.style, batch);
        }
      } else {
        batchResults = await requestOpenRouterBatch(parsedBody.data.style, batch);
      }

      allResults.push(...batchResults);
    }

    const results = allResults.sort((a, b) => a.fragment_id - b.fragment_id);

    return NextResponse.json({ results }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json(
      {
        error: "Failed to generate prompts",
        details: message,
      },
      { status: 500 }
    );
  }
}
