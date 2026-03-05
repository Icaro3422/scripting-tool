import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { chatCompletion } from "@/lib/ai/providers";
import { AI_MODELS } from "@/types/ai";
import type { AIProviderId } from "@/types/ai";
import {
  countWords,
  estimatedMinutes,
  targetWordsForMinutes,
  isTargetMet,
  maxTokensForScriptMinutes,
} from "@/lib/scriptUtils";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    let user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      user = await prisma.user.create({ data: { clerkId: userId } });
    }

    const body = await req.json();
    const {
      projectId,
      presetId,
      topic,
      modelId,
      provider: providerParam,
      type,
      targetDurationMinutes,
    } = body as {
      projectId: string;
      presetId?: string;
      topic: string;
      modelId: string;
      provider?: string;
      type: "script" | "title" | "description" | "tags";
      /** Duración objetivo del video en minutos (1–120). Define longitud del guion. */
      targetDurationMinutes?: number;
    };

    if (!projectId || !topic || !modelId || !type) {
      return NextResponse.json(
        { error: "projectId, topic, modelId y type son requeridos" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
      include: { scripts: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const latestScriptContent = type === "description" || type === "tags" ? project.scripts[0]?.content ?? "" : "";

    let provider: string;
    let modelForApi: string;
    if (providerParam === "openrouter" || (modelId && modelId.includes("/"))) {
      provider = "openrouter";
      modelForApi = modelId;
    } else {
      const modelOption = AI_MODELS.find((m) => m.id === modelId);
      if (!modelOption) {
        return NextResponse.json({ error: "Modelo no válido" }, { status: 400 });
      }
      provider = modelOption.provider;
      modelForApi = modelOption.id;
    }

    let presetPayload: Record<string, unknown> = {};
    if (presetId) {
      const preset = await prisma.preset.findFirst({
        where: { id: presetId, userId: user.id },
      });
      if (preset) presetPayload = (preset.payload as Record<string, unknown>) ?? {};
    }

    const scriptMinutes = type === "script" ? Math.min(120, Math.max(1, targetDurationMinutes ?? 5)) : undefined;
    const systemPrompt = buildSystemPrompt(type, presetPayload, scriptMinutes);
    const thumbnailPhrase = (body as { thumbnailPhrase?: string }).thumbnailPhrase ?? project.title;
    const userPrompt = buildUserPrompt(type, topic, presetPayload, scriptMinutes, latestScriptContent, thumbnailPhrase);

    const completionOptions =
      type === "script" && scriptMinutes != null
        ? { max_tokens: maxTokensForScriptMinutes(scriptMinutes) }
        : undefined;

    const content = await chatCompletion(
      provider as AIProviderId,
      modelForApi,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      completionOptions
    );

    if (type === "script") {
      const trimmed = content.trim();
      const wordCount = countWords(trimmed);
      const estimatedDurationMin = estimatedMinutes(wordCount);
      const targetMet = scriptMinutes != null ? isTargetMet(wordCount, scriptMinutes) : null;
      const script = await prisma.script.create({
        data: {
          userId: user.id,
          projectId,
          presetId: presetId ?? null,
          title: project.title,
          content: trimmed,
          aiProvider: provider,
          aiModel: modelForApi,
        },
        include: { project: true },
      });
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "script_ready" },
      });
      return NextResponse.json({
        script,
        generated: trimmed,
        wordCount,
        estimatedDurationMinutes: estimatedDurationMin,
        targetDurationMinutes: scriptMinutes ?? undefined,
        targetMet: targetMet ?? undefined,
      });
    }

    if (type === "title") {
      await prisma.project.update({
        where: { id: projectId },
        data: { title: content.trim() },
      });
      return NextResponse.json({ generated: content.trim() });
    }

    if (type === "description") {
      await prisma.project.update({
        where: { id: projectId },
        data: { description: content.trim() },
      });
      return NextResponse.json({ generated: content.trim() });
    }

    if (type === "tags") {
      const raw = content.trim();
      const tags: string[] = [];
      const lines = raw.split(/\n/).map((s) => s.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
      for (const line of lines) {
        const match = line.match(/^[\d.]+\s*(.+)$/) ?? [null, line];
        const tag = (match[1] ?? line).replace(/^["']|["']$/g, "").trim();
        if (tag.length > 0 && tag.length <= 100) tags.push(tag);
      }
      if (tags.length === 0 && raw.length > 0) tags.push(raw.slice(0, 100));
      return NextResponse.json({ generated: raw, tags: tags.slice(0, 30) });
    }

    return NextResponse.json({ error: "type no válido" }, { status: 400 });
  } catch (e: unknown) {
    console.error(e);
    const isPrismaTableMissing =
      typeof e === "object" && e !== null && (e as { code?: string }).code === "P2021";
    if (isPrismaTableMissing) {
      return NextResponse.json(
        {
          error: "Base de datos no inicializada",
          code: "DB_NOT_READY",
          hint: "Ejecuta: bun run db:push. Ver CONFIGURACION.md → Base de datos.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al generar" },
      { status: 500 }
    );
  }
}

function buildSystemPrompt(
  type: "script" | "title" | "description" | "tags",
  preset: Record<string, unknown>,
  targetMinutes?: number
): string {
  const presetCtx = Object.keys(preset).length
    ? `Contexto del canal (preset): ${JSON.stringify(preset)}. Úsalo para mantener coherencia.`
    : "";

  if (type === "script") {
    const wordTarget =
      targetMinutes != null
        ? `REQUISITO DE LONGITUD (obligatorio): El guion debe tener exactamente entre ${targetWordsForMinutes(targetMinutes) - 500} y ${targetWordsForMinutes(targetMinutes) + 500} palabras, equivalente a un video de ${targetMinutes} minutos a ~150 palabras/minuto en español. Desarrolla el tema con suficiente profundidad para alcanzar esta longitud; si el tema es corto, expande con ejemplos, transiciones y secciones adicionales. No entregues un guion más corto.`
        : "";
    return `Eres un guionista profesional para YouTube. Genera un guion en español, claro y enganchador.
${presetCtx}
${wordTarget}
Responde solo con el texto del guion, sin encabezados ni explicaciones.`;
  }
  if (type === "title") {
    return `Eres un experto en títulos para YouTube. Genera un solo título atractivo y optimizado para SEO.
${presetCtx}
Responde solo con el título, sin comillas ni explicaciones.`;
  }
  if (type === "tags") {
    return `Eres un experto en SEO y tendencias para YouTube. Genera una lista de ETIQUETAS (tags) para el video que tengan alto potencial de búsqueda.
Criterios: palabras y frases que la gente busca en YouTube, términos relacionados con el tema, variantes (español/LATAM), tendencias en el nicho.
Responde ÚNICAMENTE con una lista numerada de 15 a 25 etiquetas, una por línea, sin explicaciones. Cada etiqueta: máximo 3-4 palabras, en minúsculas.`;
  }
  if (type === "description") {
    return `Eres un experto en descripciones para YouTube, orientado a SEO y engagement. Genera SIEMPRE la descripción en español con esta estructura:

REQUISITO SEO – PRIMEROS 200 CARACTERES (crítico para búsqueda):
- Las primeras 200 caracteres deben incluir: (1) Palabras clave del canal que te indiquen, (2) La frase o concepto de la miniatura/título del video, (3) Temas concretos del script. Sin relleno; máximo impacto para el algoritmo y el CTR.
- Optimiza todo el texto para SEO: palabras clave naturales, términos que la gente busca, sin keyword stuffing.

1) BLOQUE INICIAL (≈200 caracteres): Encabezado gancho + frase de la miniatura + keywords del canal + temas del script. 2-4 líneas que enganchen y posicionen.

2) SECCIÓN DE REFLEXIÓN: Una o dos preguntas o breve reflexión que conecte con el espectador.

3) Línea separadora: "______" (guiones bajos).

4) Párrafo breve de bienvenida/contexto del canal si encaja.

5) LISTA DE TIMESTAMPS (capítulos): Deriva del script. Formato exacto:
00:00 Título del momento
01:30 Siguiente
...
(~150 palabras por minuto del script).

6) SECCIÓN DE ENGAGEMENT (sutil): Una o dos frases que inviten a suscribirse, seguir o compartir sin ser spam. Ej: "Si te sirvió, suscríbete para más" o "Comparte con quien le pueda ayudar". Natural y breve.

7) Opcional: "Inspirado por" + 2-5 títulos de videos relacionados.

${presetCtx}
Responde ÚNICAMENTE con el texto de la descripción, sin encabezados tipo "Descripción:".`;
  }
  return presetCtx || "Genera contenido para YouTube.";
}

function buildUserPrompt(
  type: "script" | "title" | "description" | "tags",
  topic: string,
  preset: Record<string, unknown>,
  targetMinutes?: number,
  scriptContent?: string,
  thumbnailPhrase?: string
): string {
  if (type === "script") {
    const lengthLine =
      targetMinutes != null
        ? `\n\nDuración objetivo del video: ${targetMinutes} minutos. Longitud del guion requerida: aproximadamente ${targetWordsForMinutes(targetMinutes)} palabras (~150 palabras/min). Es crítico que el guion alcance esta longitud para que el video dure ${targetMinutes} minutos.`
        : "";
    return `Tema del video: ${topic}${lengthLine}`;
  }
  if (type === "title") return `Tema o título base: ${topic}`;
  if (type === "tags") {
    let user = `Tema o título del video: ${topic}.`;
    if (scriptContent && scriptContent.trim()) {
      user += `\n\nResumen del contenido (para afinar etiquetas):\n${scriptContent.slice(0, 3000)}`;
    }
    return user;
  }
  if (type === "description") {
    const keywordsFromPreset = [preset.suggestedTone, preset.viralSummary, preset.brandHints, preset.suggestedFormat]
      .filter(Boolean)
      .map(String)
      .join("; ");
    let user = `Título o tema del video: ${topic}.`;
    if (thumbnailPhrase?.trim()) {
      user += `\n\nFrase o concepto de la miniatura (inclúyela en los primeros 200 caracteres): "${thumbnailPhrase.trim()}".`;
    }
    if (keywordsFromPreset) {
      user += `\n\nPalabras clave / estilo del canal (inclúyelas de forma natural en los primeros 200 caracteres): ${keywordsFromPreset}.`;
    }
    if (scriptContent && scriptContent.trim()) {
      user += `\n\nScript del video (úsalo para timestamps y temas para SEO):\n\n${scriptContent.slice(0, 12000)}`;
    } else {
      user += "\n\nNo hay script disponible; genera la descripción con la estructura indicada y estima timestamps si hace falta.";
    }
    return user;
  }
  return topic;
}
