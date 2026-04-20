export const OPERATION_LABELS: Record<string, string> = {
  script: "Guion / Título / Descripción / Tags",
  thumbnail: "Miniatura",
  "scene-image": "Imagen de escena",
  "channel-analyze": "Análisis de canal",
};

export const usdFmt = new Intl.NumberFormat("es", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function formatUsdFromInternalCents(cents: number): string {
  return usdFmt.format(cents / 100);
}

export function extractActivityRows(payload: unknown): Record<string, unknown>[] | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
  if (Array.isArray(o)) return o as Record<string, unknown>[];
  return null;
}

export function formatCellValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
