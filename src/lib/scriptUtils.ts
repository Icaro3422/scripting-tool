/** Palabras por minuto al narrar en español (referencia para duración del video) */
export const WORDS_PER_MINUTE = 150;

export const DURATION_PRESETS = [
  { id: "1", label: "Short (≈1 min)", minutes: 1 },
  { id: "3", label: "≈3 min", minutes: 3 },
  { id: "5", label: "≈5 min", minutes: 5 },
  { id: "10", label: "≈10 min", minutes: 10 },
  { id: "15", label: "≈15 min", minutes: 15 },
  { id: "30", label: "≈30 min", minutes: 30 },
  { id: "60", label: "≈1 hora", minutes: 60 },
] as const;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function estimatedMinutes(wordCount: number): number {
  return Math.round((wordCount / WORDS_PER_MINUTE) * 10) / 10;
}

export function targetWordsForMinutes(minutes: number): number {
  return Math.round(minutes * WORDS_PER_MINUTE);
}

/** Si el script está dentro del ±20% del objetivo consideramos que cumple */
export function isTargetMet(wordCount: number, targetMinutes: number): boolean {
  const targetWords = targetWordsForMinutes(targetMinutes);
  const margin = targetWords * 0.2;
  return wordCount >= targetWords - margin && wordCount <= targetWords + margin;
}

/** Tokens máximos recomendados para generar un guion (≈1.5 tokens/palabra, margen x2, cap 32k) */
export function maxTokensForScriptMinutes(minutes: number): number {
  const targetWords = targetWordsForMinutes(minutes);
  const estimated = Math.ceil(targetWords * 1.5);
  return Math.min(32768, Math.max(4096, estimated * 2));
}

/**
 * Fragmenta el guion en escenas de entre min_p y max_p palabras, cortando en signos de puntuación [.,;:]
 * cuando sea posible (port de la lógica Python fragmentar_estricto_21).
 */
export function fragmentarEstricto(
  texto: string,
  minP: number = 15,
  maxP: number = 21
): string[] {
  const normalized = texto.replace(/\s+/g, " ").trim();
  const palabras = normalized.split(" ").filter(Boolean);
  const fragmentos: string[] = [];
  let inicio = 0;

  while (inicio < palabras.length) {
    if (palabras.length - inicio <= maxP) {
      fragmentos.push(palabras.slice(inicio).join(" "));
      break;
    }

    const ventanaInicio = inicio + minP;
    const ventanaFin = inicio + maxP;
    const subTextoVentana = palabras.slice(ventanaInicio, ventanaFin).join(" ");
    const regex = /[.,;:]/g;
    let match: RegExpExecArray | null;
    const matches: RegExpExecArray[] = [];
    while ((match = regex.exec(subTextoVentana)) !== null) matches.push(match);

    if (matches.length > 0) {
      const ultimoSigno = matches[matches.length - 1];
      const endPos = ultimoSigno.index + (ultimoSigno[0]?.length ?? 0);
      const textoHastaSigno = subTextoVentana.slice(0, endPos);
      const palabrasHastaSigno = textoHastaSigno.split(" ").filter(Boolean);
      let corteFinal = ventanaInicio + palabrasHastaSigno.length;
      if (corteFinal > inicio + maxP) corteFinal = inicio + maxP;
      const segmento = palabras.slice(inicio, corteFinal);
      fragmentos.push(segmento.join(" "));
      inicio += segmento.length;
    } else {
      const segmento = palabras.slice(inicio, ventanaFin);
      fragmentos.push(segmento.join(" "));
      inicio += segmento.length;
    }
  }

  return fragmentos;
}
