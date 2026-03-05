import { v2 as cloudinary } from "cloudinary";
import type { StorageProvider } from "./types";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

export function isCloudinaryConfigured(): boolean {
  return !!(CLOUD_NAME && API_KEY && API_SECRET);
}

export function getCloudinaryStorage(): StorageProvider | null {
  if (!isCloudinaryConfigured()) return null;
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
  });
  return {
    async upload(pathname, body, options) {
      const dataUri = `data:${options?.contentType ?? "image/png"};base64,${body.toString("base64")}`;
      const result = await cloudinary.uploader.upload(dataUri, {
        folder: "scripting-tool",
        public_id: pathname.replace(/\.[^.]+$/, "").replace(/\//g, "_"),
        overwrite: true,
      });
      return { url: result.secure_url };
    },
  };
}
