"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  FolderOpen,
  Plus,
  Video,
  Loader2,
  Link2,
  Palette,
  Type,
  Image as ImageIcon,
  Check,
  X,
  ExternalLink,
  Youtube,
  Search,
  User,
} from "lucide-react";

interface Video {
  id: string;
  title: string;
  description: string | null;
  status: string;
  updatedAt: string;
  scripts: { id: string }[];
  thumbnails: { id: string; fragmentIndex?: number | null }[];
}

interface Channel {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  youtubeChannelId: string;
}

interface ChannelSearchResult {
  channelId: string;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number;
  videoCount: number;
  viewCount: string;
  publishedAt: string | null;
}

function ChannelAvatar({
  thumbnailUrl,
}: {
  thumbnailUrl: string | null;
  title?: string | null;
}) {
  const [imgError, setImgError] = useState(false);
  const showImg = thumbnailUrl && !imgError;
  return (
    <div className="h-8 w-8 rounded-full overflow-hidden bg-[rgb(var(--bg-muted))] shrink-0 flex items-center justify-center">
      {showImg ? (
        <img
          src={thumbnailUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <User className="h-4 w-4 text-[rgb(var(--text-muted))]" />
      )}
    </div>
  );
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  contentStyle: string | null;
  presetIds: string[];
  brandColors: string[];
  typography: string | null;
  referenceImageUrls: string[];
  channel: { id: string; title: string | null; thumbnailUrl: string | null } | null;
  videos: Video[];
}

/** Campos que acepta el PATCH del proyecto */
type ProjectPatch = Partial<Pick<Project, "contentStyle" | "brandColors" | "typography" | "referenceImageUrls">> & {
  channelId?: string | null;
};

export default function ProjectOverviewPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingVideo, setCreatingVideo] = useState(false);
  const [savingContext, setSavingContext] = useState(false);
  const [editingContext, setEditingContext] = useState(false);
  const [channelUrl, setChannelUrl] = useState("");
  const [analyzingChannel, setAnalyzingChannel] = useState(false);
  const [channelSearchQuery, setChannelSearchQuery] = useState("");
  const [channelSearchOrder, setChannelSearchOrder] = useState<"relevance" | "viewCount" | "videoCount" | "date">("relevance");
  const [channelSearchAgeFilter, setChannelSearchAgeFilter] = useState<string>("all");
  const [channelSearchResults, setChannelSearchResults] = useState<ChannelSearchResult[]>([]);
  const [channelSearching, setChannelSearching] = useState(false);
  const [publishingVideoId, setPublishingVideoId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch("/api/channels").then((r) => r.json()),
    ]).then(([projData, chData]) => {
      if (projData.project) setProject(projData.project);
      if (chData.channels) setChannels(chData.channels);
    }).finally(() => setLoading(false));
  }, [id]);

  async function handleAddVideo() {
    if (!project) return;
    setCreatingVideo(true);
    try {
      const res = await fetch(`/api/projects/${id}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Video ${(project.videos?.length ?? 0) + 1}` }),
      });
      const data = await res.json();
      if (data.video) {
        setProject((prev) =>
          prev ? { ...prev, videos: [data.video, ...prev.videos] } : prev
        );
      }
    } finally {
      setCreatingVideo(false);
    }
  }

  async function handleSaveContext(patch: ProjectPatch) {
    if (!project) return;
    setSavingContext(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.project) {
        setProject(data.project);
        setEditingContext(false);
      }
    } finally {
      setSavingContext(false);
    }
  }

  async function handleAnalyzeAndLinkChannel() {
    if (!channelUrl.trim()) return;
    setAnalyzingChannel(true);
    try {
      const res = await fetch("/api/channel/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlOrId: channelUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al analizar");
      if (data.channel) {
        await handleSaveContext({ channelId: data.channel.id });
        setChannels((prev) => {
          if (prev.some((c) => c.id === data.channel.id)) return prev;
          return [data.channel, ...prev];
        });
        setChannelUrl("");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al analizar canal");
    } finally {
      setAnalyzingChannel(false);
    }
  }

  async function handleSearchChannels() {
    if (!channelSearchQuery.trim()) return;
    setChannelSearching(true);
    try {
      const params = new URLSearchParams({
        q: channelSearchQuery.trim(),
        order: channelSearchOrder,
        maxResults: "12",
      });
      const ageFilterToDate: Record<string, string> = {
        "2weeks": new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        "1month": new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        "3months": new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      };
      const publishedAfter = ageFilterToDate[channelSearchAgeFilter];
      if (publishedAfter) params.set("publishedAfter", publishedAfter);
      const res = await fetch(`/api/channel/search?${params}`);
      const data = await res.json();
      if (data.channels) setChannelSearchResults(data.channels);
      else setChannelSearchResults([]);
    } catch (e) {
      setChannelSearchResults([]);
    } finally {
      setChannelSearching(false);
    }
  }

  async function handlePublish(videoId: string) {
    setPublishingVideoId(videoId);
    try {
      const res = await fetch(`/api/projects/${id}/videos/${videoId}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = [data.error, data.hint].filter(Boolean).join(" ") || "Error al publicar";
        alert(msg);
        return;
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al publicar");
    } finally {
      setPublishingVideoId(null);
    }
  }

  function isVideoReady(v: Video): boolean {
    const hasScript = (v.scripts?.length ?? 0) > 0;
    const hasTitle = !!v.title?.trim();
    const hasDescription = !!v.description?.trim();
    const coverThumbs = (v.thumbnails ?? []).filter((t) => t.fragmentIndex == null);
    const hasThumbnail = coverThumbs.length > 0;
    return hasScript && hasTitle && hasDescription && hasThumbnail;
  }

  if (loading || !project) {
    return (
      <div className="p-8 flex items-center gap-2 text-[rgb(var(--text-muted))]">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando...
      </div>
    );
  }

  const contentStyleLabels: Record<string, string> = {
    stickman: "Stickmans",
    real_people: "Personas reales",
    cartoon: "Caricaturas",
    mixed: "Mixto",
  };

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
            Área de trabajo · {project.videos?.length ?? 0} video
            {(project.videos?.length ?? 0) !== 1 ? "s" : ""}
            {project.channel && ` · Canal: ${project.channel.title}`}
          </p>
        </div>
      </div>

      {/* Contexto del proyecto expandido */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[rgb(var(--text-primary))]">
            Contexto del canal y marca
          </h3>
          {!editingContext ? (
            <button
              type="button"
              onClick={() => setEditingContext(true)}
              className="text-xs text-[rgb(var(--accent))] hover:underline"
            >
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingContext(false)}
                className="text-xs text-[rgb(var(--text-muted))] hover:underline"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSaveContext({
                    contentStyle: project.contentStyle ?? "mixed",
                    channelId: project.channel?.id ?? null,
                    brandColors: project.brandColors ?? [],
                    typography: project.typography ?? null,
                    referenceImageUrls: project.referenceImageUrls ?? [],
                  })
                }
                disabled={savingContext}
                className="text-xs text-[rgb(var(--accent))] font-medium hover:underline disabled:opacity-50"
              >
                {savingContext ? "Guardando…" : "Guardar"}
              </button>
            </div>
          )}
        </div>

        {editingContext ? (
          <div className="space-y-4">
            {/* Canal conectado */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-[rgb(var(--text-muted))] mb-1">
                <Link2 className="h-3.5 w-3.5" />
                Canal de YouTube
              </label>
              {project.channel ? (
                <div className="flex items-center gap-2">
                  <ChannelAvatar
                    thumbnailUrl={project.channel.thumbnailUrl}
                    title={project.channel.title}
                  />
                  <span className="text-sm text-[rgb(var(--text-primary))]">
                    {project.channel.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSaveContext({ channelId: null })}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Desvincular
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value=""
                    onChange={(e) =>
                      setProject((p) =>
                        p
                          ? {
                              ...p,
                              channel: channels.find((c) => c.id === e.target.value) ?? null,
                            }
                          : p
                      )
                    }
                    className="flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-3 py-2 text-sm text-[rgb(var(--text-primary))]"
                  >
                    <option value="">Seleccionar canal analizado</option>
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title ?? c.youtubeChannelId}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-[rgb(var(--text-muted))] self-center">o</span>
                  <div className="flex gap-2 flex-1">
                    <input
                      type="text"
                      value={channelUrl}
                      onChange={(e) => setChannelUrl(e.target.value)}
                      placeholder="Pega URL del canal para analizar"
                      className="flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-3 py-2 text-sm placeholder:text-[rgb(var(--text-muted))]"
                    />
                    <button
                      type="button"
                      onClick={handleAnalyzeAndLinkChannel}
                      disabled={analyzingChannel || !channelUrl.trim()}
                      className="rounded-lg bg-[rgb(var(--accent))] px-3 py-2 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {analyzingChannel ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analizar y vincular"}
                    </button>
                  </div>
                </div>
              )}
              <p className="text-xs text-[rgb(var(--text-muted))] mt-1">
                Ve a{" "}
                <Link href="/dashboard/canal" className="text-[rgb(var(--accent))] hover:underline">
                  Analizar canal
                </Link>{" "}
                para añadir más canales.
              </p>
            </div>

            {/* Estilo visual */}
            <div>
              <label className="block text-xs font-medium text-[rgb(var(--text-muted))] mb-1">
                Estilo de contenido (para la IA)
              </label>
              <select
                value={project.contentStyle ?? "mixed"}
                onChange={(e) =>
                  setProject((p) => (p ? { ...p, contentStyle: e.target.value } : p))
                }
                className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-3 py-2 text-sm"
              >
                {Object.entries(contentStyleLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Colores de marca */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-[rgb(var(--text-muted))] mb-1">
                <Palette className="h-3.5 w-3.5" />
                Colores de marca
              </label>
              <input
                type="text"
                value={(project.brandColors ?? []).join(", ")}
                onChange={(e) =>
                  setProject((p) =>
                    p
                      ? {
                          ...p,
                          brandColors: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        }
                      : p
                  )
                }
                placeholder="Ej: #FF0000, azul, negro"
                className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-3 py-2 text-sm placeholder:text-[rgb(var(--text-muted))]"
              />
            </div>

            {/* Tipografía */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-[rgb(var(--text-muted))] mb-1">
                <Type className="h-3.5 w-3.5" />
                Tipografía
              </label>
              <input
                type="text"
                value={project.typography ?? ""}
                onChange={(e) =>
                  setProject((p) => (p ? { ...p, typography: e.target.value || null } : p))
                }
                placeholder="Ej: Montserrat Bold, sans-serif"
                className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-3 py-2 text-sm placeholder:text-[rgb(var(--text-muted))]"
              />
            </div>

            {/* Imágenes de referencia */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-[rgb(var(--text-muted))] mb-1">
                <ImageIcon className="h-3.5 w-3.5" />
                Imágenes de referencia (URLs)
              </label>
              <div className="space-y-2">
                {(project.referenceImageUrls ?? []).map((url, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <img
                      src={url}
                      alt=""
                      className="h-12 w-12 rounded object-cover border border-[rgb(var(--border))]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => {
                        const urls = [...(project.referenceImageUrls ?? [])];
                        urls[i] = e.target.value;
                        setProject((p) => (p ? { ...p, referenceImageUrls: urls } : p));
                      }}
                      className="flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setProject((p) =>
                          p ? { ...p, referenceImageUrls: (p.referenceImageUrls ?? []).filter((_, j) => j !== i) } : p
                        )
                      }
                      className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-950/30 rounded"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setProject((p) =>
                      p ? { ...p, referenceImageUrls: [...(p.referenceImageUrls ?? []), ""] } : p
                    )
                  }
                  className="text-xs text-[rgb(var(--accent))] hover:underline"
                >
                  + Añadir imagen
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-[rgb(var(--text-secondary))]">
            {project.channel && (
              <div className="flex items-center gap-2">
                <ChannelAvatar
                  thumbnailUrl={project.channel.thumbnailUrl}
                  title={project.channel.title}
                />
                <span>
                  Canal: <strong className="text-[rgb(var(--text-primary))]">{project.channel.title}</strong>
                </span>
              </div>
            )}
            <p>
              Estilo:{" "}
              <strong>{contentStyleLabels[project.contentStyle ?? "mixed"] ?? "Mixto"}</strong>
            </p>
            {(project.brandColors?.length ?? 0) > 0 && (
              <p>
                Colores:{" "}
                <span className="flex gap-1 flex-wrap items-center">
                  {(project.brandColors ?? []).map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1"
                      title={c}
                    >
                      {/^#|^rgb/i.test(c) ? (
                        <span
                          className="w-4 h-4 rounded border border-[rgb(var(--border))]"
                          style={{ backgroundColor: c }}
                        />
                      ) : null}
                      {c}
                    </span>
                  ))}
                </span>
              </p>
            )}
            {project.typography && <p>Tipografía: {project.typography}</p>}
            {(project.referenceImageUrls?.length ?? 0) > 0 && (
              <p>{(project.referenceImageUrls ?? []).length} imagen(es) de referencia</p>
            )}
            {(project.presetIds?.length ?? 0) > 0 && (
              <p>{(project.presetIds?.length ?? 0)} preset(s) de referencia</p>
            )}
            {project.description && (
              <p className="text-[rgb(var(--text-muted))] mt-2">{project.description}</p>
            )}
          </div>
        )}
      </div>

      {/* Canales de referencia */}
      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] p-4 mb-6">
        <h3 className="text-sm font-medium text-[rgb(var(--text-primary))] mb-3">
          Canales de referencia
        </h3>
        <p className="text-xs text-[rgb(var(--text-muted))] mb-3">
          Busca canales por palabra clave para mapear su contenido y obtener ideas para tu canal.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            type="text"
            value={channelSearchQuery}
            onChange={(e) => setChannelSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchChannels()}
            placeholder="Ej: motivación, gaming, cocina"
            className="flex-1 min-w-[180px] rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-3 py-2 text-sm placeholder:text-[rgb(var(--text-muted))]"
          />
          <select
            value={channelSearchOrder}
            onChange={(e) =>
              setChannelSearchOrder(e.target.value as "relevance" | "viewCount" | "videoCount" | "date")
            }
            className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-3 py-2 text-sm"
          >
            <option value="relevance">Relevancia</option>
            <option value="viewCount">Más vistas</option>
            <option value="videoCount">Más videos</option>
            <option value="date">Más recientes</option>
          </select>
          <select
            value={channelSearchAgeFilter}
            onChange={(e) => setChannelSearchAgeFilter(e.target.value)}
            className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-3 py-2 text-sm"
            title="Solo canales creados en este período"
          >
            <option value="all">Cualquier antigüedad</option>
            <option value="2weeks">No mayor a 2 semanas</option>
            <option value="1month">No mayor a 1 mes</option>
            <option value="3months">No mayor a 3 meses</option>
          </select>
          <button
            type="button"
            onClick={handleSearchChannels}
            disabled={channelSearching || !channelSearchQuery.trim()}
            className="flex items-center gap-2 rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-white text-sm font-medium disabled:opacity-50"
          >
            {channelSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </button>
        </div>
        {channelSearchResults.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {channelSearchResults.map((ch) => (
              <a
                key={ch.channelId}
                href={`https://youtube.com/channel/${ch.channelId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-2 hover:bg-[rgb(var(--bg-muted))] transition"
              >
                <div className="h-10 w-10 rounded-full overflow-hidden bg-[rgb(var(--bg-muted))] shrink-0 flex items-center justify-center">
                  {ch.thumbnailUrl ? (
                    <img
                      src={ch.thumbnailUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5 text-[rgb(var(--text-muted))]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[rgb(var(--text-primary))] truncate">
                    {ch.title ?? "Sin nombre"}
                  </p>
                  <p className="text-xs text-[rgb(var(--text-muted))]">
                    {Number(ch.viewCount).toLocaleString()} vistas · {ch.subscriberCount.toLocaleString()} suscriptores
                  </p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-[rgb(var(--text-muted))] shrink-0" />
              </a>
            ))}
          </div>
        )}
        <p className="text-xs text-[rgb(var(--text-muted))] mt-2">
          Haz clic en un canal para abrirlo en YouTube. Luego puedes analizarlo en{" "}
          <Link href="/dashboard/canal" className="text-[rgb(var(--accent))] hover:underline">
            Analizar canal
          </Link>{" "}
          y añadirlo como preset.
        </p>
      </div>

      {/* Videos con estado de publicación */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-[rgb(var(--text-primary))]">Videos</h2>
        <button
          type="button"
          onClick={handleAddVideo}
          disabled={creatingVideo}
          className="flex items-center gap-2 rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-white font-medium hover:opacity-90 disabled:opacity-50"
        >
          {creatingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Nuevo video
        </button>
      </div>

      {(project.videos?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-12 text-center">
          <Video className="h-12 w-12 text-[rgb(var(--text-muted))] mx-auto mb-4" />
          <p className="text-[rgb(var(--text-secondary))] mb-4">
            Aún no hay videos. Crea uno para generar el script, miniatura y escenas.
          </p>
          <button
            type="button"
            onClick={handleAddVideo}
            disabled={creatingVideo}
            className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-white font-medium hover:opacity-90"
          >
            Crear video
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {(project.videos ?? []).map((v) => {
            const ready = isVideoReady(v);
            const hasScript = (v.scripts?.length ?? 0) > 0;
            const hasTitle = !!v.title?.trim();
            const hasDesc = !!v.description?.trim();
            const coverThumbs = (v.thumbnails ?? []).filter((t) => t.fragmentIndex == null);
            const hasThumb = coverThumbs.length > 0;

            return (
              <li key={v.id}>
                <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-4 hover:bg-[rgb(var(--bg-muted))] transition">
                  <Link
                    href={`/dashboard/projects/${id}/videos/${v.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <FolderOpen className="h-5 w-5 text-[rgb(var(--accent))] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[rgb(var(--text-primary))]">{v.title}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[rgb(var(--text-muted))] mt-1">
                        <span className={hasScript ? "text-green-600 dark:text-green-400" : ""}>
                          {hasScript ? <Check className="inline h-3 w-3 mr-0.5" /> : null} Script
                        </span>
                        <span className={hasTitle ? "text-green-600 dark:text-green-400" : ""}>
                          {hasTitle ? <Check className="inline h-3 w-3 mr-0.5" /> : null} Título
                        </span>
                        <span className={hasDesc ? "text-green-600 dark:text-green-400" : ""}>
                          {hasDesc ? <Check className="inline h-3 w-3 mr-0.5" /> : null} Descripción
                        </span>
                        <span className={hasThumb ? "text-green-600 dark:text-green-400" : ""}>
                          {hasThumb ? <Check className="inline h-3 w-3 mr-0.5" /> : null} Miniatura
                        </span>
                        <span>{new Date(v.updatedAt).toLocaleDateString("es")}</span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    {ready && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handlePublish(v.id);
                          }}
                          disabled={publishingVideoId === v.id || !project.channel}
                          className="flex items-center gap-1.5 rounded-lg bg-[#FF0000] hover:bg-[#cc0000] text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!project.channel ? "Conecta un canal al proyecto para publicar" : "Publicar en YouTube"}
                        >
                          {publishingVideoId === v.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Youtube className="h-4 w-4" />
                          )}
                          Publicar
                        </button>
                        <span className="flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300 px-2.5 py-1 text-xs font-medium">
                          Listo
                        </span>
                      </>
                    )}
                    <Link
                      href={`/dashboard/projects/${id}/videos/${v.id}`}
                      className="rounded-lg p-2 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--bg-muted))] hover:text-[rgb(var(--text-primary))]"
                      title="Editar video"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-[rgb(var(--text-muted))] mt-4">
        Cuando un video tenga script, título, descripción y miniatura, estará listo para publicar en
        YouTube. La publicación directa se habilitará próximamente.
      </p>
    </div>
  );
}
