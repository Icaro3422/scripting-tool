/**
 * Export utilities for prompt results
 *
 * Provides JSON and CSV export functionality for generated image prompts.
 */

import type { PromptResult } from "./types";

/**
 * Exports prompt results as formatted JSON
 */
export function toJsonExport(results: PromptResult[]): string {
  return JSON.stringify(results, null, 2);
}

/**
 * Escapes a CSV value by wrapping in quotes and escaping internal quotes
 */
function escapeCsvValue(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Exports prompt results as CSV with headers
 */
export function toCsvExport(results: PromptResult[]): string {
  const header = ["fragment_id", "original_text", "image_prompt"].join(",");
  const rows = results.map((item) =>
    [
      String(item.fragment_id),
      escapeCsvValue(item.original_text),
      escapeCsvValue(item.image_prompt),
    ].join(",")
  );
  return `\ufeff${[header, ...rows].join("\n")}`;
}

/**
 * Triggers a browser download of the given content as a file
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  requestAnimationFrame(() => {
    URL.revokeObjectURL(url);
  });
}
