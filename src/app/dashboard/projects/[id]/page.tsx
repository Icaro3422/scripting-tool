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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AI_MODELS } from "@/types/ai";
import { DURATION_PRESETS } from "@/lib/scriptUtils";
import { countWords, estimatedMinutes } from "@/lib/scriptUtils";

interface AIModelItem {
  id: string;
  name: string;
  provider: string;
  costTier?: string;
  openRouterId?: string | null;
}

type TabId = "script" | "title" | "description" | "thumbnail";

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  scripts: { id: string; title: string; content: string; aiModel: string | null; createdAt: string }[];
  thumbnails: { id: string; blobUrl: string }[];
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
        if (!modelId && modelsData.models[0]) setModelId(modelsData.models[0].openRouterId || modelsData.models[0].id);
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setThumbError(data.error || data.detail || "Error al generar miniatura");
        if (data.code === "OPENROUTER_KEY_MISSING" || data.code === "BLOB_MISSING") {
          setThumbError((prev) => (prev ? `${prev} ${data.hint ?? ""}` : prev));
        }
        return;
      }
      setProject((prev) =>
        prev && data.thumbnail
          ? { ...prev, thumbnails: [data.thumbnail, ...prev.thumbnails] }
          : prev
      );
      setThumbError(null);
    } catch (e) {
      setThumbError(e instanceof Error ? e.message : "Error");
    } finally {
      setThumbLoading(false);
    }
  }

  async function handleGenerate(type: "script" | "title" | "description") {
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
      const data = await res.json();
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
      if (data.script) setProject((prev) => prev ? { ...prev, scripts: [data.script, ...prev.scripts] } : null);
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
    { id: "thumbnail", label: "Miniatura", icon: <ImageIcon className="h-4 w-4" /> },
  ];

  const latestScript = project.scripts[0];

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

      {/* Selector de modelo y preset */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-[rgb(var(--text-muted))] mb-1">
            Modelo de IA
          </label>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
          >
            {(aiModels.length ? aiModels : AI_MODELS.map((m) => ({ id: m.id, name: m.name, provider: m.provider, costTier: m.costTier, openRouterId: null }))).map((m) => {
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
                Scripts guardados en este proyecto
              </h2>
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Cada vez que generas un script, se guarda aquí. El más reciente
                aparece primero.
              </p>
            </div>
            <div className="p-4 max-h-[420px] overflow-y-auto">
              {generatedScript && !latestScript && (
                <div className="rounded-lg bg-[rgb(var(--accent-soft))] p-4 mb-4">
                  <p className="text-sm font-medium text-[rgb(var(--accent))] mb-1">
                    Última generación (script)
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-[rgb(var(--text-primary))] text-sm">
                    {generatedScript}
                  </pre>
                </div>
              )}
              {latestScript && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-[rgb(var(--bg-muted))] p-3 text-xs text-[rgb(var(--text-muted))] flex flex-wrap gap-x-4 gap-y-1">
                    <span>Versión más reciente · {latestScript.aiModel ?? "IA"} · {new Date(latestScript.createdAt).toLocaleString("es")}</span>
                    <span className="text-[rgb(var(--text-secondary))]">
                      {countWords(latestScript.content).toLocaleString()} palabras · ~{estimatedMinutes(countWords(latestScript.content))} min
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-[rgb(var(--text-primary))] text-sm">
                    {latestScript.content}
                  </pre>
                </div>
              )}
              {!latestScript && !generatedScript && (
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

      {tab === "thumbnail" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-4">
            <h3 className="text-sm font-medium text-[rgb(var(--text-primary))] mb-3">
              Generar miniatura viral con IA (OpenRouter)
            </h3>
            <p className="text-xs text-[rgb(var(--text-muted))] mb-4">
              La miniatura es clave para el CTR. Especifica colores y estilo para que la IA genere una imagen 16:9 optimizada para YouTube.
            </p>
            <div className="space-y-3">
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
              Se usa OpenRouter (ej. FLUX). Requiere OPENROUTER_API_KEY y BLOB_READ_WRITE_TOKEN. Ver CONFIGURACION.md.
            </p>
          </div>
          {project.thumbnails.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[rgb(var(--text-primary))] mb-2">Miniaturas generadas</h3>
              <div className="flex flex-wrap gap-4">
                {project.thumbnails.map((t) => (
                  <a
                    key={t.id}
                    href={t.blobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg overflow-hidden border border-[rgb(var(--border))] hover:ring-2 hover:ring-[rgb(var(--accent))]"
                  >
                    <img src={t.blobUrl} alt="Miniatura" className="h-32 w-auto object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
