import { NextRequest, NextResponse } from "next/server";
import { createElevenLabsTts, createMinimaxTts, pollTask } from "@/lib/voices/ai33";
import { auth } from "@clerk/nextjs/server";

/**
 * POST /api/voices/preview
 * Generates TTS audio via AI33 Pro (ElevenLabs or Minimax).
 * Body: { voiceId: string, provider: "elevenlabs"|"minimax", text?: string }
 * Returns: audio/mpeg binary for inline playback.
 */

const SAMPLE_TEXTS: Record<string, string> = {
  en: "Hello. This is a short preview of this AI voice.",
  es: "Hola. Esta es una breve muestra de esta voz de inteligencia artificial.",
  fr: "Bonjour. Ceci est un court aperçu de cette voix.",
  de: "Hallo. Das ist eine kurze Vorschau dieser KI-Stimme.",
  it: "Ciao. Questa è una breve anteprima di questa voce IA.",
  pt: "Olá. Esta é uma amostra curta desta voz de IA.",
  zh: "你好。这是此人工智能声音的简短预览。",
  ja: "こんにちは。このAI音声の短いプレビューです。",
  hi: "नमस्ते। यह इस AI आवाज़ का एक संक्षिप्त पूर्वावलोकन है।",
  ko: "안녕하세요. 이 AI 음성의 짧은 미리 보기입니다.",
  ar: "مرحبا. هذا معاينة قصيرة لهذا الصوت الذكي.",
  ru: "Привет. Это краткий предварительный просмотр этого голоса ИИ.",
};

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const key = process.env.AI33_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "AI33_API_KEY no configurada",
        code: "AI33_KEY_MISSING",
        hint: "Añade AI33_API_KEY en .env. Obtén tu key en https://ai33.pro",
      },
      { status: 503 }
    );
  }

  let body: { voiceId?: string; provider?: string; text?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const voiceId = (body.voiceId ?? "").trim();
  const provider = (body.provider ?? "elevenlabs").toLowerCase();
  const lang = (body.lang ?? "es").split("-")[0];
  const text = (body.text ?? "").trim() ||
    SAMPLE_TEXTS[lang] ||
    SAMPLE_TEXTS.es;

  if (!voiceId) {
    return NextResponse.json({ error: "voiceId requerido" }, { status: 400 });
  }

  try {
    // 1. Submit TTS task
    let taskResp;
    if (provider === "minimax") {
      taskResp = await createMinimaxTts({ voiceId, text });
    } else {
      taskResp = await createElevenLabsTts({ voiceId, text });
    }

    if (!taskResp.success || !taskResp.task_id) {
      return NextResponse.json(
        { error: "No se pudo crear la tarea TTS", detail: JSON.stringify(taskResp) },
        { status: 502 }
      );
    }

    // 2. Poll until done (max 45s)
    const task = await pollTask(taskResp.task_id, { maxMs: 45_000, intervalMs: 1_500 });

    if (task.status === "error") {
      return NextResponse.json(
        { error: task.error_message ?? "Error en tarea TTS" },
        { status: 502 }
      );
    }

    // 3. Resolve audio URL from metadata
    const meta = task.metadata ?? {};
    const audioUrl =
      (meta.audio_url as string) ??
      (meta.output_uri as string) ??
      null;

    if (!audioUrl) {
      return NextResponse.json(
        { error: "Tarea completada pero sin audio_url", detail: JSON.stringify(meta) },
        { status: 502 }
      );
    }

    // 4. Proxy audio to browser
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      return NextResponse.json(
        { error: "No se pudo descargar el audio generado" },
        { status: 502 }
      );
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const contentType = audioRes.headers.get("content-type") || "audio/mpeg";

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=120",
      },
    });
  } catch (e: unknown) {
    console.error("POST /api/voices/preview error:", e);
    const message = e instanceof Error ? e.message : String(e);
    const isTimeout = message.includes("timeout");
    return NextResponse.json(
      {
        error: isTimeout
          ? "La generación de voz tardó demasiado. Intenta de nuevo."
          : "Error al generar vista previa de voz",
        detail: message.slice(0, 300),
      },
      { status: 500 }
    );
  }
}
