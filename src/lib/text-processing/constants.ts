/**
 * Constantes para el módulo de procesamiento de texto
 */

// ============================================================================
// Estilos de Imagen
// ============================================================================

export const IMAGE_STYLES = [
  "Fotorrealista",
  "Animacion 3D",
  "Anime/Manga",
  "Arte Conceptual",
  "Cinematico",
  "Comic",
  "Acuarela",
] as const;

export type ImageStyle = (typeof IMAGE_STYLES)[number];

// ============================================================================
// Delimitadores para División Inteligente
// ============================================================================

/**
 * Delimitadores donde se puede cortar el texto naturalmente
 */
export const CUT_DELIMITERS = [". ", "\n"] as const;

/**
 * Ventana de búsqueda alrededor del corte ideal (en caracteres)
 */
export const SEARCH_WINDOW = 160;

// ============================================================================
// Configuración de Duración
// ============================================================================

/**
 * Palabras por minuto al narrar (referencia para español)
 * Re-exported from scriptUtils to centralize the constant
 */
export { WORDS_PER_MINUTE } from "@/lib/scriptUtils";

/**
 * Rango de palabras por escena (para método strict)
 */
export const DEFAULT_MIN_WORDS = 15;
export const DEFAULT_MAX_WORDS = 21;