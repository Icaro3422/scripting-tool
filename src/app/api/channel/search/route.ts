import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { searchChannels } from "@/lib/youtube";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    if (!process.env.YOUTUBE_API_KEY) {
      return NextResponse.json(
        {
          error: "YOUTUBE_API_KEY no configurada",
          code: "YOUTUBE_API_KEY_MISSING",
        },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    const order = (searchParams.get("order") as "relevance" | "viewCount" | "videoCount" | "date") ?? "relevance";
    const publishedAfter = searchParams.get("publishedAfter") ?? undefined;
    const maxResults = parseInt(searchParams.get("maxResults") ?? "12", 10);

    const channels = await searchChannels({
      q,
      order,
      publishedAfter,
      maxResults: Math.min(maxResults, 50),
    });

    return NextResponse.json({ channels });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al buscar canales" },
      { status: 500 }
    );
  }
}
