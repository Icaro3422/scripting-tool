import { NextRequest, NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";
import { getVoiceById } from "@/lib/voices/voiceCatalog";

/** Modelo TTS único que soporta varios idiomas vía el cliente HF (evita 404 por modelo no disponible en router). */
const TTS_MODEL = "facebook/mms-tts-eng";

const SAMPLE_TEXTS: Record<string, string> = {
  en: "Hello. This is a short preview of this voice.",
  es: "Hola. Esta es una breve muestra de esta voz.",
  fr: "Bonjour. Ceci est un court aperçu de cette voix.",
  de: "Hallo. Das ist eine kurze Vorschau dieser Stimme.",
  it: "Ciao. Questa è una breve anteprima di questa voce.",
  pt: "Olá. Esta é uma amostra curta desta voz.",
  zh: "你好。这是此声音的简短预览。",
  ja: "こんにちは。この音声の短いプレビューです。",
  hi: "नमस्ते। यह इस आवाज का एक संक्षिप्त पूर्वावलोकन है।",
};

const DEFAULT_SAMPLE = "This is a voice preview.";

/**
 * POST /api/voices/preview
 * Genera audio de vista previa usando el cliente oficial de Hugging Face (@huggingface/inference).
 * Body: { voiceId: string, text?: string }
 * Necesita HUGGINGFACE_API_KEY en .env.
 */
export async function POST(req: NextRequest) {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "HUGGINGFACE_API_KEY no configurada",
        code: "HF_KEY_MISSING",
        hint: "Añade tu API key en .env. Crea una en https://huggingface.co/settings/tokens (tipo Read). Ver CONFIGURACION.md.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const voiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
    const customText = typeof body.text === "string" ? body.text.trim().slice(0, 200) : null;

    if (!voiceId) {
      return NextResponse.json({ error: "voiceId requerido" }, { status: 400 });
    }

    const voice = getVoiceById(voiceId);
    const lang = voice?.languageCode?.split("-")[0] ?? "en";
    const text = customText || SAMPLE_TEXTS[lang] || SAMPLE_TEXTS.en || DEFAULT_SAMPLE;

    const client = new InferenceClient(key);

    const blob = await client.textToSpeech({
      model: TTS_MODEL,
      inputs: text,
    });

    if (!blob || !(blob instanceof Blob)) {
      return NextResponse.json(
        { error: "Error al generar audio", detail: "Respuesta inválida del modelo" },
        { status: 502 }
      );
    }

    const arrayBuffer = await blob.arrayBuffer();
    const contentType = blob.type || "audio/wav";

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : String(e);
    const is404 = message.includes("404") || message.includes("Not Found");
    const is503 = message.includes("503") || message.includes("loading");
    if (is404) {
      return NextResponse.json(
        {
          error: "Modelo de voz no disponible",
          detail: "El servicio de vista previa de Hugging Face no tiene este modelo disponible en este momento. Puedes probar las voces en el Space Kokoro-TTS.",
          code: "MODEL_UNAVAILABLE",
        },
        { status: 503 }
      );
    }
    if (is503) {
      return NextResponse.json(
        {
          error: "Modelo cargando. Espera un momento y vuelve a intentar.",
          detail: message.slice(0, 200),
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Error al generar vista previa", detail: message.slice(0, 300) },
      { status: 500 }
    );
  }
}
