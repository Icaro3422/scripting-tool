import { NextRequest, NextResponse } from "next/server";
import { getVoiceFilters, filterVoices, type VoiceGender } from "@/lib/voices/voiceCatalog";

/**
 * GET /api/voices
 * Lista voces con filtros: idioma, región, género.
 * Query: ?lang=es &region=ES &gender=female
 * Devuelve también las opciones de filtros (languages, regions, genders) para los dropdowns.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = searchParams.get("lang") ?? undefined;
    const region = searchParams.get("region") ?? undefined;
    const gender = (searchParams.get("gender") as VoiceGender) ?? undefined;

    const filters = getVoiceFilters();
    const voices = filterVoices({
      languageCode: lang,
      region,
      gender,
    });

    return NextResponse.json({
      voices,
      filters: {
        languages: filters.languages,
        regions: filters.regions,
        genders: filters.genders,
      },
      total: voices.length,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Error al listar voces" },
      { status: 500 }
    );
  }
}
