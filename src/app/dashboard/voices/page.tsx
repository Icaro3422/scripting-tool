"use client";

import { useEffect, useState } from "react";
import { Volume2, Globe, MapPin, User, Loader2, Check, Filter, Play, AlertCircle } from "lucide-react";

interface VoiceEntry {
  id: string;
  name: string;
  languageCode: string;
  languageName: string;
  region: string;
  regionName: string;
  gender: string;
  source: string;
  modelHint?: string;
}

interface FiltersResp {
  languages: { code: string; name: string }[];
  regions: { code: string; name: string }[];
  genders: { value: string; label: string }[];
}

export default function VocesPage() {
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [filters, setFilters] = useState<FiltersResp | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const load = () => setBrowserVoices(speechSynthesis.getVoices());
    load();
    speechSynthesis.onvoiceschanged = load;
    return () => { speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (lang) params.set("lang", lang);
    if (region) params.set("region", region);
    if (gender) params.set("gender", gender);
    const url = `/api/voices${params.toString() ? `?${params.toString()}` : ""}`;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setVoices(data.voices ?? []);
        setTotal(data.total ?? 0);
        if (data.filters) setFilters(data.filters);
      })
      .finally(() => setLoading(false));
  }, [lang, region, gender]);

  const genderLabel = (g: string) => filters?.genders.find((x) => x.value === g)?.label ?? g;

  /** Textos de muestra por idioma para la vista previa con la voz del navegador */
  const SAMPLE_TEXTS: Record<string, string> = {
    en: "Hello. This is a short preview of this voice.",
    es: "Hola. Esta es una breve muestra de esta voz.",
    fr: "Bonjour. Ceci est un court aperçu de cette voix.",
    de: "Hallo. Das ist eine kurze Vorschau dieser Stimme.",
    it: "Ciao. Questa è una breve anteprima di questa voce.",
    pt: "Olá. Esta é uma amostra curta desta voz.",
    zh: "你好。这是此声音的简短预览。",
    ja: "こんにちは。この音声の短いプレビューです。",
    hi: "नमस्ते। यह इस आवाज का एक संक्षिप्त पूर्वावलोकन है।",
  };

  /** Elige una voz del navegador que coincida con idioma/región y género (male/female) */
  function pickBrowserVoice(locale: string, gender: string): SpeechSynthesisVoice | null {
    const wantFemale = gender === "female";
    const localeNorm = locale.toLowerCase();
    const byLang = browserVoices.filter((v) => v.lang.toLowerCase().startsWith(localeNorm.split("-")[0]) || v.lang.toLowerCase() === localeNorm);
    if (byLang.length === 0) return null;
    const femaleKeywords = /female|woman|femenin|mujer|femme|donna|weiblich|mulher|女性|woman/i;
    const maleKeywords = /male|man|masculin|hombre|homme|uomo|männlich|homem|男性|man/i;
    const match = byLang.find((v) => {
      const name = (v.name || "").toLowerCase();
      return wantFemale ? femaleKeywords.test(name) : maleKeywords.test(name);
    });
    if (match) return match;
    return byLang[0];
  }

  function handlePreview(voice: VoiceEntry) {
    setPreviewError(null);
    setPreviewVoiceId(voice.id);
    const lang = voice.languageCode?.split("-")[0] || "es";
    const text = SAMPLE_TEXTS[lang] || SAMPLE_TEXTS.es || "Esta es una muestra de voz.";
    const u = new SpeechSynthesisUtterance(text);
    const locale = [voice.languageCode, voice.region].filter(Boolean).join("-") || voice.languageCode || "es";
    u.lang = locale;
    const chosen = pickBrowserVoice(locale, voice.gender);
    if (chosen) u.voice = chosen;
    u.onend = () => setPreviewVoiceId(null);
    u.onerror = () => {
      setPreviewVoiceId(null);
      setPreviewError("Tu navegador no pudo reproducir la vista previa. Prueba en Chrome o Edge.");
    };
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))] mb-2">
        Librería de voces
      </h1>
      <p className="text-[rgb(var(--text-secondary))] mb-6">
        Selecciona <strong>idioma</strong>, <strong>región</strong> y <strong>género</strong> para
        ver las voces disponibles. Incluye voces de{" "}
        <a
          href="https://huggingface.co/spaces/hexgrad/Kokoro-TTS"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[rgb(var(--accent))] hover:underline"
        >
          Kokoro-TTS
        </a>{" "}
        (Hugging Face) y{" "}
        <a
          href="https://www.smseagle.eu/voice-models/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[rgb(var(--accent))] hover:underline"
        >
          Piper
        </a>
        . La herramienta está en español; puedes generar contenido en cualquier idioma soportado.
        La vista previa <strong>Escuchar</strong> usa la voz de tu navegador (por idioma). Para las voces exactas de Kokoro o Piper, abre el{" "}
        <a href="https://huggingface.co/spaces/hexgrad/Kokoro-TTS" target="_blank" rel="noopener noreferrer" className="text-[rgb(var(--accent))] hover:underline">Space Kokoro-TTS</a>.
      </p>

      {previewError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-sm">{previewError}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))]">
        <span className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--text-primary))]">
          <Filter className="h-4 w-4" />
          Filtros
        </span>
        <label className="flex items-center gap-2 text-sm text-[rgb(var(--text-secondary))]">
          <Globe className="h-4 w-4" />
          Idioma:
        </label>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-1.5 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
        >
          <option value="">Todos</option>
          {filters?.languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-[rgb(var(--text-secondary))]">
          <MapPin className="h-4 w-4" />
          Región:
        </label>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-1.5 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
        >
          <option value="">Todas</option>
          {filters?.regions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-[rgb(var(--text-secondary))]">
          <User className="h-4 w-4" />
          Género:
        </label>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-1.5 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
        >
          <option value="">Todos</option>
          {filters?.genders.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-[rgb(var(--text-muted))] ml-auto">
          {total} voces
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[rgb(var(--text-muted))]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando voces...
        </div>
      ) : voices.length === 0 ? (
        <p className="text-[rgb(var(--text-muted))]">
          No hay voces para la combinación de filtros seleccionada. Prueba con otros valores.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {voices.map((voice) => (
            <li
              key={voice.id}
              className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-[rgb(var(--text-primary))]">
                  {voice.name}
                </p>
                <p className="text-xs text-[rgb(var(--text-muted))]">
                  {voice.languageName} · {voice.regionName} · {genderLabel(voice.gender)}
                  {voice.modelHint && ` · ${voice.modelHint}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handlePreview(voice)}
                  disabled={previewVoiceId === voice.id}
                  title="Escuchar vista previa (voz del navegador)"
                  className="rounded-lg border border-[rgb(var(--border))] px-2.5 py-1.5 text-sm text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-muted))] flex items-center gap-1.5 disabled:opacity-50"
                >
                  {previewVoiceId === voice.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Escuchar
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVoice(selectedVoice === voice.id ? null : voice.id)}
                  className="rounded-lg border border-[rgb(var(--border))] px-3 py-1.5 text-sm text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-muted))] flex items-center gap-1.5"
                >
                  {selectedVoice === voice.id ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Seleccionada
                    </>
                  ) : (
                    "Usar"
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selectedVoice && (
        <p className="mt-6 text-sm text-[rgb(var(--text-muted))] flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          Voz <strong>{selectedVoice}</strong> seleccionada. (La reproducción TTS se integrará en el flujo del proyecto.)
        </p>
      )}

    </div>
  );
}
