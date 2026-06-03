/**
 * Tipos para el módulo de procesamiento de texto
 */

import type { ImageStyle } from "./constants";

// ============================================================================
// Fragmentos de Guion
// ============================================================================

export interface ScriptFragment {
  id: number;
  text: string;
}

// ============================================================================
// Estadísticas de Texto
// ============================================================================

export interface TextStats {
  words: number;
  characters: number;
}

// ============================================================================
// Generación de Prompts de Imagen
// ============================================================================

export interface GenerateRequestFragment {
  id: number;
  text: string;
}

export interface GenerateRequestBody {
  fragments: GenerateRequestFragment[];
  style: ImageStyle;
}

export interface PromptResult {
  fragment_id: number;
  original_text: string;
  image_prompt: string;
  provider?: string;
  model?: string;
}

export interface GenerateResponseBody {
  results: PromptResult[];
}

// ============================================================================
// Opciones de División
// ============================================================================

export interface StrictSplitOptions {
  minWords?: number;
  maxWords?: number;
}

export type SplitMethod = "strict" | "count";

export interface SplitConfigState {
  method: SplitMethod;
  targetChunks: number;
  strictMinWords: number;
  strictMaxWords: number;
}