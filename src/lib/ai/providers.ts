import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIProviderId } from "@/types/ai";

export type Message = { role: "user" | "assistant" | "system"; content: string };

export type ChatCompletionOptions = { max_tokens?: number };

export type UsageInfo = { prompt_tokens: number; completion_tokens: number };

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

function getDeepSeek(): OpenAI | null {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key, baseURL: "https://api.deepseek.com/v1" });
}

function getGoogle(): GoogleGenerativeAI | null {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

export async function chatCompletion(
  provider: AIProviderId,
  model: string,
  messages: Message[],
  options?: ChatCompletionOptions
): Promise<string> {
  const systemMessage = messages.find((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  const maxTokens = options?.max_tokens ?? 4096;

  if (provider === "openai") {
    const client = getOpenAI();
    if (!client) throw new Error("OPENAI_API_KEY no configurada");
    const list = systemMessage
      ? [{ role: "system" as const, content: systemMessage.content }, ...rest]
      : rest;
    const res = await client.chat.completions.create({
      model: model.startsWith("gpt-") ? model : "gpt-4o-mini",
      messages: list.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: maxTokens,
    });
    return res.choices[0]?.message?.content ?? "";
  }

  if (provider === "anthropic") {
    const client = getAnthropic();
    if (!client) throw new Error("ANTHROPIC_API_KEY no configurada");
    const system = systemMessage?.content ?? "";
    const res = await client.messages.create({
      model: model.startsWith("claude-") ? model : "claude-3-5-haiku-20241022",
      max_tokens: maxTokens,
      system,
      messages: rest.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });
    const block = res.content.find((b) => b.type === "text");
    return block && "text" in block ? block.text : "";
  }

  if (provider === "deepseek") {
    const client = getDeepSeek();
    if (!client) throw new Error("DEEPSEEK_API_KEY no configurada");
    const list = systemMessage
      ? [{ role: "system" as const, content: systemMessage.content }, ...rest]
      : rest;
    const res = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: list.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: maxTokens,
    });
    return res.choices[0]?.message?.content ?? "";
  }

  if (provider === "google") {
    const client = getGoogle();
    if (!client) throw new Error("GOOGLE_AI_API_KEY no configurada");
    const genModel = client.getGenerativeModel({
      model: model.startsWith("gemini-") ? model : "gemini-1.5-flash",
    });
    const parts = [
      ...(systemMessage ? [`Instrucciones: ${systemMessage.content}\n\n`] : []),
      ...rest.map((m) => `${m.role}: ${m.content}`),
    ];
    const result = await genModel.generateContent(parts.join("\n"));
    const text = result.response.text();
    return text ?? "";
  }

  if (provider === "openrouter") {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY no configurada. Añádela en .env para usar modelos de openrouter.ai.");
    const modelId = model.includes("/") ? model : `openrouter/${model}`;
    const list = systemMessage
      ? [{ role: "system" as const, content: systemMessage.content }, ...rest]
      : rest;
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      },
      body: JSON.stringify({
        model: modelId,
        messages: list.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`OpenRouter: ${res.status} ${raw.slice(0, 200)}`);
    }
    let data: {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`OpenRouter devolvió una respuesta no válida. Prueba otro modelo.`);
    }
    return data.choices?.[0]?.message?.content ?? "";
  }

  throw new Error(`Proveedor no soportado: ${provider}`);
}

/**
 * Igual que chatCompletion pero devuelve también usage cuando está disponible (OpenRouter).
 * Para otros proveedores, usage puede ser undefined.
 */
export async function chatCompletionWithUsage(
  provider: AIProviderId,
  model: string,
  messages: Message[],
  options?: ChatCompletionOptions
): Promise<{ content: string; usage?: UsageInfo }> {
  const systemMessage = messages.find((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  const maxTokens = options?.max_tokens ?? 4096;

  if (provider === "openrouter") {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY no configurada.");
    const modelId = model.includes("/") ? model : `openrouter/${model}`;
    const list = systemMessage
      ? [{ role: "system" as const, content: systemMessage.content }, ...rest]
      : rest;
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      },
      body: JSON.stringify({
        model: modelId,
        messages: list.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
      }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`OpenRouter: ${res.status} ${raw.slice(0, 200)}`);
    let data: {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`OpenRouter devolvió una respuesta no válida.`);
    }
    const content = data.choices?.[0]?.message?.content ?? "";
    const usage =
      data.usage?.prompt_tokens != null && data.usage?.completion_tokens != null
        ? { prompt_tokens: data.usage.prompt_tokens, completion_tokens: data.usage.completion_tokens }
        : undefined;
    return { content, usage };
  }

  const content = await chatCompletion(provider, model, messages, options);
  return { content };
}
