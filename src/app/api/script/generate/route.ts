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
      type: "script" | "title" | "description";
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

    const latestScriptContent = type === "description" ? project.scripts[0]?.content ?? "" : "";

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
    const userPrompt = buildUserPrompt(type, topic, presetPayload, scriptMinutes, latestScriptContent);

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
  type: "script" | "title" | "description",
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
  if (type === "description") {
    return `Eres un experto en descripciones para YouTube. Genera SIEMPRE la descripción en español con esta estructura exacta:

1) BLOQUE INICIAL (palabras clave del video): Un encabezado corto tipo "Cómo empezar HOY:" o similar, seguido de 2-4 líneas de acción o reflexión (bullets o frases cortas) que resuman el contenido.

2) SECCIÓN DE REFLEXIÓN: Una o dos preguntas o una breve reflexión que conecte con el espectador (relacionada con el tema del video).

3) Línea separadora: "______" (guiones bajos).

4) Opcionalmente un párrafo de bienvenida/contexto del canal si encaja (ej. "Bienvenidos a... Este espacio...").

5) LISTA DE TIMESTAMPS (capítulos): Si te proporcionan el script del video, deriva de él los momentos clave y genera una lista con formato exacto:
00:00 Título del primer momento
01:30 Título del siguiente
...
Cada línea: minutos:segundos (dos dígitos) + espacio + Título corto. Los timestamps deben corresponder a secciones lógicas del script (saludo, introducción, tema 1, tema 2, cierre, etc.). Estima los minutos según la longitud del script (~150 palabras por minuto).

6) Opcional al final: "Inspirado por" seguido de una línea en blanco y una lista de 2-5 títulos de videos relacionados (solo títulos, uno por línea), como referencia de contenido similar.

${presetCtx}
Responde ÚNICAMENTE con el texto de la descripción, sin explicaciones ni encabezados tipo "Descripción:".`;
  }
  return presetCtx || "Genera contenido para YouTube.";
}

function buildUserPrompt(
  type: "script" | "title" | "description",
  topic: string,
  _preset: Record<string, unknown>,
  targetMinutes?: number,
  scriptContent?: string
): string {
  if (type === "script") {
    const lengthLine =
      targetMinutes != null
        ? `\n\nDuración objetivo del video: ${targetMinutes} minutos. Longitud del guion requerida: aproximadamente ${targetWordsForMinutes(targetMinutes)} palabras (~150 palabras/min). Es crítico que el guion alcance esta longitud para que el video dure ${targetMinutes} minutos.`
        : "";
    return `Tema del video: ${topic}${lengthLine}`;
  }
  if (type === "title") return `Tema o título base: ${topic}`;
  if (type === "description") {
    let user = `Título o tema del video: ${topic}.`;
    if (scriptContent && scriptContent.trim()) {
      user += `\n\nScript del video (úsalo para generar la lista de timestamps/capítulos con 00:00 Título por sección):\n\n${scriptContent.slice(0, 12000)}`;
    } else {
      user += "\n\nNo hay script disponible; genera la descripción con la estructura indicada pero omite o estima los timestamps si no puedes derivarlos.";
    }
    return user;
  }
  return topic;
}
