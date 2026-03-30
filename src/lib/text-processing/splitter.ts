/**
 * Algoritmos de división de script
 *
 * splitScriptIntelligently: divide el guion en N fragmentos buscando cortes naturales
 */

import type { ScriptFragment } from "./types";
import { CUT_DELIMITERS, SEARCH_WINDOW } from "./constants";

// ============================================================================
// Utilidades Internas
// ============================================================================

/**
 * Clampa un valor entre un mínimo y máximo
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Encuentra el mejor índice de corte en la vecindad del índice ideal
 */
function findBestSplitIndex(text: string, idealIndex: number): number {
  const safeIdeal = clamp(idealIndex, 1, text.length - 1);
  const start = clamp(safeIdeal - SEARCH_WINDOW, 1, text.length - 1);
  const end = clamp(safeIdeal + SEARCH_WINDOW, 1, text.length - 1);

  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  // Buscar en delimitadores primarios
  for (const delimiter of CUT_DELIMITERS) {
    let cursor = start;

    while (cursor <= end) {
      const foundAt = text.indexOf(delimiter, cursor);
      if (foundAt === -1 || foundAt > end) {
        break;
      }

      const cutIndex = foundAt + delimiter.length;
      const distance = Math.abs(cutIndex - safeIdeal);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = cutIndex;
      }

      cursor = foundAt + delimiter.length;
    }
  }

  // Si encontró delimitador, usarlo
  if (bestIndex !== -1) {
    return bestIndex;
  }

  // Fallback: buscar whitespace
  let fallback = safeIdeal;
  while (fallback < text.length - 1 && !/\s/.test(text[fallback] ?? "")) {
    fallback += 1;
  }
  if (fallback < text.length - 1) {
    return fallback;
  }

  fallback = safeIdeal;
  while (fallback > 1 && !/\s/.test(text[fallback] ?? "")) {
    fallback -= 1;
  }

  return clamp(fallback, 1, text.length - 1);
}

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Divide el guion en fragmentos de tamaño aproximadamente igual.
 *
 * Busca puntos naturales de corte (. o \n) dentro de una ventana alrededor
 * del tamaño ideal de cada chunk.
 *
 * @param rawText - El texto del guion a dividir
 * @param chunkCount - Número aproximado de fragmentos deseados
 * @returns Array de ScriptFragment con id secuencial y texto
 */
export function splitScriptIntelligently(
  rawText: string,
  chunkCount: number
): ScriptFragment[] {
  const text = rawText.trim();
  if (!text) {
    return [];
  }

  // Validar y clampear número de chunks
  const targetChunks = clamp(Math.floor(chunkCount), 1, 200);

  // Casos especiales: texto muy corto o solo 1 chunk
  if (targetChunks === 1 || text.length < 40) {
    return [{ id: 1, text }];
  }

  const fragments: ScriptFragment[] = [];
  let cursor = 0;

  for (let index = 0; index < targetChunks && cursor < text.length; index += 1) {
    const remainingChars = text.length - cursor;
    const remainingChunks = targetChunks - index;

    // Si es el último chunk, tomar todo lo que queda
    if (remainingChunks <= 1) {
      fragments.push({
        id: fragments.length + 1,
        text: text.slice(cursor).trim(),
      });
      break;
    }

    // Calcular tamaño ideal para este fragmento
    const idealSize = Math.ceil(remainingChars / remainingChunks);
    const idealIndex = cursor + idealSize;

    // Si ya llegamos al final del texto
    if (idealIndex >= text.length) {
      fragments.push({
        id: fragments.length + 1,
        text: text.slice(cursor).trim(),
      });
      break;
    }

    // Buscar el mejor punto de corte
    const localSlice = text.slice(cursor);
    const localSplit = findBestSplitIndex(localSlice, idealSize);
    const absoluteSplit = cursor + localSplit;

    // Extraer el fragmento
    const fragmentText = text.slice(cursor, absoluteSplit).trim();
    if (fragmentText.length > 0) {
      fragments.push({
        id: fragments.length + 1,
        text: fragmentText,
      });
    }

    cursor = absoluteSplit;
  }

  // Filtrar fragmentos vacíos
  return fragments.filter((fragment) => fragment.text.length > 0);
}

/**
 * Retorna el número de fragmentos que resultarían de dividir el texto
 * (sin crear los fragmentos reales, para preview)
 */
export function previewFragmentCount(
  rawText: string,
  chunkCount: number
): number {
  const fragments = splitScriptIntelligently(rawText, chunkCount);
  return fragments.length;
}