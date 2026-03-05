/**
 * Preferencias de almacenamiento en el cliente (localStorage + IndexedDB para handle de carpeta).
 * Modo: "cloud" (Cloudinary) | "local" (carpeta en el dispositivo).
 */

export type StorageMode = "cloud" | "local";

const STORAGE_MODE_KEY = "scripting_tool_storage_mode";
const LOCAL_DB_NAME = "scripting_tool_local";
const LOCAL_STORE = "thumbnails"; // thumbId -> { relativePath, fileName }
const LOCAL_DATA_STORE = "thumb_data"; // thumbId -> base64 (para mostrar sin carpeta)

export function getStorageMode(): StorageMode {
  if (typeof window === "undefined") return "cloud";
  const v = localStorage.getItem(STORAGE_MODE_KEY);
  return v === "local" ? "local" : "cloud";
}

export function setStorageMode(mode: StorageMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_MODE_KEY, mode);
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LOCAL_DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(LOCAL_STORE, { keyPath: "thumbId" });
      req.result.createObjectStore(LOCAL_DATA_STORE, { keyPath: "thumbId" });
    };
  });
}

/** Guarda la ruta relativa de una miniatura local (thumbId -> path). */
export async function setLocalThumbPath(thumbId: string, relativePath: string, fileName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, "readwrite");
    tx.objectStore(LOCAL_STORE).put({ thumbId, relativePath, fileName });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Obtiene la ruta relativa de una miniatura local. */
export async function getLocalThumbPath(thumbId: string): Promise<{ relativePath: string; fileName: string } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, "readonly");
    const req = tx.objectStore(LOCAL_STORE).get(thumbId);
    req.onsuccess = () => {
      const r = req.result;
      db.close();
      resolve(r ? { relativePath: r.relativePath, fileName: r.fileName } : null);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

const DIR_HANDLE_KEY = "scripting_tool_dir_handle";
/** Guarda el nombre de la carpeta elegida (el handle no se puede serializar en localStorage; usamos showDirectoryPicker cada vez o pedir permiso). */
export function setLocalFolderName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DIR_HANDLE_KEY, name);
}
export function getLocalFolderName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DIR_HANDLE_KEY);
}

/** Guarda la imagen en base64 para poder mostrarla sin acceso a la carpeta (p. ej. tras recargar). */
export async function setLocalThumbData(thumbId: string, base64: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_DATA_STORE, "readwrite");
    tx.objectStore(LOCAL_DATA_STORE).put({ thumbId, base64 });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Obtiene la imagen en base64 para mostrar (data URL = data:image/png;base64,...). */
export async function getLocalThumbData(thumbId: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_DATA_STORE, "readonly");
    const req = tx.objectStore(LOCAL_DATA_STORE).get(thumbId);
    req.onsuccess = () => {
      const r = req.result;
      db.close();
      resolve(r?.base64 ? `data:image/png;base64,${r.base64}` : null);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export const LOCAL_URL_PREFIX = "local://";
