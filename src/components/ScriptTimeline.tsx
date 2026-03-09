"use client";

import { useRef, useState } from "react";
import { fragmentarEstricto } from "@/lib/scriptUtils";
import { WORDS_PER_MINUTE } from "@/lib/scriptUtils";
import { ImageIcon, Loader2, Mic, GripVertical } from "lucide-react";
import { LocalThumbnailImage } from "@/components/LocalThumbnailImage";
import { LOCAL_URL_PREFIX } from "@/lib/client-storage";
import { cn } from "@/lib/utils";

/** Pixels por segundo en la timeline (ajustable para zoom) */
const PX_PER_SECOND = 80;

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

interface ScriptTimelineProps {
  scriptContent: string;
  sceneImageModelId: string;
  onSceneImageModelChange: (id: string) => void;
  onGenerateScene?: (fragmentIndex: number, text: string) => void;
  onGenerateAllScenes?: () => void;
  sceneImages?: Record<number, { id: string; blobUrl: string }>;
  sceneLoadingIndex?: number | null;
  sceneLoadingAll?: boolean;
  referenceImagePreview?: string | null;
  onReferenceImageChange?: (base64: string | null) => void;
}

export function ScriptTimeline({
  scriptContent,
  sceneImageModelId,
  onSceneImageModelChange,
  onGenerateScene,
  onGenerateAllScenes,
  sceneImages = {},
  sceneLoadingIndex = null,
  sceneLoadingAll = false,
  referenceImagePreview = null,
  onReferenceImageChange,
}: ScriptTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(null);
  const fragmentos = fragmentarEstricto(scriptContent, 15, 21);

  if (fragmentos.length === 0) return null;

  const scenes = fragmentos.map((text, i) => {
    const words = text.split(/\s+/).filter(Boolean).length;
    const durationSec = (words / WORDS_PER_MINUTE) * 60;
    const widthPx = Math.max(120, durationSec * PX_PER_SECOND);
    return {
      index: i,
      text,
      words,
      durationSec,
      widthPx,
      image: sceneImages[i],
    };
  });

  const totalDurationSec = scenes.reduce((acc, s) => acc + s.durationSec, 0);
  const totalWidthPx = scenes.reduce((acc, s) => acc + s.widthPx, 0);

  function handleReferenceFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      onReferenceImageChange?.(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onReferenceImageChange?.(result ?? null);
    };
    reader.readAsDataURL(file);
  }

  const selectedScene = selectedSceneIndex != null ? scenes[selectedSceneIndex] : null;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-[rgb(var(--text-primary))]">
        Guion listo: {fragmentos.length} fragmentos · ~{(totalDurationSec / 60).toFixed(1)} min total
      </p>

      {/* Controles: modelo, imagen de referencia, generar todas */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-[rgb(var(--text-muted))] mb-1">
            Modelo para imagen/video por escena
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

        <div>
          <label className="block text-xs font-medium text-[rgb(var(--text-muted))] mb-1">
            Imagen de referencia (estilo)
          </label>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-sm text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-surface))] transition">
              <input
                type="file"
                accept="image/*"
                onChange={handleReferenceFileChange}
                className="sr-only"
              />
              {referenceImagePreview ? "Cambiar imagen" : "Subir imagen"}
            </label>
            {referenceImagePreview && (
              <div className="relative w-16 h-10 rounded overflow-hidden border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))]">
                <img
                  src={referenceImagePreview}
                  alt="Referencia"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onReferenceImageChange?.(null)}
                  className="absolute top-0 right-0 w-4 h-4 bg-black/60 text-white text-xs flex items-center justify-center rounded-bl"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-[rgb(var(--text-muted))] mt-0.5">
            Las imágenes generadas seguirán este estilo visual
          </p>
        </div>

        {onGenerateAllScenes && (
          <button
            type="button"
            onClick={onGenerateAllScenes}
            disabled={sceneLoadingAll || sceneLoadingIndex != null}
            className="rounded-lg bg-[rgb(var(--accent))] px-4 py-2.5 text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {sceneLoadingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando todas…
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4" />
                Generar todas las escenas
              </>
            )}
          </button>
        )}
      </div>

      {/* Timeline tipo CapCut */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] overflow-hidden">
        {/* Ruler / escala de tiempo */}
        <div className="h-8 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] flex items-center px-6 overflow-x-auto">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-[rgb(var(--text-muted))]">0:00</span>
            {[1, 2, 3, 4, 5].map((m) => {
              const sec = m * 60;
              const left = sec * PX_PER_SECOND;
              return (
                <span
                  key={m}
                  className="text-xs text-[rgb(var(--text-muted))]"
                  style={{ marginLeft: left === 0 ? 0 : left - 24 }}
                >
                  {m}:00
                </span>
              );
            })}
          </div>
        </div>

        {/* Pista de audio (visual) */}
        <div className="h-8 border-b border-[rgb(var(--border))] flex items-center px-4">
          <div className="flex items-center gap-2 shrink-0 mr-4">
            <Mic className="h-4 w-4 text-[rgb(var(--text-muted))]" />
            <span className="text-xs font-medium text-[rgb(var(--text-muted))]">Audio</span>
          </div>
          <div
            className="flex-1 h-4 rounded bg-[rgb(var(--bg-muted))] overflow-hidden"
            style={{ minWidth: totalWidthPx }}
          >
            <div className="h-full flex items-center gap-0.5 px-1">
              {Array.from({ length: Math.min(60, Math.ceil(totalWidthPx / 8)) }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-[rgb(var(--accent))]/60"
                  style={{
                    height: `${30 + Math.sin(i * 0.5) * 40}%`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Pista de escenas */}
        <div className="h-32 border-b border-[rgb(var(--border))] flex items-stretch">
          <div className="flex items-center gap-2 shrink-0 mr-4 px-4 py-2">
            <GripVertical className="h-4 w-4 text-[rgb(var(--text-muted))]" />
            <span className="text-xs font-medium text-[rgb(var(--text-muted))]">Escenas</span>
          </div>
          <div
            ref={scrollRef}
            className="flex-1 overflow-x-auto overflow-y-hidden py-2"
            style={{ minWidth: 0 }}
          >
            <div className="flex gap-1" style={{ minWidth: totalWidthPx }}>
              {scenes.map((scene) => (
                <button
                  key={scene.index}
                  type="button"
                  onClick={() => setSelectedSceneIndex(scene.index)}
                  className={cn(
                    "shrink-0 rounded-lg border-2 overflow-hidden transition-all flex flex-col",
                    selectedSceneIndex === scene.index
                      ? "border-[rgb(var(--accent))] ring-2 ring-[rgb(var(--accent))]/30"
                      : "border-[rgb(var(--border))] hover:border-[rgb(var(--accent))]/50"
                  )}
                  style={{ width: scene.widthPx }}
                >
                  <div className="flex-1 min-h-[72px] bg-[rgb(var(--bg-muted))] flex items-center justify-center overflow-hidden">
                    {sceneLoadingIndex === scene.index ? (
                      <Loader2 className="h-8 w-8 animate-spin text-[rgb(var(--accent))]" />
                    ) : scene.image ? (
                      scene.image.blobUrl.startsWith(LOCAL_URL_PREFIX) ? (
                        <LocalThumbnailImage
                          thumbId={scene.image.id}
                          blobUrl={scene.image.blobUrl}
                          alt={`Escena ${scene.index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={scene.image.blobUrl}
                          alt={`Escena ${scene.index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )
                    ) : (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateScene?.(scene.index, scene.text);
                        }}
                        className="w-full h-full flex flex-col items-center justify-center gap-1 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--bg-surface))] cursor-pointer"
                      >
                        <ImageIcon className="h-6 w-6" />
                        <span className="text-xs">Generar</span>
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-1 bg-[rgb(var(--bg-muted))] text-[10px] text-[rgb(var(--text-muted))] truncate font-medium">
                    #{scene.index + 1} · {scene.durationSec.toFixed(1)}s
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel de detalle de la escena seleccionada */}
        {selectedScene && (
          <div className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <p className="text-xs font-medium text-[rgb(var(--text-muted))] mb-1">
                  Escena {selectedScene.index + 1} · {selectedScene.words} palabras · ~{selectedScene.durationSec.toFixed(1)}s
                </p>
                <p className="text-sm text-[rgb(var(--text-primary))]">{selectedScene.text}</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedScene.image ? (
                  <button
                    type="button"
                    onClick={() => onGenerateScene?.(selectedScene.index, selectedScene.text)}
                    disabled={sceneLoadingIndex === selectedScene.index}
                    className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-3 py-2 text-sm font-medium text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-muted))] disabled:opacity-50 flex items-center gap-2"
                  >
                    {sceneLoadingIndex === selectedScene.index ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Regenerar imagen
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onGenerateScene?.(selectedScene.index, selectedScene.text)}
                    disabled={sceneLoadingIndex === selectedScene.index}
                    className="rounded-lg bg-[rgb(var(--accent))] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                  >
                    {sceneLoadingIndex === selectedScene.index ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                    Generar imagen
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
