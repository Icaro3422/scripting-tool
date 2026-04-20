/**
 * @deprecated — Reemplazado por AI33 Pro (src/lib/voices/ai33.ts).
 * Conservado como stub para no romper imports existentes.
 */
export async function synthesize(
  _text: string,
  _options?: { voiceId?: string; lang?: string }
): Promise<ArrayBuffer | null> {
  console.warn("synthesize() is deprecated. Use AI33 Pro TTS via /api/voices/preview.");
  return null;
}
