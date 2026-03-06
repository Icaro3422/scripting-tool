"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, X, Smartphone, Monitor, Loader2 } from "lucide-react";

type DeferredPrompt = { prompt: () => Promise<{ outcome: string }> };

declare global {
  interface Window {
    __deferredInstallPrompt?: DeferredPrompt;
  }
}

export function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);

  useEffect(() => {
    const win = typeof window === "undefined" ? null : window;
    if (!win) return;
    if (win.matchMedia("(display-mode: standalone)").matches || (win.navigator as unknown as { standalone?: boolean }).standalone) {
      setInstalled(true);
      return;
    }
    const stored = win.__deferredInstallPrompt;
    if (stored) setDeferredPrompt(stored);
    const handler = (e: Event) => {
      e.preventDefault();
      const p = e as unknown as DeferredPrompt;
      win.__deferredInstallPrompt = p;
      setDeferredPrompt(p);
    };
    win.addEventListener("beforeinstallprompt", handler);
    return () => win.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = deferredPrompt ?? (typeof window !== "undefined" ? window.__deferredInstallPrompt : null);
    if (prompt) {
      setIsPrompting(true);
      try {
        const { outcome } = await prompt.prompt();
        if (outcome === "accepted") setInstalled(true);
      } catch {
        setShowInstructions(true);
      } finally {
        setIsPrompting(false);
      }
      return;
    }
    setShowInstructions(true);
  }, [deferredPrompt]);

  if (installed) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        disabled={isPrompting}
        className="inline-flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-4 py-2.5 text-sm font-medium text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-muted))] transition disabled:opacity-70 disabled:pointer-events-none"
      >
        {isPrompting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {isPrompting ? "Abriendo instalación…" : "Instalar app"}
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
              {deferredPrompt ? "Si no se abrió el diálogo, instala desde el menú del navegador:" : "En este navegador la instalación se hace desde el menú:"}
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
              Usa <strong>HTTPS</strong>. Si no ves la opción, la app funciona igual en el navegador.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
