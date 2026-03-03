/**
 * Hugging Face TTS (Text-to-Speech).
 * Modelos sugeridos: microsoft/speecht5_tts, suno/bark, tts-hub/XTTS-v2.
 * Uso: obtener HUGGINGFACE_API_KEY desde https://huggingface.co/settings/tokens
 * y llamar a la Inference API o usar este módulo para futura integración.
 */

const HF_INFERENCE_TTS = "https://api-inference.huggingface.co/models/microsoft/speecht5_tts";

export async function synthesize(
  _text: string,
  _options?: { voiceId?: string; lang?: string }
): Promise<ArrayBuffer | null> {
  const token = process.env.HUGGINGFACE_API_KEY;
  if (!token) {
    console.warn("HUGGINGFACE_API_KEY no configurada");
    return null;
  }
  // TODO: implementar llamada a Inference API
  // const res = await fetch(HF_INFERENCE_TTS, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ inputs: text }) });
  // return res.arrayBuffer();
  return null;
}
