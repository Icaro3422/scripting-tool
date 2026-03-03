import { NextResponse } from "next/server";
import { AI_MODELS } from "@/types/ai";

const OPENROUTER_API = "https://openrouter.ai/api/v1/models";

/**
 * GET /api/ai/models
 * Lista modelos de IA: estáticos (OpenAI, Anthropic, etc.) + OpenRouter si hay API key.
 * OpenRouter permite usar modelos gratuitos (DeepSeek, Qwen, etc.) y de pago (Claude, GPT, Gemini).
 * Ref: https://openrouter.ai/models
 */
export async function GET() {
  try {
    const staticModels = AI_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      costTier: m.costTier ?? "medium",
      openRouterId: null as string | null,
    }));

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      return NextResponse.json({
        models: staticModels,
        openRouterAvailable: false,
      });
    }

    const res = await fetch(OPENROUTER_API, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json({
        models: staticModels,
        openRouterAvailable: false,
        openRouterError: res.statusText,
      });
    }

    const data = (await res.json()) as { data?: { id: string; name?: string; pricing?: { prompt?: string; completion?: string } }[] };
    const openRouterList = data.data ?? [];
    const openRouterModels = openRouterList
      .filter((m) => m.id && !m.id.includes("embedding") && !m.id.includes("vision"))
      .slice(0, 80)
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        provider: "openrouter" as const,
        costTier: (m.pricing?.prompt === "0" && m.pricing?.completion === "0" ? "free" : "medium") as "free" | "medium" | "high",
        openRouterId: m.id,
      }));

    return NextResponse.json({
      models: [...staticModels, ...openRouterModels],
      openRouterAvailable: true,
      openRouterCount: openRouterModels.length,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({
      models: AI_MODELS.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        costTier: m.costTier ?? "medium",
        openRouterId: null,
      })),
      openRouterAvailable: false,
    });
  }
}
