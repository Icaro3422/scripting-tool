import { NextRequest, NextResponse } from "next/server";
import { listElevenLabsVoices, listMinimaxVoices } from "@/lib/voices/ai33";
import { VOICE_CATALOG } from "@/lib/voices/voiceCatalog";

/**
 * GET /api/voices
 * Returns unified voice list from AI33 Pro (ElevenLabs + Minimax).
 * Query: ?provider=elevenlabs|minimax  &lang=es  &gender=female  &search=name
 */
export async function GET(req: NextRequest) {
  const key = process.env.AI33_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error: "AI33_API_KEY no configurada",
        code: "AI33_KEY_MISSING",
        hint: "Añade AI33_API_KEY=<tu_key> en .env. Obtén tu key en https://ai33.pro",
        voices: [],
        total: 0,
      },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider") ?? "all"; // elevenlabs | minimax | all
    const lang = searchParams.get("lang")?.toLowerCase() ?? "";
    const gender = searchParams.get("gender")?.toLowerCase() ?? "";
    const search = searchParams.get("search")?.toLowerCase() ?? "";

    // ─── Fetch voices ──────────────────────────────────────────────────────
    const results: {
      id: string;
      name: string;
      provider: "elevenlabs" | "minimax" | "kokoro" | "piper";
      gender?: string;
      tags?: string[];
      previewUrl?: string;
      languageCode?: string;
      accent?: string;
      age?: string;
      category?: string;
    }[] = [];

    if (provider === "all" || provider === "elevenlabs") {
      try {
        const elvVoices = await listElevenLabsVoices();
        for (const v of elvVoices) {
          results.push({
            id: v.voice_id,
            name: v.name,
            provider: "elevenlabs",
            gender: v.labels?.gender,
            tags: v.labels ? Object.values(v.labels) : [],
            previewUrl: v.preview_url,
            languageCode: v.labels?.language ?? "",
            accent: v.labels?.accent,
            age: v.labels?.age,
            category: v.category ?? v.labels?.use_case ?? "",
          });
        }
      } catch (e) {
        console.warn("AI33 ElevenLabs voices error:", e);
      }
    }

    if (provider === "all" || provider === "minimax") {
      try {
        const mmVoices = await listMinimaxVoices(1, 100);
        for (const v of mmVoices) {
          const gTag = v.tag_list?.find((t) =>
            ["female", "male"].includes(t.toLowerCase())
          )?.toLowerCase();
          results.push({
            id: v.voice_id,
            name: v.voice_name,
            provider: "minimax",
            gender: gTag,
            tags: v.tag_list ?? [],
            previewUrl: v.sample_audio,
            languageCode: "",
            accent: "",
            age: "",
            category: "",
          });
        }
      } catch (e) {
        console.warn("AI33 Minimax voices error:", e);
      }
    }

    if (provider === "all" || provider === "kokoro" || provider === "piper") {
      for (const v of VOICE_CATALOG) {
        if (provider === "all" || provider === v.source) {
          results.push({
            id: v.id,
            name: v.name,
            provider: v.source as "kokoro" | "piper",
            gender: v.gender,
            tags: [v.source, v.regionName, v.languageName],
            languageCode: v.languageName.toLowerCase() === "inglés" ? "english" : v.languageName.toLowerCase() === "español" ? "spanish" : v.languageName,
            accent: v.regionName,
            category: "Narrative",
          });
        }
      }
    }

    const accent = searchParams.get("accent")?.toLowerCase() ?? "";
    const age = searchParams.get("age")?.toLowerCase() ?? "";
    const categoryQuery = searchParams.get("category")?.toLowerCase() ?? "";

    // ─── Filters ───────────────────────────────────────────────────────────
    let filtered = results;

    if (gender) {
      filtered = filtered.filter((v) => v.gender?.toLowerCase() === gender);
    }
    if (accent) {
      filtered = filtered.filter((v) => v.accent?.toLowerCase() === accent);
    }
    if (age) {
      filtered = filtered.filter((v) => v.age?.toLowerCase() === age);
    }
    if (categoryQuery) {
      filtered = filtered.filter((v) => v.category?.toLowerCase() === categoryQuery);
    }

    if (lang) {
      filtered = filtered.filter(
        (v) =>
          v.languageCode?.toLowerCase().startsWith(lang) ||
          v.tags?.some((t) => t.toLowerCase().includes(lang))
      );
    }

    if (search) {
      filtered = filtered.filter(
        (v) =>
          v.name.toLowerCase().includes(search) ||
          v.tags?.some((t) => t.toLowerCase().includes(search))
      );
    }

    // ─── Build filter options from ALL data (not just filtered) ───────────
    const uniqueLangs = Array.from(new Set(results.map((v) => v.languageCode).filter(Boolean))) as string[];
    const uniqueAccents = Array.from(new Set(results.map((v) => v.accent).filter(Boolean))) as string[];
    const uniqueAges = Array.from(new Set(results.map((v) => v.age).filter(Boolean))) as string[];
    const uniqueCategories = Array.from(new Set(results.map((v) => v.category).filter(Boolean))) as string[];

    // Add defaults if they are not present to ensure English/Spanish is always visible in filters
    if (!uniqueLangs.includes("english")) uniqueLangs.push("english");
    if (!uniqueLangs.includes("spanish")) uniqueLangs.push("spanish");

    const languages = uniqueLangs.map((v) => ({ value: v, label: capitalize(v) }));
    const accents = uniqueAccents.map((v) => ({ value: v, label: capitalize(v) }));
    const ages = uniqueAges.map((v) => ({ value: v, label: capitalize(v) }));
    const categories = uniqueCategories.map((v) => ({ value: v, label: capitalize(v) }));

    const genders = [
      { value: "female", label: "Femenino" },
      { value: "male", label: "Masculino" },
    ];
    const providers = [
      { value: "elevenlabs", label: "ElevenLabs" },
      { value: "minimax", label: "Minimax" },
      { value: "kokoro", label: "Kokoro-TTS" },
      { value: "piper", label: "Piper" },
    ];

    return NextResponse.json({
      voices: filtered,
      total: filtered.length,
      filters: { genders, providers, languages, accents, ages, categories },
    });
  } catch (e: unknown) {
    console.error("GET /api/voices error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Error al listar voces", detail: message.slice(0, 300) },
      { status: 500 }
    );
  }
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
