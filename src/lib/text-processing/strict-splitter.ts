/**
 * Wrapper para el algoritmo de fragmentación estricta (15-21 palabras)
 *
 * Este módulo envuelve la función fragmentarEstricto existente en scriptUtils
 * para mantener compatibilidad con la API del módulo text-processing.
 */

import { fragmentarEstricto } from "@/lib/scriptUtils";
import type { ScriptFragment, StrictSplitOptions } from "./types";
import { DEFAULT_MIN_WORDS, DEFAULT_MAX_WORDS } from "./constants";

/**
 * Fragmenta el guion en escenas de entre minP y maxP palabras,
 * cortando en signos de puntuación [.,;:] cuando sea posible.
 *
 * @param text - El texto del guion a dividir
 * @param options - Opciones de fragmentación (minWords, maxWords)
 * @returns Array de ScriptFragment con id secuencial y texto
 */
export function strictSplit(
  text: string,
  options?: StrictSplitOptions
): ScriptFragment[] {
  // Normalize range: ensure min <= max and valid values
  let minP = options?.minWords ?? DEFAULT_MIN_WORDS;
  let maxP = options?.maxWords ?? DEFAULT_MAX_WORDS;

  // Ensure positive values
  if (minP < 1) minP = 1;
  if (maxP < 1) maxP = 1;
  // Swap if min > max
  if (minP > maxP) {
    const tmp = minP;
    minP = maxP;
    maxP = tmp;
  }

  const fragments = fragmentarEstricto(text, minP, maxP);

  return fragments.map((text, index) => ({
    id: index + 1,
    text,
  }));
}

/**
 * Factory function para crear un divisor estricto con opciones por defecto
 */
export function createStrictSplitter(defaultOptions?: StrictSplitOptions) {
  return (text: string, options?: StrictSplitOptions): ScriptFragment[] => {
    const mergedOptions = {
      ...defaultOptions,
      ...options,
    };
    return strictSplit(text, mergedOptions);
  };
}

/**
 * Retorna la cantidad estimada de fragmentos que resultarían
 * de dividir el texto (para preview sin renderizado visual)
 */
export function previewStrictFragmentCount(
  text: string,
  options?: StrictSplitOptions
): number {
  const fragments = strictSplit(text, options);
  return fragments.length;
}