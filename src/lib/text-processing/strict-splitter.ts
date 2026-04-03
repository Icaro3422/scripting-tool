/**
 * Wrapper for strict fragmentation algorithm (15-21 words)
 *
 * This module wraps the fragmentarEstricto function from scriptUtils
 * to maintain compatibility with the text-processing module API.
 */

import { fragmentarEstricto } from "@/lib/scriptUtils";
import type { ScriptFragment, StrictSplitOptions } from "./types";
import { DEFAULT_MIN_WORDS, DEFAULT_MAX_WORDS } from "./constants";

/**
 * Splits the script into scenes with between minP and maxP words,
 * cutting on punctuation marks [.,;:] when possible.
 *
 * @param text - The script text to split
 * @param options - Fragmentation options (minWords, maxWords)
 * @returns Array of ScriptFragment with sequential id and text
 */
export function strictSplit(
  text: string,
  options?: StrictSplitOptions
): ScriptFragment[] {
  // Normalize range: ensure integers, positive, and min <= max
  let minP = Math.floor(options?.minWords ?? DEFAULT_MIN_WORDS);
  let maxP = Math.floor(options?.maxWords ?? DEFAULT_MAX_WORDS);

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

  return fragments.map((fragmentText, index) => ({
    id: index + 1,
    text: fragmentText,
  }));
}

/**
 * Factory function to create a strict splitter with default options
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
 * Returns the estimated number of fragments that would result
 * from splitting the text. Uses full splitting algorithm.
 */
export function previewStrictFragmentCount(
  text: string,
  options?: StrictSplitOptions
): number {
  const fragments = strictSplit(text, options);
  return fragments.length;
}
