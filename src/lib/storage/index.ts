import type { StorageMode } from "./types";
import { getCloudinaryStorage, isCloudinaryConfigured } from "./cloudinary";

export type { StorageMode, StorageProvider, StorageUploadResult } from "./types";
export { isCloudinaryConfigured, getCloudinaryStorage } from "./cloudinary";

/**
 * Obtiene el proveedor de almacenamiento para el modo dado.
 * - cloud: Cloudinary (requiere env CLOUDINARY_*)
 * - local: no hay upload en servidor; el cliente guarda en su carpeta.
 */
export function getStorageProvider(mode: StorageMode): ReturnType<typeof getCloudinaryStorage> {
  if (mode === "cloud") return getCloudinaryStorage();
  return null;
}

export function getStorageAvailability(): {
  cloud: boolean;
  local: boolean;
} {
  return {
    cloud: isCloudinaryConfigured(),
    local: true, // Siempre disponible en el cliente (File System Access API)
  };
}
