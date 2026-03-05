"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone, Monitor } from "lucide-react";

export function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<{ prompt: () => Promise<{ outcome: string }> } | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as { prompt: () => Promise<{ outcome: string }> });
    };
    window.addEventListener("beforeinstallprompt", handler);
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as unknown as { standalone?: boolean }).standalone) {
      setInstalled(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (deferredPrompt) {
      const { outcome } = await deferredPrompt.prompt();
      if (outcome === "accepted") setInstalled(true);
      return;
    }
    setShowInstructions(true);
  }

  if (installed) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-4 py-2.5 text-sm font-medium text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-muted))] transition"
      >
        <Download className="h-4 w-4" />
        Instalar app
      </button>

      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowInstructions(false)}>
          <div
            className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[rgb(var(--text-primary))]">Cómo instalar la app</h3>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="p-1 rounded text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--bg-muted))]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-[rgb(var(--text-secondary))] mb-4">
              Tu navegador no mostró el diálogo de instalación. Puedes instalar manualmente:
            </p>
            <ul className="space-y-3 text-sm text-[rgb(var(--text-primary))]">
              <li className="flex gap-3">
                <Monitor className="h-5 w-5 shrink-0 text-[rgb(var(--accent))]" />
                <span><strong>Chrome o Edge (escritorio):</strong> Menú ⋮ (arriba a la derecha) → <strong>Instalar Scripting Tool</strong> o &quot;Aplicación disponible&quot;.</span>
              </li>
              <li className="flex gap-3">
                <Smartphone className="h-5 w-5 shrink-0 text-[rgb(var(--accent))]" />
                <span><strong>Safari (iPhone/iPad):</strong> Botón <strong>Compartir</strong> → <strong>Añadir a la pantalla de inicio</strong>.</span>
              </li>
              <li className="flex gap-3">
                <Smartphone className="h-5 w-5 shrink-0 text-[rgb(var(--accent))]" />
                <span><strong>Chrome (Android):</strong> Menú ⋮ → <strong>Instalar app</strong> o &quot;Añadir a la pantalla de inicio&quot;.</span>
              </li>
            </ul>
            <p className="text-xs text-[rgb(var(--text-muted))] mt-4">
              Si no ves la opción, usa la app en el navegador; funciona igual. Asegúrate de estar en <strong>HTTPS</strong> para que la instalación esté disponible.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
