/** Modo de almacenamiento: nube (Cloudinary) o local (carpeta en el dispositivo) */
export type StorageMode = "cloud" | "local";

export interface StorageUploadResult {
  url: string;
}

export interface StorageProvider {
  upload(pathname: string, body: Buffer, options?: { contentType?: string }): Promise<StorageUploadResult>;
}
