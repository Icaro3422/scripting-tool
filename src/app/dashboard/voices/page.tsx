"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Volume2,
  User,
  Loader2,
  Play,
  Pause,
  AlertCircle,
  Search,
  Mic,
  Music,
  RefreshCcw,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const flagMap: Record<string, string> = {
  spanish: "🇪🇸",
  english: "🇺🇸",
  "american english": "🇺🇸",
  "british english": "🇬🇧",
  french: "🇫🇷",
  german: "🇩🇪",
  italian: "🇮🇹",
  portuguese: "🇵🇹",
  "brazilian portuguese": "🇧🇷",
  hindi: "🇮🇳",
  chinese: "🇨🇳",
  japanese: "🇯🇵",
  vietnamese: "🇻🇳",
  arabic: "🇦🇪",
  russian: "🇷🇺",
  korean: "🇰🇷",
  indonesian: "🇮🇩",
  dutch: "🇳🇱",
  turkish: "🇹🇷",
  polish: "🇵🇱",
  swedish: "🇸🇪",
  filipino: "🇵🇭",
  malay: "🇲🇾",
  romanian: "🇷🇴"
};

interface Voice {
  id: string;
  name: string;
  provider: "elevenlabs" | "minimax";
  gender?: string;
  tags?: string[];
  previewUrl?: string;
  languageCode?: string;
}

interface FiltersResp {
  genders: { value: string; label: string }[];
  providers: { value: string; label: string }[];
  languages: { value: string; label: string }[];
  accents: { value: string; label: string }[];
  ages: { value: string; label: string }[];
  categories: { value: string; label: string }[];
}

export default function VocesPage() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [filters, setFilters] = useState<FiltersResp | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiHint, setApiHint] = useState<string | null>(null);

  // Filter state
  const [provider, setProvider] = useState<string>("all");
  const [language, setLanguage] = useState<string>("");
  const [accent, setAccent] = useState<string>("");
  const [quality, setQuality] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [age, setAge] = useState<string>("");
  const [customRates, setCustomRates] = useState<string>("include");
  const [liveMod, setLiveMod] = useState<string>("include");
  const [category, setCategory] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const resetFilters = () => {
    setLanguage("");
    setAccent("");
    setQuality("");
    setGender("");
    setAge("");
    setCustomRates("include");
    setLiveMod("include");
    setCategory("");
    setProvider("all");
    setSearch("");
  };

  // Playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Selected voice (to use in project)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ─── Fetch voices ────────────────────────────────────────────────────────
  const fetchVoices = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    const params = new URLSearchParams();
    if (provider && provider !== "all") params.set("provider", provider);
    if (gender) params.set("gender", gender);
    if (language) params.set("lang", language);
    if (accent) params.set("accent", accent);
    if (age) params.set("age", age);
    if (category) params.set("category", category);
    if (search) params.set("search", search);
    const url = `/api/voices${params.toString() ? `?${params}` : ""}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || data.error) {
        setApiError(data.error ?? "Error al cargar voces");
        setApiHint(data.hint ?? null);
        setVoices([]);
        setTotal(0);
      } else {
        setVoices(data.voices ?? []);
        setTotal(data.total ?? 0);
        if (data.filters) setFilters(data.filters);
        setApiError(null);
        setApiHint(null);
      }
    } catch {
      setApiError("Error de red al cargar voces");
    } finally {
      setLoading(false);
    }
  }, [provider, gender, language, accent, age, category, search]);

  useEffect(() => {
    const t = setTimeout(fetchVoices, search ? 400 : 0); // debounce search
    return () => clearTimeout(t);
  }, [fetchVoices]);

  // ─── Audio playback ──────────────────────────────────────────────────────
  async function handlePlay(voice: Voice) {
    setPlayError(null);

    // If voice has a previewUrl (ElevenLabs sample), play it directly
    if (voice.previewUrl && !voice.previewUrl.startsWith("local")) {
      stopCurrent();
      const audio = new Audio(voice.previewUrl);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => {
        setPlayingId(null);
        // Fallback to AI33 TTS
        generateAndPlay(voice);
      };
      audio.play().catch(() => generateAndPlay(voice));
      setPlayingId(voice.id);
      return;
    }

    generateAndPlay(voice);
  }

  async function generateAndPlay(voice: Voice) {
    stopCurrent();
    setLoadingId(voice.id);
    try {
      const lang = voice.languageCode?.split("-")[0] ??
        voice.tags?.find((t) => /^[a-z]{2}$/.test(t)) ??
        "es";
      const res = await fetch("/api/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: voice.id, provider: voice.provider, lang }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPlayError(err.error ?? "Error al generar audio");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingId(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => setPlayingId(null);
      audio.play();
      setPlayingId(voice.id);
    } catch (e) {
      setPlayError(e instanceof Error ? e.message : "Error al reproducir");
    } finally {
      setLoadingId(null);
    }
  }

  function stopCurrent() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  }

  function handleToggle(voice: Voice) {
    if (playingId === voice.id) {
      stopCurrent();
    } else {
      handlePlay(voice);
    }
  }

  const providerBadge = (p: string) =>
    p === "elevenlabs" ? "ElevenLabs" : "Minimax";

  const providerColor = (p: string) =>
    p === "elevenlabs"
      ? "bg-violet-500/15 text-violet-400 border-violet-500/30"
      : "bg-sky-500/15 text-sky-400 border-sky-500/30";

  const genderIcon = (g?: string) =>
    g === "male" ? "♂" : g === "female" ? "♀" : "·";

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[rgb(var(--accent))]/15 flex items-center justify-center">
            <Volume2 className="h-5 w-5 text-[rgb(var(--accent))]" />
          </div>
          <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))]">
            Librería de voces
          </h1>
        </div>
        <p className="text-sm text-[rgb(var(--text-secondary))] max-w-2xl">
          Voces reales de{" "}
          <span className="text-violet-400 font-medium">ElevenLabs</span> y{" "}
          <span className="text-sky-400 font-medium">Minimax</span> a través de{" "}
          <a
            href="https://ai33.pro"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[rgb(var(--accent))] hover:underline"
          >
            AI33 Pro
          </a>
          . Escucha cada voz en directo y selecciónala para tu proyecto.
        </p>
      </div>

      {/* API Key Error banner */}
      {apiError && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">{apiError}</p>
            {apiHint && (
              <p className="text-xs text-amber-400/80 mt-1">{apiHint}</p>
            )}
          </div>
        </div>
      )}

      {/* Playback error */}
      {playError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{playError}</p>
          <button
            type="button"
            onClick={() => setPlayError(null)}
            className="ml-auto text-red-400 hover:text-red-300 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search + Filter UI matching mockup */}
      <div className="mb-6 space-y-4">
        {/* Horizontal filters row */}
        <div className="flex items-end gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {/* Language */}
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-xs font-medium text-[rgb(var(--text-primary))]">Language</label>
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))] appearance-none cursor-pointer pr-8"
              >
                <option value="">Any</option>
                {filters?.languages?.map((l) => (
                  <option key={l.value} value={l.value}>
                    {flagMap[l.value.toLowerCase()] || "🌍"} {l.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[rgb(var(--text-muted))]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          {/* Accent */}
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-xs font-medium text-[rgb(var(--text-primary))]">Accent</label>
            <div className="relative">
              <select
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="w-full bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))] appearance-none cursor-pointer pr-8"
              >
                <option value="">Any</option>
                {filters?.accents?.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[rgb(var(--text-muted))]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          {/* Quality */}
          <div className="flex flex-col gap-1.5 min-w-[120px]">
            <label className="text-xs font-medium text-[rgb(var(--text-primary))]">Quality</label>
            <div className="relative">
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))] appearance-none cursor-pointer pr-8"
              >
                <option value="">Any</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[rgb(var(--text-muted))]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          {/* Gender */}
          <div className="flex flex-col gap-1.5 min-w-[120px]">
            <label className="text-xs font-medium text-[rgb(var(--text-primary))]">Gender</label>
            <div className="relative">
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))] appearance-none cursor-pointer pr-8"
              >
                <option value="">Any</option>
                {filters?.genders?.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[rgb(var(--text-muted))]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          {/* Age */}
          <div className="flex flex-col gap-1.5 min-w-[120px]">
            <label className="text-xs font-medium text-[rgb(var(--text-primary))]">Age</label>
            <div className="relative">
              <select
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))] appearance-none cursor-pointer pr-8"
              >
                <option value="">Any</option>
                {filters?.ages?.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[rgb(var(--text-muted))]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          {/* Custom rates */}
          <div className="flex flex-col gap-1.5 min-w-[130px]">
            <label className="text-xs font-medium text-[rgb(var(--text-primary))] truncate">Custom rates</label>
            <div className="relative">
              <select
                value={customRates}
                onChange={(e) => setCustomRates(e.target.value)}
                className="w-full bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))] appearance-none cursor-pointer pr-8"
              >
                <option value="include">Include</option>
                <option value="exclude">Exclude</option>
                <option value="only">Only</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[rgb(var(--text-muted))]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          {/* Live moderation enabled */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label className="text-xs font-medium text-[rgb(var(--text-primary))] truncate">Live moderation enabled</label>
            <div className="relative">
              <select
                value={liveMod}
                onChange={(e) => setLiveMod(e.target.value)}
                className="w-full bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))] appearance-none cursor-pointer pr-8"
              >
                <option value="include">Include</option>
                <option value="exclude">Exclude</option>
                <option value="only">Only</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[rgb(var(--text-muted))]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

           {/* Category */}
           <div className="flex flex-col gap-1.5 min-w-[130px]">
            <label className="text-xs font-medium text-[rgb(var(--text-primary))]">Category</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border))] rounded-xl px-3 py-2 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))] appearance-none cursor-pointer pr-8"
              >
                <option value="">Any</option>
                {filters?.categories?.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[rgb(var(--text-muted))]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          {/* Reset button */}
          <button
            type="button"
            onClick={resetFilters}
            className="flex-shrink-0 flex items-center justify-center w-10 h-[38px] rounded-xl border border-[rgb(var(--border))] text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-muted))] transition"
            title="Reset filters"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Search Bar - Below filters */}
        <div className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[rgb(var(--text-muted))]" />
            <input
              type="text"
              placeholder="Search voice ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] text-sm text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[rgb(var(--text-primary))] shrink-0">{total} Users</span>
            <button
              type="button"
              onClick={fetchVoices}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-[rgb(var(--border))] px-3 py-2.5 text-sm text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-muted))] disabled:opacity-50 transition"
            >
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* Voices grid */}
      {loading ? (
        <div className="flex items-center gap-3 py-16 justify-center text-[rgb(var(--text-muted))]">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Cargando voces de AI33 Pro…</span>
        </div>
      ) : voices.length === 0 && !apiError ? (
        <div className="flex flex-col items-center gap-3 py-16 text-[rgb(var(--text-muted))]">
          <Music className="h-8 w-8 opacity-40" />
          <p className="text-sm">No hay voces para los filtros seleccionados.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {voices.map((voice) => {
            const isPlaying = playingId === voice.id;
            const isLoading = loadingId === voice.id;
            const isSelected = selectedId === voice.id;

            return (
              <li
                key={`${voice.provider}-${voice.id}`}
                className={cn(
                  "rounded-xl border p-4 flex items-center gap-3 transition-all",
                  isSelected
                    ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/8"
                    : "border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] hover:border-[rgb(var(--border-focus,var(--accent))]/40"
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-lg font-semibold",
                    voice.provider === "elevenlabs"
                      ? "bg-violet-500/15 text-violet-400"
                      : "bg-sky-500/15 text-sky-400"
                  )}
                >
                  {voice.provider === "elevenlabs" ? (
                    <Mic className="h-5 w-5" />
                  ) : (
                    <Music className="h-5 w-5" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm text-[rgb(var(--text-primary))] truncate">
                      {voice.name}
                    </p>
                    <span className="text-xs text-[rgb(var(--text-muted))]">
                      {genderIcon(voice.gender)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                        providerColor(voice.provider)
                      )}
                    >
                      {providerBadge(voice.provider)}
                    </span>
                    {voice.tags?.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-[rgb(var(--border))] text-[rgb(var(--text-muted))]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Play/Stop */}
                  <button
                    type="button"
                    onClick={() => handleToggle(voice)}
                    disabled={isLoading}
                    title={isPlaying ? "Detener" : "Escuchar"}
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition border",
                      isPlaying
                        ? "bg-[rgb(var(--accent))] border-[rgb(var(--accent))] text-white"
                        : "border-[rgb(var(--border))] text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-muted))]",
                      "disabled:opacity-50"
                    )}
                  >
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {/* Select */}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedId(isSelected ? null : voice.id)
                    }
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium border transition",
                      isSelected
                        ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent))] text-white"
                        : "border-[rgb(var(--border))] text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-muted))]"
                    )}
                  >
                    {isSelected ? "✓ Seleccionada" : "Usar"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Selected voice footer */}
      {selectedId && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-[rgb(var(--accent))]/30 bg-[rgb(var(--accent))]/8 px-4 py-3">
          <User className="h-4 w-4 text-[rgb(var(--accent))]" />
          <p className="text-sm text-[rgb(var(--text-primary))]">
            Voz seleccionada:{" "}
            <strong>{voices.find((v) => v.id === selectedId)?.name ?? selectedId}</strong>
          </p>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="ml-auto text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))] text-xs"
          >
            Deseleccionar
          </button>
        </div>
      )}
    </div>
  );
}
