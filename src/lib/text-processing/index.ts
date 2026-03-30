/**
 * Módulo de Procesamiento de Texto
 *
 * Funciones para fragmentación de guiones, estadísticas y generación de prompts.
 *
 * @example
 * ```typescript
 * import { splitScriptIntelligently, countWords, IMAGE_STYLES } from "@/lib/text-processing";
 *
 * const fragments = splitScriptIntelligently(miGuion, 10);
 * const palabras = countWords(miGuion);
 * ```
 */

// ============================================================================
// Tipos
// ============================================================================

// Real imports for internal usage
import type { ScriptFragment, SplitMethod } from "./types";
import { strictSplit } from "./strict-splitter";
import { splitScriptIntelligently } from "./splitter";

export type {
  ScriptFragment,
  TextStats,
  PromptResult,
  GenerateRequestFragment,
  GenerateRequestBody,
  GenerateResponseBody,
  StrictSplitOptions,
  SplitMethod,
} from "./types";

// ============================================================================
// Constantes
// ============================================================================

export { IMAGE_STYLES, CUT_DELIMITERS, SEARCH_WINDOW } from "./constants";
export type { ImageStyle } from "./constants";

export {
  WORDS_PER_MINUTE,
  DEFAULT_MIN_WORDS,
  DEFAULT_MAX_WORDS,
} from "./constants";

// ============================================================================
// Utilerías de Estadísticas
// ============================================================================

export {
  countTextStats,
  countWords,
  estimateMinutes,
  targetWordsForMinutes,
  isTargetMet,
  getStrictWordRange,
} from "./stats";

// ============================================================================
// Funciones de División
// ============================================================================

export { splitScriptIntelligently, previewFragmentCount } from "./splitter";
export {
  strictSplit,
  createStrictSplitter,
  previewStrictFragmentCount,
} from "./strict-splitter";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Divide el texto usando el método especificado
 */
export function splitByMethod(
  text: string,
  method: "strict" | "count",
  options?: {
    minWords?: number;
    maxWords?: number;
    targetChunks?: number;
  }
): ScriptFragment[] {
  if (method === "strict") {
    return strictSplit(text, {
      minWords: options?.minWords,
      maxWords: options?.maxWords,
    });
  }

  return splitScriptIntelligently(text, options?.targetChunks ?? 10);
}

// ============================================================================
// Re-export.helpers existentes (para compatibilidad)
// ============================================================================

// Re-export de fragmentarEstricto para casos de uso directo
// Nota: Se puede importar directamente desde @/lib/scriptUtils
// export { fragmentarEstricto } from "@/lib/scriptUtils";