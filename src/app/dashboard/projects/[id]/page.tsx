"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Type,
  AlignLeft,
  Image as ImageIcon,
  Loader2,
  ChevronLeft,
  Sparkles,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AI_MODELS, SCRIPT_RECOMMENDED_IDS, THUMBNAIL_IMAGE_MODELS } from "@/types/ai";
import { DURATION_PRESETS, countWords, estimatedMinutes } from "@/lib/scriptUtils";
import { ScriptFragmentsTable } from "@/components/ScriptFragmentsTable";
import { getStorageMode, setLocalThumbPath, setLocalThumbData, getLocalFolderName, setLocalFolderName, LOCAL_URL_PREFIX } from "@/lib/client-storage";
import { LocalThumbnailImage } from "@/components/LocalThumbnailImage";
import { LocalThumbnailWithPath } from "@/components/LocalThumbnailWithPath";

interface AIModelItem {
  id: string;
  name: string;
  provider: string;
  costTier?: string;
  openRouterId?: string | null;
}

type TabId = "script" | "title" | "description" | "tags" | "thumbnail";

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  scripts: { id: string; title: string; content: string; aiModel: string | null; createdAt: string }[];
  thumbnails: { id: string; blobUrl: string; fragmentIndex?: number | null }[];
  channel: unknown;
}

interface Preset {
  id: string;
  name: string;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [aiModels, setAiModels] = useState<AIModelItem[]>([]);
  const [tab, setTab] = useState<TabId>("script");
  const [topic, setTopic] = useState("");
  const [targetDurationId, setTargetDurationId] = useState<string>("5");
  const [modelId, setModelId] = useState(AI_MODELS[0]?.id ?? "");
  const [presetId, setPresetId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [generatedTitle, setGeneratedTitle] = useState<string | null>(null);
  const [generatedDescription, setGeneratedDescription] = useState<string | null>(null);
  const [generatedTags, setGeneratedTags] = useState<string[]>([]);
  const [lastScriptStats, setLastScriptStats] = useState<{
    wordCount: number;
    estimatedMinutes: number;
    targetMinutes: number;
    targetMet: boolean;
  } | null>(null);
  const [thumbTitle, setThumbTitle] = useState("");
  const [thumbColors, setThumbColors] = useState("");
  const [thumbReferenceHint, setThumbReferenceHint] = useState("");
  const [thumbLoading, setThumbLoading] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [thumbImageModelId, setThumbImageModelId] = useState(THUMBNAIL_IMAGE_MODELS[0]?.id ?? "google/gemini-2.5-flash-image");
  const [thumbWordStyle, setThumbWordStyle] = useState<"preset" | "few" | "many">("preset");
  const [sceneImageModelId, setSceneImageModelId] = useState("black-forest-labs/flux.2-pro");
  const [sceneImageLoading, setSceneImageLoading] = useState<number | null>(null);
  const [sceneImageError, setSceneImageError] = useState<string | null>(null);
  const [storageMode, setStorageModeState] = useState<"cloud" | "local">("cloud");
  const [localFolderName, setLocalFolderNameState] = useState<string | null>(null);

  useEffect(() => {
    setStorageModeState(getStorageMode());
    setLocalFolderNameState(getLocalFolderName());
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch("/api/presets").then((r) => r.json()),
      fetch("/api/ai/models").then((r) => r.json()),
    ]).then(([projData, presetsData, modelsData]) => {
      if (projData.project) setProject(projData.project);
      if (presetsData.presets) setPresets(presetsData.presets);
      if (modelsData.models?.length) {
        setAiModels(modelsData.models);
        const list = modelsData.models as AIModelItem[];
        const preferred = list.find((m: AIModelItem) => m.costTier === "free") ?? list.find((m: AIModelItem) => SCRIPT_RECOMMENDED_IDS.has(m.openRouterId || m.id)) ?? list[0];
        if (list.length && (!modelId || !list.some((m: AIModelItem) => (m.openRouterId || m.id) === modelId))) {
          setModelId(preferred?.openRouterId || preferred?.id || list[0].openRouterId || list[0].id);
        } else if (!modelId && preferred) {
          setModelId(preferred.openRouterId || preferred.id);
        } else if (!modelId && list[0]) {
          setModelId(list[0].openRouterId || list[0].id);
        }
      } else {
        setAiModels(AI_MODELS.map((m) => ({ id: m.id, name: m.name, provider: m.provider, costTier: m.costTier, openRouterId: null })));
      }
    });
  }, [id]);

  useEffect(() => {
    if (project?.title && !thumbTitle) setThumbTitle(project.title);
  }, [project?.title, thumbTitle]);

  async function handleGenerateThumbnail() {
    const titleText = (thumbTitle.trim() || project?.title) ?? "";
    if (!titleText) {
      setThumbError("Escribe un título o usa el del proyecto.");
      return;
    }
    const storageMode = getStorageMode();
    if (storageMode === "local" && typeof window !== "undefined" && !("showDirectoryPicker" in window)) {
      setThumbError("Modo local requiere un navegador con File System Access (Chrome/Edge). Usa modo Nube o otro navegador.");
      return;
    }
    if (storageMode === "local" && typeof window !== "undefined") {
      const win = window as unknown as { __scriptingToolDirHandle?: FileSystemDirectoryHandle; showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> };
      if (!win.__scriptingToolDirHandle) {
        try {
          const handle = await win.showDirectoryPicker!();
          win.__scriptingToolDirHandle = handle;
          setLocalFolderName(handle.name);
          setLocalFolderNameState(handle.name);
        } catch (e) {
          if ((e as Error).name === "AbortError") {
            setThumbError("Selecciona la carpeta donde guardar las miniaturas (ej. /Volumes/B/Downloads/scripting) para que el archivo se guarde en disco.");
            return;
          }
          setThumbError(e instanceof Error ? e.message : "No se pudo acceder a la carpeta.");
          return;
        }
      }
    }
    setThumbLoading(true);
    setThumbError(null);
    try {
      const res = await fetch("/api/thumbnail/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          title: titleText,
          colors: thumbColors.trim() || undefined,
          referenceHint: thumbReferenceHint.trim() || undefined,
          storageMode,
          modelId: thumbImageModelId,
          presetId: presetId || undefined,
          thumbnailWordStyle: thumbWordStyle !== "preset" ? thumbWordStyle : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setThumbError(data.error || data.detail || "Error al generar miniatura");
        if (data.code === "OPENROUTER_KEY_MISSING" || data.code === "STORAGE_MISSING") {
          setThumbError((prev) => (prev ? `${prev} ${data.hint ?? ""}` : prev));
        }
        return;
      }
      const thumbnail = data.thumbnail as { id: string; blobUrl: string };
      let localSaveError: string | null = null;
      if (data.imageBase64 && storageMode === "local") {
        await setLocalThumbData(thumbnail.id, data.imageBase64);
        const win = typeof window !== "undefined" ? (window as unknown as { __scriptingToolDirHandle?: FileSystemDirectoryHandle }) : undefined;
        const handle = win?.__scriptingToolDirHandle;
        if (handle) {
          try {
            const dir = await handle.getDirectoryHandle("scripting-tool", { create: true });
            const projectDir = await dir.getDirectoryHandle(id, { create: true });
            const fileName = `thumb-${thumbnail.id}.png`;
            const file = await projectDir.getFileHandle(fileName, { create: true });
            const w = await file.createWritable();
            const buf = Uint8Array.from(atob(data.imageBase64), (c) => c.charCodeAt(0));
            await w.write(buf);
            await w.close();
            await setLocalThumbPath(thumbnail.id, `${id}/${fileName}`, fileName);
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Error al escribir";
            localSaveError = `Miniatura guardada en la app, pero no en la carpeta: ${msg}. Vuelve a seleccionar la carpeta y genera de nuevo.`;
          }
        } else {
          localSaveError = "Miniatura guardada en la app. Para guardarla en tu carpeta, genera otra miniatura y selecciona la carpeta cuando te la pida.";
        }
      }
      setProject((prev) =>
        prev && thumbnail
          ? { ...prev, thumbnails: [{ ...thumbnail, blobUrl: thumbnail.blobUrl }, ...prev.thumbnails] }
          : prev
      );
      setThumbError(localSaveError ?? null);
    } catch (e) {
      setThumbError(e instanceof Error ? e.message : "Error");
    } finally {
      setThumbLoading(false);
    }
  }

  async function handleGenerate(type: "script" | "title" | "description" | "tags") {
    const topicText = type === "script" ? topic : project?.title ?? topic;
    if (!topicText.trim()) {
      setError("Escribe el tema o título para generar.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const targetMinutes = type === "script" ? DURATION_PRESETS.find((p) => p.id === targetDurationId)?.minutes ?? 5 : undefined;
      const res = await fetch("/api/script/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          presetId: presetId || undefined,
          topic: topicText,
          modelId: aiModels.find((m) => (m.openRouterId || m.id) === modelId)?.openRouterId || modelId,
          provider: aiModels.find((m) => (m.openRouterId || m.id) === modelId)?.provider,
          type,
          targetDurationMinutes: targetMinutes,
        }),
      });
      const raw = await res.text();
      let data: { error?: string; hint?: string; generated?: string; tags?: string[]; script?: unknown; wordCount?: number; estimatedDurationMinutes?: number; targetDurationMinutes?: number; targetMet?: boolean };
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setError(res.ok ? "La respuesta del servidor no es válida." : `Error del servidor (${res.status}). Prueba otro modelo o revisa OPENROUTER_API_KEY.`);
        return;
      }
      if (!res.ok) {
        const msg = data.hint
          ? `${data.error || "Error al generar"}. ${data.hint}`
          : (data.error || "Error al generar");
        setError(msg);
        return;
      }
      const generated = data.generated ?? "";
      if (type === "script") {
        setGeneratedScript(generated);
        if (data.wordCount != null && data.estimatedDurationMinutes != null) {
          setLastScriptStats({
            wordCount: data.wordCount,
            estimatedMinutes: data.estimatedDurationMinutes,
            targetMinutes: data.targetDurationMinutes ?? targetMinutes ?? 5,
            targetMet: data.targetMet ?? false,
          });
        }
      }
      if (type === "title") setGeneratedTitle(generated);
      if (type === "description") setGeneratedDescription(generated);
      if (type === "tags" && Array.isArray(data.tags)) setGeneratedTags(data.tags);
      if (data.script) {
        const newScript = data.script as Project["scripts"][number];
        setProject((prev) => prev ? { ...prev, scripts: [newScript, ...prev.scripts] } : null);
      }
      if (data.generated && (type === "title" || type === "description")) {
        setProject((prev) =>
          prev
            ? {
                ...prev,
                ...(type === "title" && { title: data.generated }),
                ...(type === "description" && { description: data.generated }),
              }
            : null
        );
      }
      // Refrescar proyecto para tener datos actualizados
      const ref = await fetch(`/api/projects/${id}`);
      const refData = await ref.json();
      if (refData.project) setProject(refData.project);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (!project) {
    return (
      <div className="p-8 flex items-center gap-2 text-[rgb(var(--text-muted))]">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando proyecto...
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "script", label: "Script", icon: <FileText className="h-4 w-4" /> },
    { id: "title", label: "Título", icon: <Type className="h-4 w-4" /> },
    { id: "description", label: "Descripción", icon: <AlignLeft className="h-4 w-4" /> },
    { id: "tags", label: "Etiquetas SEO", icon: <Tag className="h-4 w-4" /> },
    { id: "thumbnail", label: "Miniatura", icon: <ImageIcon className="h-4 w-4" /> },
  ];

  const latestScript = project.scripts[0];
  const scriptContentForFragments = (generatedScript ?? latestScript?.content ?? "").trim();
  // Mostrar todos los modelos disponibles para el script (recomendados primero, luego gratuitos, luego el resto)
  const allScriptModels = aiModels.length ? aiModels : AI_MODELS.map((m) => ({ id: m.id, name: m.name, provider: m.provider, costTier: m.costTier, openRouterId: null as string | null }));
  const modelsForScriptDropdown = [...allScriptModels].sort((a, b) => {
    const aRec = SCRIPT_RECOMMENDED_IDS.has(a.openRouterId || a.id) ? 1 : 0;
    const bRec = SCRIPT_RECOMMENDED_IDS.has(b.openRouterId || b.id) ? 1 : 0;
    if (bRec !== aRec) return bRec - aRec;
    if (a.costTier === "free" && b.costTier !== "free") return -1;
    if (b.costTier === "free" && a.costTier !== "free") return 1;
    return (a.name ?? a.id).localeCompare(b.name ?? b.id);
  });

  async function handleGenerateScene(fragmentIndex: number, sceneText: string) {
    if (!project) return;
    setSceneImageError(null);
    const storageModeForScene = getStorageMode();
    if (storageModeForScene === "local" && typeof window !== "undefined") {
      const win = window as unknown as { __scriptingToolDirHandle?: FileSystemDirectoryHandle; showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> };
      if (!win.__scriptingToolDirHandle) {
        try {
          const handle = await win.showDirectoryPicker!();
          win.__scriptingToolDirHandle = handle;
          setLocalFolderName(handle.name);
          setLocalFolderNameState(handle.name);
        } catch (e) {
          if ((e as Error).name === "AbortError") {
            setSceneImageError("Selecciona la carpeta donde guardar las imágenes de escenas.");
            return;
          }
          setSceneImageError(e instanceof Error ? e.message : "No se pudo acceder a la carpeta.");
          return;
        }
      }
    }
    setSceneImageLoading(fragmentIndex);
    const modelForApi = sceneImageModelId.startsWith("openrouter:") ? sceneImageModelId.replace(/^openrouter:/, "") : sceneImageModelId;
    try {
      const res = await fetch("/api/scene-image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          fragmentIndex,
          sceneText,
          modelId: modelForApi,
          storageMode: storageModeForScene,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSceneImageError(data.error || "Error al generar imagen de la escena");
        return;
      }
      const thumb = data.thumbnail as { id: string; blobUrl: string; fragmentIndex: number };
      if (data.imageBase64 && storageModeForScene === "local") {
        await setLocalThumbData(thumb.id, data.imageBase64);
        const win = typeof window !== "undefined" ? (window as unknown as { __scriptingToolDirHandle?: FileSystemDirectoryHandle }) : undefined;
        const handle = win?.__scriptingToolDirHandle;
        if (handle) {
          try {
            const dir = await handle.getDirectoryHandle("scripting-tool", { create: true });
            const projectDir = await dir.getDirectoryHandle(id, { create: true });
            const fileName = `scene-${fragmentIndex}-${thumb.id}.png`;
            const file = await projectDir.getFileHandle(fileName, { create: true });
            const w = await file.createWritable();
            const buf = Uint8Array.from(atob(data.imageBase64), (c) => c.charCodeAt(0));
            await w.write(buf);
            await w.close();
            await setLocalThumbPath(thumb.id, `${id}/${fileName}`, fileName);
          } catch (e) {
            console.warn("No se pudo guardar escena en carpeta:", e);
          }
        }
      }
      setProject((prev) =>
        prev
          ? {
              ...prev,
              thumbnails: [{ ...thumb, blobUrl: thumb.blobUrl, fragmentIndex: thumb.fragmentIndex }, ...prev.thumbnails],
            }
          : prev
      );
    } catch (e) {
      setSceneImageError(e instanceof Error ? e.message : "Error");
    } finally {
      setSceneImageLoading(null);
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/dashboard/projects"
          className="rounded-lg p-1.5 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--bg-muted))] hover:text-[rgb(var(--text-primary))]"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-[rgb(var(--text-primary))]">
            {project.title}
          </h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Los scripts generados se guardan aquí debajo. Cada generación crea una
            nueva versión en la pestaña Script.
          </p>
        </div>
      </div>

      {/* Resumen: duración estimada y costes */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] p-4 mb-6">
        <h3 className="text-sm font-medium text-[rgb(var(--text-primary))] mb-3">Resumen del proyecto · Duración y costes</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[rgb(var(--text-secondary))]">
          {latestScript ? (
            <span>
              Duración estimada del video: <strong className="text-[rgb(var(--text-primary))]">~{estimatedMinutes(countWords(latestScript.content))} min</strong>
            </span>
          ) : (
            <span className="text-[rgb(var(--text-muted))]">Genera un script para ver la duración estimada.</span>
          )}
          <span>Script: {project.scripts.length}</span>
          <span>Título: {project.title ? "✓" : "—"}</span>
          <span>Descripción: {project.description ? "✓" : "—"}</span>
          <span>Miniaturas: {project.thumbnails.length}</span>
        </div>
        <p className="text-xs text-[rgb(var(--text-muted))] mt-2">
          Los costes dependen de tu proveedor (OpenRouter, OpenAI, etc.). Cada generación consume créditos de tu API key. Revisa la facturación en tu cuenta.
        </p>
      </div>

      <div className="flex gap-2 border-b border-[rgb(var(--border))] mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-t-lg border-b-2 -mb-px transition",
              tab === t.id
                ? "border-[rgb(var(--accent))] text-[rgb(var(--accent))] bg-[rgb(var(--bg-surface))]"
                : "border-transparent text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Selector de modelo (curado para script) y preset */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-[rgb(var(--text-muted))] mb-1">
            Modelo de IA (guion) — hay opciones gratuitas
          </label>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
          >
            {modelsForScriptDropdown.map((m) => {
              const value = m.openRouterId || m.id;
              const label = m.costTier === "free" ? `${m.name} (gratis)` : m.costTier === "low" ? `${m.name} (económico)` : m.provider === "openrouter" ? `${m.name} (OpenRouter)` : m.name;
              return (
                <option key={value} value={value}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-[rgb(var(--text-muted))] mb-1">
            Preset (opcional)
          </label>
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
          >
            <option value="">Ninguno</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {tab === "script" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-4">
            <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-2">
              Tema del video (para generar el guion)
            </label>
            <div className="flex flex-wrap gap-2 items-end">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ej: 5 tips para editar más rápido"
                className="flex-1 min-w-[200px] rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2.5 text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-[rgb(var(--text-muted))] whitespace-nowrap">Duración objetivo</label>
                <select
                  value={targetDurationId}
                  onChange={(e) => setTargetDurationId(e.target.value)}
                  className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2.5 text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
                >
                  {DURATION_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleGenerate("script")}
                disabled={loading}
                className="rounded-lg bg-[rgb(var(--accent))] px-4 py-2.5 text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generar script
              </button>
            </div>
            <p className="text-xs text-[rgb(var(--text-muted))] mt-2">
              La longitud del guion determina la duración del video (~150 palabras/min).
            </p>
          </div>
          {lastScriptStats && (
            <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-4 py-3 flex flex-wrap gap-4 text-sm">
              <span className="text-[rgb(var(--text-primary))]">
                <strong>{lastScriptStats.wordCount.toLocaleString()}</strong> palabras
              </span>
              <span className="text-[rgb(var(--text-primary))]">
                ~<strong>{lastScriptStats.estimatedMinutes}</strong> min de video
              </span>
              <span className="text-[rgb(var(--text-muted))]">
                Objetivo: {lastScriptStats.targetMinutes} min
                {lastScriptStats.targetMet ? (
                  <span className="text-green-600 dark:text-green-400 ml-1">✓</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 ml-1">(ajusta tema o regenera)</span>
                )}
              </span>
            </div>
          )}

          <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))]">
              <h2 className="font-medium text-[rgb(var(--text-primary))]">
                Escenas del guion
              </h2>
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Tras generar el script, se muestra en formato por escena: fragmentos de 15–21 palabras, con número, texto, palabras y botón para copiar bloques de 5. Puedes generar imagen/video por escena.
              </p>
            </div>
            <div className="p-4">
              {scriptContentForFragments ? (
                <>
                  {(latestScript || generatedScript) && (
                    <div className="rounded-lg bg-[rgb(var(--bg-muted))] p-3 text-xs text-[rgb(var(--text-muted))] flex flex-wrap gap-x-4 gap-y-1 mb-4">
                      <span>Versión más reciente · {latestScript?.aiModel ?? "IA"} · {latestScript ? new Date(latestScript.createdAt).toLocaleString("es") : "Sin guardar aún"}</span>
                      <span className="text-[rgb(var(--text-secondary))]">
                        {countWords(scriptContentForFragments).toLocaleString()} palabras · ~{estimatedMinutes(countWords(scriptContentForFragments))} min
                      </span>
                    </div>
                  )}
                  {sceneImageError && (
                    <p className="text-sm text-red-600 dark:text-red-400 mb-2">{sceneImageError}</p>
                  )}
                  <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                    <ScriptFragmentsTable
                      scriptContent={scriptContentForFragments}
                      sceneImageModelId={sceneImageModelId}
                      onSceneImageModelChange={setSceneImageModelId}
                      onGenerateScene={handleGenerateScene}
                      sceneImages={(() => {
                        const map: Record<number, { id: string; blobUrl: string }> = {};
                        project.thumbnails.forEach((t) => {
                          if (t.fragmentIndex != null) map[t.fragmentIndex] = { id: t.id, blobUrl: t.blobUrl };
                        });
                        return map;
                      })()}
                      sceneLoadingIndex={sceneImageLoading}
                    />
                  </div>
                </>
              ) : (
                <p className="text-[rgb(var(--text-muted))]">
                  Aún no hay scripts. Escribe un tema y pulsa &quot;Generar script&quot;.
                </p>
              )}
              {project.scripts.length > 1 && (
                <div className="mt-4 pt-4 border-t border-[rgb(var(--border))]">
                  <p className="text-xs text-[rgb(var(--text-muted))] mb-2">
                    Otras versiones ({project.scripts.length - 1})
                  </p>
                  <ul className="space-y-2">
                    {project.scripts.slice(1, 5).map((s) => (
                      <li
                        key={s.id}
                        className="text-sm text-[rgb(var(--text-secondary))] truncate"
                      >
                        {s.aiModel} · {new Date(s.createdAt).toLocaleDateString("es")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "title" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-4">
            <p className="text-sm text-[rgb(var(--text-secondary))] mb-2">
              Título actual del proyecto: <strong>{project.title}</strong>
            </p>
            <button
              type="button"
              onClick={() => handleGenerate("title")}
              disabled={loading}
              className="rounded-lg bg-[rgb(var(--accent))] px-4 py-2.5 text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generar título con IA
            </button>
            {generatedTitle && (
              <div className="mt-4 rounded-lg bg-[rgb(var(--accent-soft))] p-4">
                <p className="text-sm font-medium text-[rgb(var(--accent))] mb-1">
                  Título generado
                </p>
                <p className="text-[rgb(var(--text-primary))]">{generatedTitle}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "description" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-4">
            <p className="text-sm text-[rgb(var(--text-secondary))] mb-2">
              Descripción con formato: intro, reflexión, timestamps (capítulos) derivados del script e inspirado por. Si ya generaste un script, se usará para los capítulos.
            </p>
            <button
              type="button"
              onClick={() => handleGenerate("description")}
              disabled={loading}
              className="rounded-lg bg-[rgb(var(--accent))] px-4 py-2.5 text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generar descripción con IA
            </button>
            {(generatedDescription || project.description) ? (
              <div className="mt-4 rounded-lg bg-[rgb(var(--bg-muted))] p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm text-[rgb(var(--text-primary))]">
                  {generatedDescription ?? project.description}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {tab === "tags" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-4">
            <p className="text-sm text-[rgb(var(--text-secondary))] mb-2">
              Etiquetas con alto potencial de búsqueda para el video (SEO). Se usan el título y, si existe, el script para afinar términos y tendencias.
            </p>
            <button
              type="button"
              onClick={() => handleGenerate("tags")}
              disabled={loading}
              className="rounded-lg bg-[rgb(var(--accent))] px-4 py-2.5 text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generar etiquetas con IA
            </button>
            {generatedTags.length > 0 && (
              <div className="mt-4 rounded-lg bg-[rgb(var(--bg-muted))] p-4">
                <p className="text-xs font-medium text-[rgb(var(--text-muted))] mb-2">
                  Copia y pega en YouTube (máx. 500 caracteres en total). Clic en una etiqueta para copiarla.
                </p>
                <div className="flex flex-wrap gap-2">
                  {generatedTags.map((tag, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(tag);
                      }}
                      className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-2.5 py-1 text-sm text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--accent-soft))] hover:border-[rgb(var(--accent))]"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(generatedTags.join(", "))}
                  className="mt-3 text-xs text-[rgb(var(--accent))] hover:underline"
                >
                  Copiar todas
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "thumbnail" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-4">
            <h3 className="text-sm font-medium text-[rgb(var(--text-primary))] mb-3">
              Generar miniatura viral con IA (OpenRouter)
            </h3>
            <p className="text-xs text-[rgb(var(--text-muted))] mb-4">
              La miniatura es clave para el CTR. Usa Nano Banana o Grok para imágenes estáticas 16:9 optimizadas para YouTube.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--text-muted))] mb-1">Estilo de texto (competencia)</label>
                <select
                  value={thumbWordStyle}
                  onChange={(e) => setThumbWordStyle(e.target.value as "preset" | "few" | "many")}
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
                >
                  <option value="preset">Según preset (si tiene thumbnailWordStyle)</option>
                  <option value="few">Pocas palabras (2-4) — miniatura impactante</option>
                  <option value="many">Muchas palabras (5-8) — estilo más texto</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--text-muted))] mb-1">Modelo de imagen</label>
                <select
                  value={thumbImageModelId}
                  onChange={(e) => setThumbImageModelId(e.target.value)}
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
                >
                  {THUMBNAIL_IMAGE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.note ? `(${m.note})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--text-muted))] mb-1">Título o concepto (para la imagen)</label>
                <input
                  type="text"
                  value={thumbTitle}
                  onChange={(e) => setThumbTitle(e.target.value)}
                  placeholder={project.title || "Ej: 5 secretos que no sabías"}
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--text-muted))] mb-1">Colores (opcional)</label>
                <input
                  type="text"
                  value={thumbColors}
                  onChange={(e) => setThumbColors(e.target.value)}
                  placeholder="Ej: rojo, negro, amarillo / neón"
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--text-muted))] mb-1">Estilo o referencia (opcional)</label>
                <input
                  type="text"
                  value={thumbReferenceHint}
                  onChange={(e) => setThumbReferenceHint(e.target.value)}
                  placeholder="Ej: expresiones exageradas, fondo oscuro, tipografía gruesa"
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
                />
              </div>
              {thumbError && (
                <p className="text-sm text-red-600 dark:text-red-400">{thumbError}</p>
              )}
              <button
                type="button"
                onClick={handleGenerateThumbnail}
                disabled={thumbLoading}
                className="rounded-lg bg-[rgb(var(--accent))] px-4 py-2.5 text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {thumbLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                Generar miniatura
              </button>
            </div>
            <p className="text-xs text-[rgb(var(--text-muted))] mt-3">
              Nano Banana y Grok son los modelos recomendados para miniaturas. En Configuración eliges guardar en la nube (Cloudinary) o en tu carpeta local.
            </p>
            {storageMode === "local" && localFolderName && (
              <div className="mt-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2">
                <p className="text-xs font-medium text-[rgb(var(--text-primary))] mb-0.5">Carpeta de assets de este proyecto</p>
                <p className="text-xs text-[rgb(var(--text-muted))] break-all">
                  {localFolderName} → scripting-tool → {id}
                </p>
                <p className="text-xs text-[rgb(var(--text-muted))] mt-1">
                  Abre la carpeta <strong>{localFolderName}</strong> en tu Mac (Finder) y entra en <strong>scripting-tool</strong> → <strong>{id}</strong> para ver los PNG guardados.
                </p>
              </div>
            )}
          </div>
          {project.thumbnails.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[rgb(var(--text-primary))] mb-2">Miniaturas generadas</h3>
              <div className="flex flex-wrap gap-4">
                {project.thumbnails.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg overflow-hidden border border-[rgb(var(--border))] p-2 hover:ring-2 hover:ring-[rgb(var(--accent))]"
                  >
                    {t.blobUrl.startsWith(LOCAL_URL_PREFIX) ? (
                      <LocalThumbnailWithPath
                        thumbId={t.id}
                        blobUrl={t.blobUrl}
                        projectId={id}
                        alt="Miniatura"
                        className="h-32 w-auto object-cover rounded"
                      />
                    ) : (
                      <>
                        <a href={t.blobUrl} target="_blank" rel="noopener noreferrer">
                          <img src={t.blobUrl} alt="Miniatura" className="h-32 w-auto object-cover rounded" />
                        </a>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
