import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { analyzeChannel } from "@/lib/youtube";
import { generateChannelViralSummary } from "@/lib/ai/channelSummary";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    if (!process.env.YOUTUBE_API_KEY) {
      return NextResponse.json(
        {
          error: "YOUTUBE_API_KEY no configurada",
          code: "YOUTUBE_API_KEY_MISSING",
          hint: "Añade la clave en .env. Ver CONFIGURACION.md → YouTube Data API.",
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { urlOrId } = body as { urlOrId?: string };
    if (!urlOrId || typeof urlOrId !== "string") {
      return NextResponse.json({ error: "urlOrId requerido" }, { status: 400 });
    }

    let analysis = await analyzeChannel(urlOrId);
    if (!analysis) {
      return NextResponse.json({ error: "Canal no encontrado" }, { status: 404 });
    }

    if (analysis.title || analysis.description) {
      try {
        const summary = await generateChannelViralSummary(analysis);
        analysis = {
          ...analysis,
          suggestedTone: summary.suggestedTone,
          suggestedFormat: summary.suggestedFormat,
          viralSummary: summary.viralSummary,
          brandHints: summary.brandHints,
        };
      } catch (e) {
        console.warn("Channel viral summary failed:", e);
      }
    }

    // Obtener o crear user en DB (Clerk ID)
    let user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      user = await prisma.user.create({
        data: { clerkId: userId },
      });
    }

    const channel = await prisma.channel.upsert({
      where: { youtubeChannelId: analysis.channelId },
      create: {
        userId: user.id,
        youtubeChannelId: analysis.channelId,
        url: urlOrId,
        title: analysis.title,
        description: analysis.description,
        customUrl: analysis.customUrl,
        thumbnailUrl: analysis.thumbnailUrl,
        bannerUrl: analysis.bannerUrl,
        subscriberCount: analysis.subscriberCount,
        videoCount: analysis.videoCount,
        viewCount: analysis.viewCount,
        country: analysis.country,
        publishedAt: analysis.publishedAt ? new Date(analysis.publishedAt) : null,
        analysis: {
          thumbnailsSample: analysis.thumbnailsSample,
          dominantColors: analysis.dominantColors,
          suggestedTone: analysis.suggestedTone,
          suggestedFormat: analysis.suggestedFormat,
          viralSummary: analysis.viralSummary,
          brandHints: analysis.brandHints,
        },
      },
      update: {
        title: analysis.title,
        description: analysis.description,
        customUrl: analysis.customUrl,
        thumbnailUrl: analysis.thumbnailUrl,
        bannerUrl: analysis.bannerUrl,
        subscriberCount: analysis.subscriberCount,
        videoCount: analysis.videoCount,
        viewCount: analysis.viewCount,
        country: analysis.country,
        publishedAt: analysis.publishedAt ? new Date(analysis.publishedAt) : null,
        analysis: {
          thumbnailsSample: analysis.thumbnailsSample,
          dominantColors: analysis.dominantColors,
          suggestedTone: analysis.suggestedTone,
          suggestedFormat: analysis.suggestedFormat,
          viralSummary: analysis.viralSummary,
          brandHints: analysis.brandHints,
        },
      },
    });

    return NextResponse.json({ channel, analysis });
  } catch (e: unknown) {
    console.error(e);
    const isPrismaTableMissing =
      typeof e === "object" && e !== null && (e as { code?: string }).code === "P2021";
    if (isPrismaTableMissing) {
      return NextResponse.json(
        {
          error: "Base de datos no inicializada",
          code: "DB_NOT_READY",
          hint: "Ejecuta: bun run db:push. Ver CONFIGURACION.md → Base de datos.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al analizar canal" },
      { status: 500 }
    );
  }
}
