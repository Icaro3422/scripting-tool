"use client";

import { useState } from "react";
import { fragmentarEstricto } from "@/lib/scriptUtils";
import { ImageIcon, Copy, Check, Loader2 } from "lucide-react";
import { LocalThumbnailImage } from "@/components/LocalThumbnailImage";
import { LOCAL_URL_PREFIX } from "@/lib/client-storage";

const BLOCK_SIZE = 5;

export interface SceneImageModel {
  id: string;
  name: string;
}

const SCENE_IMAGE_MODELS: SceneImageModel[] = [
  { id: "black-forest-labs/flux.2-pro", name: "FLUX 2 Pro (imagen)" },
  { id: "black-forest-labs/flux-1.1-pro", name: "FLUX 1.1 Pro (imagen)" },
  { id: "google/gemini-2.5-flash-image", name: "Nano Banana (Gemini 2.5 Flash Image)" },
  { id: "google/gemini-2.5-flash-image-preview:free", name: "Nano Banana (gratis)" },
  { id: "x-ai/grok-2-vision-1212", name: "Grok 2 Vision (imagen)" },
];

interface ScriptFragmentsTableProps {
  scriptContent: string;
  sceneImageModelId: string;
  onSceneImageModelChange: (id: string) => void;
  onGenerateScene?: (fragmentIndex: number, text: string) => void;
  /** Imágenes ya generadas por índice de fragmento (0-based) */
  sceneImages?: Record<number, { id: string; blobUrl: string }>;
  /** Índice del fragmento para el que se está generando imagen (muestra loading) */
  sceneLoadingIndex?: number | null;
}

export function ScriptFragmentsTable({
  scriptContent,
  sceneImageModelId,
  onSceneImageModelChange,
  onGenerateScene,
  sceneImages = {},
  sceneLoadingIndex = null,
}: ScriptFragmentsTableProps) {
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [previewSceneIndex, setPreviewSceneIndex] = useState<number | null>(null);
  const fragmentos = fragmentarEstricto(scriptContent, 15, 21);

  function handleCopyBlock(from: number, to: number) {
    const lines = fragmentos.slice(from - 1, to).map((t, i) => `${from + i}. ${t}`);
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedBlock(from);
      setTimeout(() => setCopiedBlock(null), 1500);
    });
  }

  if (fragmentos.length === 0) return null;

  const rows: { index: number; text: string; words: number; showCopyButton: boolean; copyFrom: number; copyTo: number }[] = [];
  for (let i = 0; i < fragmentos.length; i++) {
    const text = fragmentos[i];
    const words = text.split(/\s+/).filter(Boolean).length;
    const esUltimoDelBloque = (i + 1) % BLOCK_SIZE === 0;
    const esFinalAbsoluto = i === fragmentos.length - 1;
    const showCopyButton = esUltimoDelBloque || esFinalAbsoluto;
    const copyFrom = Math.floor(i / BLOCK_SIZE) * BLOCK_SIZE + 1;
    const copyTo = i + 1;
    rows.push({
      index: i + 1,
      text,
      words,
      showCopyButton,
      copyFrom,
      copyTo,
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-[rgb(var(--text-primary))]">
        Guion listo: {fragmentos.length} fragmentos.
      </p>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="text-xs font-medium text-[rgb(var(--text-muted))]">
          Modelo para imagen/video por escena:
        </label>
        <select
          value={sceneImageModelId}
          onChange={(e) => onSceneImageModelChange(e.target.value)}
          className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
        >
          {SCENE_IMAGE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-xl border border-[rgb(var(--border))] overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[rgb(var(--bg-muted))] border-b border-[rgb(var(--border))]">
              <th className="text-left py-3 px-4 font-medium text-[rgb(var(--text-primary))] w-12">#</th>
              <th className="text-left py-3 px-4 font-medium text-[rgb(var(--text-primary))]">Texto del fragmento</th>
              <th className="text-left py-3 px-4 font-medium text-[rgb(var(--text-primary))] w-20">Palabras</th>
              <th className="text-left py-3 px-4 font-medium text-[rgb(var(--text-primary))] w-32">Copiar bloque</th>
              <th className="text-left py-3 px-4 font-medium text-[rgb(var(--text-primary))] w-36">Generar escena</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.index}
                className={`border-b border-[rgb(var(--border))] ${(i + 1) % BLOCK_SIZE === 0 ? "border-b-2 border-[rgb(var(--accent))]" : ""}`}
              >
                <td className="py-2.5 px-4 text-[rgb(var(--text-muted))]">{row.index}</td>
                <td className="py-2.5 px-4 text-[rgb(var(--text-primary))]">{row.text}</td>
                <td className="py-2.5 px-4 text-[rgb(var(--text-muted))] font-medium">{row.words}</td>
                <td className="py-2.5 px-4">
                  {row.showCopyButton && (
                    <button
                      type="button"
                      onClick={() => handleCopyBlock(row.copyFrom, row.copyTo)}
                      className="w-full flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold bg-[rgb(var(--accent))] text-white hover:opacity-90 transition"
                    >
                      {copiedBlock === row.copyFrom ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedBlock === row.copyFrom ? "Copiado" : `Copiar bloque (${row.copyFrom}-${row.copyTo})`}
                    </button>
                  )}
                </td>
                <td className="py-2.5 px-4">
                  {sceneLoadingIndex === row.index - 1 ? (
                    <div className="flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs text-[rgb(var(--text-muted))]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generando…
                    </div>
                  ) : sceneImages[row.index - 1] ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewSceneIndex(row.index - 1)}
                        className="w-20 h-12 rounded overflow-hidden border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] shrink-0 hover:ring-2 hover:ring-[rgb(var(--accent))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
                      >
                        {sceneImages[row.index - 1].blobUrl.startsWith(LOCAL_URL_PREFIX) ? (
                          <LocalThumbnailImage
                            thumbId={sceneImages[row.index - 1].id}
                            blobUrl={sceneImages[row.index - 1].blobUrl}
                            alt={`Escena ${row.index}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={sceneImages[row.index - 1].blobUrl}
                            alt={`Escena ${row.index}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onGenerateScene?.(row.index - 1, row.text)}
                        className="rounded px-2 py-1 text-xs font-medium border border-[rgb(var(--border))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-muted))]"
                      >
                        Regenerar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onGenerateScene?.(row.index - 1, row.text)}
                      className="flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium border border-[rgb(var(--border))] text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-muted))] transition"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Generar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal preview al hacer clic en la imagen de la escena */}
      {previewSceneIndex != null && sceneImages[previewSceneIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewSceneIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de la escena"
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-white/90 mb-2">Escena {previewSceneIndex + 1}</p>
            <div className="rounded-lg overflow-hidden border-2 border-white/20 shadow-2xl bg-[rgb(var(--bg-muted))]">
              {sceneImages[previewSceneIndex].blobUrl.startsWith(LOCAL_URL_PREFIX) ? (
                <LocalThumbnailImage
                  thumbId={sceneImages[previewSceneIndex].id}
                  blobUrl={sceneImages[previewSceneIndex].blobUrl}
                  alt={`Escena ${previewSceneIndex + 1}`}
                  className="max-w-full max-h-[80vh] w-auto h-auto object-contain"
                />
              ) : (
                <img
                  src={sceneImages[previewSceneIndex].blobUrl}
                  alt={`Escena ${previewSceneIndex + 1}`}
                  className="max-w-full max-h-[80vh] w-auto h-auto object-contain"
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => setPreviewSceneIndex(null)}
              className="mt-3 px-4 py-2 rounded-lg bg-white/20 text-white text-sm font-medium hover:bg-white/30"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
