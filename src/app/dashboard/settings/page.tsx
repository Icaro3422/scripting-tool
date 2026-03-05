"use client";

import { useEffect, useState } from "react";
import { getStorageMode, setStorageMode, getLocalFolderName, setLocalFolderName } from "@/lib/client-storage";
import type { StorageMode } from "@/lib/client-storage";
import { Settings, Cloud, HardDrive, FolderOpen } from "lucide-react";

export default function SettingsPage() {
  const [storageMode, setModeState] = useState<StorageMode>("cloud");
  const [availability, setAvailability] = useState<{ cloud: boolean; local: boolean }>({ cloud: false, local: true });
  const [localFolderName, setLocalFolderNameState] = useState<string | null>(null);
  const [pickingFolder, setPickingFolder] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setModeState(getStorageMode());
    setLocalFolderNameState(getLocalFolderName());
    fetch("/api/settings/storage")
      .then((r) => r.json())
      .then(setAvailability)
      .catch(() => setAvailability({ cloud: false, local: true }));
  }, []);

  function handleModeChange(mode: StorageMode) {
    setStorageMode(mode);
    setModeState(mode);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handlePickFolder() {
    if (typeof window === "undefined" || !("showDirectoryPicker" in window)) {
      alert("Tu navegador no soporta la selección de carpeta (File System Access API). Usa Chrome o Edge.");
      return;
    }
    setPickingFolder(true);
    try {
      const picker = (window as unknown as { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
      const handle = await picker!();
      setLocalFolderName(handle.name);
      setLocalFolderNameState(handle.name);
      setStorageMode("local");
      (window as unknown as { __scriptingToolDirHandle?: FileSystemDirectoryHandle }).__scriptingToolDirHandle = handle;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.error(e);
    } finally {
      setPickingFolder(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))] mb-2 flex items-center gap-2">
        <Settings className="h-6 w-6" />
        Configuración
      </h1>
      <p className="text-[rgb(var(--text-secondary))] mb-8">
        Elige dónde guardar las miniaturas y los datos: en la nube (Cloudinary) o en tu computadora.
      </p>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-[rgb(var(--text-primary))]">
          Almacenamiento
        </h2>

        <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] divide-y divide-[rgb(var(--border))]">
          <label className="flex items-start gap-4 p-4 cursor-pointer hover:bg-[rgb(var(--bg-muted))] transition">
            <input
              type="radio"
              name="storage"
              checked={storageMode === "cloud"}
              onChange={() => handleModeChange("cloud")}
              disabled={!availability.cloud}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-[rgb(var(--accent))]" />
                <span className="font-medium text-[rgb(var(--text-primary))]">Nube (Cloudinary)</span>
              </div>
              <p className="text-sm text-[rgb(var(--text-muted))] mt-1">
                Las miniaturas se suben a tu cuenta de Cloudinary. Necesitas configurar las variables de entorno en el servidor.
              </p>
              {!availability.cloud && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  Cloudinary no está configurado (CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET en .env).
                </p>
              )}
            </div>
          </label>

          <label className="flex items-start gap-4 p-4 cursor-pointer hover:bg-[rgb(var(--bg-muted))] transition">
            <input
              type="radio"
              name="storage"
              checked={storageMode === "local"}
              onChange={() => handleModeChange("local")}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-[rgb(var(--accent))]" />
                <span className="font-medium text-[rgb(var(--text-primary))]">Local (en este dispositivo)</span>
              </div>
              <p className="text-sm text-[rgb(var(--text-muted))] mt-1">
                Las miniaturas se guardan en una carpeta de tu computadora. Solo tú tienes acceso.
              </p>
              {storageMode === "local" && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePickFolder}
                    disabled={pickingFolder}
                    className="inline-flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-base))] px-3 py-2 text-sm font-medium text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-muted))] disabled:opacity-50"
                  >
                    <FolderOpen className="h-4 w-4" />
                    {localFolderName ? `Carpeta: ${localFolderName}` : "Seleccionar carpeta"}
                  </button>
                </div>
              )}
            </div>
          </label>
        </div>

        {saved && (
          <p className="text-sm text-green-600 dark:text-green-400">Preferencia guardada.</p>
        )}
      </section>

      <p className="text-sm text-[rgb(var(--text-muted))] mt-8">
        Puedes cambiar entre modos en cualquier momento. Los proyectos ya creados seguirán mostrando sus miniaturas desde donde se guardaron.
      </p>
    </div>
  );
}
