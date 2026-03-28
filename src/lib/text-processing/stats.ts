/**
 * Utilerías de estadísticas de texto
 */

import type { TextStats } from "./types";
import { WORDS_PER_MINUTE, DEFAULT_MIN_WORDS, DEFAULT_MAX_WORDS } from "./constants";

/**
 * Cuenta palabras y caracteres de un texto
 */
export function countTextStats(text: string): TextStats {
  const trimmed = text.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/u).length;

  return {
    words,
    characters: text.length,
  };
}

/**
 * Cuenta solo palabras (alias para compatibilidad)
 */
export function countWords(text: string): number {
  return countTextStats(text).words;
}

/**
 * Estima duración en minutos basada en palabras (~150 palabras/min para español)
 */
export function estimateMinutes(wordCount: number): number {
  return Math.round((wordCount / WORDS_PER_MINUTE) * 10) / 10;
}

/**
 * Calcula la cantidad de palabras objetivo para una duración en minutos
 */
export function targetWordsForMinutes(minutes: number): number {
  return Math.round(minutes * WORDS_PER_MINUTE);
}

/**
 * Determina si el conteo de palabras cumple con el objetivo (±20% margen)
 */
export function isTargetMet(wordCount: number, targetMinutes: number): boolean {
  const targetWords = targetWordsForMinutes(targetMinutes);
  const margin = targetWords * 0.2;
  return (
    wordCount >= targetWords - margin && wordCount <= targetWords + margin
  );
}

/**
 * Obtiene el rango de palabras por escena (clamp dentro de rangos válidos)
 */
export function getStrictWordRange(options?: {
  minWords?: number;
  maxWords?: number;
}): { minWords: number; maxWords: number } {
  const minWords = Math.max(5, Math.min(25, options?.minWords ?? DEFAULT_MIN_WORDS));
  const maxWords = Math.max(10, Math.min(30, options?.maxWords ?? DEFAULT_MAX_WORDS));

  // Asegurar que min <= max
  return {
    minWords: Math.min(minWords, maxWords),
    maxWords: Math.max(minWords, maxWords),
  };
}

// Re-export de constantes útiles
export { WORDS_PER_MINUTE, DEFAULT_MIN_WORDS, DEFAULT_MAX_WORDS } from "./constants";