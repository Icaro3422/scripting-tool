"use client";

import { useState } from "react";
import { Loader2, Save, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AnalizarCanalPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    channel: {
      id: string;
      title: string | null;
      description: string | null;
      thumbnailUrl: string | null;
      bannerUrl: string | null;
      subscriberCount: number;
      videoCount: number;
      viewCount: string | null;
      analysis: {
        suggestedTone?: string;
        suggestedFormat?: string;
        viralSummary?: string;
        brandHints?: string;
        thumbnailsSample?: string[];
      } | null;
    };
  } | null>(null);
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setErrorHint(null);
    setErrorCode(null);
    setResult(null);
    try {
      const res = await fetch("/api/channel/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlOrId: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al analizar");
        setErrorHint(data.hint ?? null);
        setErrorCode(data.code ?? null);
        return;
      }
      setResult(data);
      setPresetName(data.channel?.title ? `Preset: ${data.channel.title}` : "Preset desde canal");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePreset() {
    if (!result?.channel || !presetName.trim()) return;
    setSavingPreset(true);
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: presetName.trim(),
          description: `Canal: ${result.channel.title ?? "Sin nombre"}`,
          channelId: result.channel.id,
          payload: {
            channelTitle: result.channel.title,
            subscriberCount: result.channel.subscriberCount,
            videoCount: result.channel.videoCount,
            viewCount: result.channel.viewCount,
            ...(typeof result.channel.analysis === "object" && result.channel.analysis !== null
              ? result.channel.analysis
              : {}),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al guardar preset");
        setErrorHint(data.hint ?? null);
        setErrorCode(data.code ?? null);
        return;
      }
      setPresetName("");
      setResult(null);
      setUrl("");
      setError(null);
      setErrorHint(null);
      setErrorCode(null);
      alert("Preset guardado. Puedes usarlo al generar scripts.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingPreset(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))] mb-2">
        Analizar canal de YouTube
      </h1>
      <p className="text-[rgb(var(--text-secondary))] mb-6">
        Pega la URL del canal (o su ID) para mapear banner, miniaturas, engagement
        y crear un preset que la IA usará para generar contenido coherente.
      </p>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[rgb(var(--text-muted))]" />
          <input
            type="url"
            placeholder="https://youtube.com/@canal o https://youtube.com/channel/UC..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
            className={cn(
              "w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] py-2.5 pl-10 pr-4 text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
            )}
          />
        </div>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading}
          className="rounded-lg bg-[rgb(var(--accent))] px-4 py-2.5 text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analizar"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 mb-6 space-y-2">
          <p>{error}</p>
          {errorHint && <p className="text-sm opacity-90">{errorHint}</p>}
          <p className="text-sm">
            Guía paso a paso: abre <strong>CONFIGURACION.md</strong> en la raíz del proyecto
            {errorCode === "YOUTUBE_API_KEY_MISSING" && " (sección «YouTube Data API»)"}
            {errorCode === "DB_NOT_READY" && " (sección «Base de datos»)"}.
          </p>
        </div>
      )}

      {result?.channel && (
        <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] overflow-hidden">
          {result.channel.bannerUrl && (
            <div className="w-full aspect-[1060/175] max-h-32 bg-[rgb(var(--bg-muted))] relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.channel.bannerUrl}
                alt="Banner del canal"
                className="w-full h-full object-cover object-top"
              />
            </div>
          )}
          <div className="p-6 flex flex-wrap gap-6">
            {result.channel.thumbnailUrl && (
              <div className="relative h-20 w-20 shrink-0 rounded-full overflow-hidden bg-[rgb(var(--bg-muted))]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.channel.thumbnailUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-[rgb(var(--text-primary))]">
                {result.channel.title ?? "Sin nombre"}
              </h2>
              <p className="text-sm text-[rgb(var(--text-muted))]">
                {result.channel.subscriberCount.toLocaleString()} suscriptores ·{" "}
                {result.channel.videoCount.toLocaleString()} videos ·{" "}
                {Number(result.channel.viewCount || 0).toLocaleString()} vistas
              </p>
              {result.channel.description && (
                <p className="mt-2 text-sm text-[rgb(var(--text-secondary))] line-clamp-3">
                  {result.channel.description}
                </p>
              )}
            </div>
          </div>
          {result.channel.analysis && (
            (result.channel.analysis.viralSummary ||
              result.channel.analysis.suggestedTone ||
              result.channel.analysis.suggestedFormat ||
              result.channel.analysis.brandHints) && (
              <div className="border-t border-[rgb(var(--border))] px-6 py-4 space-y-2">
                <h3 className="text-sm font-medium text-[rgb(var(--text-primary))]">
                  Resumen para preset (tono, formato, por qué engancha)
                </h3>
                {result.channel.analysis.suggestedTone && (
                  <p className="text-sm text-[rgb(var(--text-secondary))]">
                    <span className="text-[rgb(var(--text-muted))]">Tono: </span>
                    {result.channel.analysis.suggestedTone}
                  </p>
                )}
                {result.channel.analysis.suggestedFormat && (
                  <p className="text-sm text-[rgb(var(--text-secondary))]">
                    <span className="text-[rgb(var(--text-muted))]">Formato: </span>
                    {result.channel.analysis.suggestedFormat}
                  </p>
                )}
                {result.channel.analysis.brandHints && (
                  <p className="text-sm text-[rgb(var(--text-secondary))]">
                    <span className="text-[rgb(var(--text-muted))]">Marca/estilo: </span>
                    {result.channel.analysis.brandHints}
                  </p>
                )}
                {result.channel.analysis.viralSummary && (
                  <p className="text-sm text-[rgb(var(--text-secondary))]">
                    {result.channel.analysis.viralSummary}
                  </p>
                )}
              </div>
            )
          )}
          <div className="border-t border-[rgb(var(--border))] px-6 py-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Nombre del preset"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
            />
            <button
              type="button"
              onClick={handleSavePreset}
              disabled={savingPreset}
              className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-4 py-2 text-[rgb(var(--text-primary))] font-medium hover:bg-[rgb(var(--bg-muted))] flex items-center gap-2 disabled:opacity-50"
            >
              {savingPreset ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar preset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
