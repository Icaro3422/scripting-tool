import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Extrae ID de canal de YouTube desde URL o handle */
export function parseYoutubeChannelId(input: string): string | null {
  const trimmed = input.trim();
  // UC... (21 chars)
  if (/^UC[\w-]{21}$/.test(trimmed)) return trimmed;
  // youtube.com/channel/UC...
  const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]{21})/);
  if (channelMatch) return channelMatch[1];
  // youtube.com/@handle -> necesitaríamos API para resolver; por ahora devolvemos null y el backend puede usar search
  const handleMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/);
  if (handleMatch) return handleMatch[1]; // guardamos como "handle" y en API resolvemos
  return null;
}
