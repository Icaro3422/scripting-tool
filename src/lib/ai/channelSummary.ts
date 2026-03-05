import { chatCompletion } from "./providers";
import type { AIProviderId } from "@/types/ai";
import type { ChannelAnalysis } from "@/lib/youtube";

export interface ChannelViralSummary {
  suggestedTone: string;
  suggestedFormat: string;
  viralSummary: string;
  brandHints?: string;
  /** Estilo de miniatura de la competencia: "few" = pocas palabras (2-4), "many" = muchas palabras (5-8) */
  thumbnailWordStyle?: "few" | "many";
}

const FALLBACK: ChannelViralSummary = {
  suggestedTone: "Neutral, informativo",
  suggestedFormat: "Estructura libre según el tema",
  viralSummary: "No se pudo generar resumen automático. Usa la descripción del canal como referencia.",
};

/** Orden de proveedores a intentar (modelo barato). OpenRouter primero si solo tienes OPENROUTER_API_KEY. */
const PROVIDER_ORDER: { provider: AIProviderId; model: string }[] = [
  { provider: "openrouter", model: "deepseek/deepseek-chat" },
  { provider: "openai", model: "gpt-4o-mini" },
  { provider: "anthropic", model: "claude-3-5-haiku-20241022" },
  { provider: "deepseek", model: "deepseek-chat" },
  { provider: "google", model: "gemini-1.5-flash" },
];

function buildPrompt(analysis: ChannelAnalysis): string {
  const parts: string[] = [
    `Canal: ${analysis.title ?? "Sin nombre"}`,
    `Suscriptores: ${analysis.subscriberCount.toLocaleString()}, Videos: ${analysis.videoCount}, Vistas totales: ${analysis.viewCount}`,
  ];
  if (analysis.description?.trim()) {
    parts.push(`Descripción del canal:\n${analysis.description.slice(0, 3000)}`);
  }
  if (analysis.country) parts.push(`País: ${analysis.country}`);
  return parts.join("\n\n");
}

export async function generateChannelViralSummary(
  analysis: ChannelAnalysis
): Promise<ChannelViralSummary> {
  const input = buildPrompt(analysis);
  const systemPrompt = `Eres un analista de canales de YouTube. A partir del nombre del canal, su descripción y estadísticas, genera un resumen breve en español para usar como preset de contenido.

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin \`\`\`) con estas claves:
- "suggestedTone": tono de voz en 1 línea (ej. "Misterioso, sensacionalista, gancho en el título")
- "suggestedFormat": formato típico en 1 línea (ej. "Listados, mini-documentales, curiosidades")
- "viralSummary": 2-4 frases explicando por qué el canal engancha: público objetivo, tipo de gancho, estilo de miniatura/título si se infiere
- "brandHints": (opcional) colores, estilo visual o marca si se menciona en la descripción; si no, omite la clave
- "thumbnailWordStyle": (opcional) "few" si las miniaturas del canal/nicho suelen llevar poco texto (2-4 palabras), "many" si llevan más texto (5-8 palabras); si no puedes inferirlo, omite la clave`;

  for (const { provider, model } of PROVIDER_ORDER) {
    try {
      const raw = await chatCompletion(provider, model, [
        { role: "system", content: systemPrompt },
        { role: "user", content: input },
      ]);
      const cleaned = raw.replace(/^[\s\S]*?\{/, "{").replace(/\}[\s\S]*$/, "}");
      const parsed = JSON.parse(cleaned) as ChannelViralSummary;
      if (parsed.suggestedTone && parsed.suggestedFormat && parsed.viralSummary) {
        return {
          suggestedTone: String(parsed.suggestedTone),
          suggestedFormat: String(parsed.suggestedFormat),
          viralSummary: String(parsed.viralSummary),
          brandHints: parsed.brandHints ? String(parsed.brandHints) : undefined,
          thumbnailWordStyle:
            parsed.thumbnailWordStyle === "few" || parsed.thumbnailWordStyle === "many"
              ? parsed.thumbnailWordStyle
              : undefined,
        };
      }
    } catch {
      continue;
    }
  }
  return FALLBACK;
}
