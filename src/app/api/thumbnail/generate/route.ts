import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getStorageProvider, getStorageAvailability } from "@/lib/storage";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_IMAGE_MODEL = "google/gemini-2.5-flash-image";
const LOCAL_PREFIX = "local://";

/** wordStyle: "few" = competencia usa pocas palabras; "many" = muchas palabras en miniatura */
function buildThumbnailPrompt(
  title: string,
  colors: string,
  referenceHint: string,
  wordStyle?: "few" | "many"
): string {
  const parts = [
    "YouTube thumbnail, viral style, high CTR. Professional, eye-catching, bold.",
    "Format: 16:9, high contrast, clear focal point.",
    `Main subject or concept: ${title}.`,
  ];
  if (wordStyle === "few") {
    parts.push("Include a bold, short text overlay: 2-4 words only. Minimal text, maximum impact.");
  } else if (wordStyle === "many") {
    parts.push("Include a prominent text overlay with more words (5-8 words). Thumbnail style with more text to match competitive niche.");
  } else {
    parts.push("Include bold text overlay if it fits.");
  }
  if (colors.trim()) {
    parts.push(`Use these colors prominently: ${colors}.`);
  }
  if (referenceHint.trim()) {
    parts.push(`Style or mood reference: ${referenceHint}.`);
  }
  parts.push("No watermarks, no logos. Clean, modern, suitable for YouTube.");
  return parts.join(" ");
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    if (!OPENROUTER_KEY) {
      return NextResponse.json(
        {
          error: "OPENROUTER_API_KEY no configurada",
          code: "OPENROUTER_KEY_MISSING",
          hint: "Añade la clave en .env para generar miniaturas con IA. Ver CONFIGURACION.md.",
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const {
      projectId,
      title,
      colors = "",
      referenceHint = "",
      modelId = DEFAULT_IMAGE_MODEL,
      storageMode = "cloud",
      presetId,
      thumbnailWordStyle: bodyWordStyle,
    } = body as {
      projectId: string;
      title: string;
      colors?: string;
      referenceHint?: string;
      modelId?: string;
      storageMode?: "cloud" | "local";
      presetId?: string;
      /** "few" = pocas palabras (2-4), "many" = muchas palabras (5-8). Si no se envía, se usa preset. */
      thumbnailWordStyle?: "few" | "many";
    };

    const availability = getStorageAvailability();
    if (storageMode === "cloud" && !availability.cloud) {
      return NextResponse.json(
        {
          error: "Cloudinary no configurado",
          code: "STORAGE_MISSING",
          hint: "Añade CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en .env, o usa modo Local en Configuración.",
        },
        { status: 503 }
      );
    }

    if (!projectId || !title || typeof title !== "string") {
      return NextResponse.json(
        { error: "projectId y title son requeridos" },
        { status: 400 }
      );
    }

    let user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      user = await prisma.user.create({ data: { clerkId: userId } });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
    });
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    let thumbnailWordStyle: "few" | "many" | undefined =
      bodyWordStyle === "few" || bodyWordStyle === "many" ? bodyWordStyle : undefined;
    if (thumbnailWordStyle == null && presetId) {
      const preset = await prisma.preset.findFirst({
        where: { id: presetId, userId: user.id },
      });
      const payload = preset?.payload as Record<string, unknown> | null;
      if (payload?.thumbnailWordStyle === "few" || payload?.thumbnailWordStyle === "many") {
        thumbnailWordStyle = payload.thumbnailWordStyle as "few" | "many";
      }
    }

    const prompt = buildThumbnailPrompt(
      title.slice(0, 200),
      typeof colors === "string" ? colors : "",
      typeof referenceHint === "string" ? referenceHint : "",
      thumbnailWordStyle
    );

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      },
      body: JSON.stringify({
        model: modelId || DEFAULT_IMAGE_MODEL,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
        image_config: { aspect_ratio: "16:9" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenRouter image error:", res.status, err);
      return NextResponse.json(
        { error: "Error al generar la imagen", detail: err.slice(0, 200) },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: {
        message?: {
          images?: Array<{ image_url?: { url?: string }; imageUrl?: { url?: string } }>;
        };
      }[];
    };
    const firstImage = data.choices?.[0]?.message?.images?.[0];
    const imageUrl = firstImage?.image_url?.url ?? (firstImage as { imageUrl?: { url?: string } })?.imageUrl?.url;
    if (!imageUrl || !imageUrl.startsWith("data:")) {
      return NextResponse.json(
        { error: "La API no devolvió una imagen" },
        { status: 502 }
      );
    }

    const base64 = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    const pathname = `thumbnails/${projectId}/${Date.now()}.png`;

    if (storageMode === "local") {
      const thumbnail = await prisma.thumbnail.create({
        data: {
          userId: user.id,
          projectId,
          blobUrl: `${LOCAL_PREFIX}temp-${Date.now()}`,
          prompt,
          aiProvider: "openrouter",
        },
      });
      await prisma.thumbnail.update({
        where: { id: thumbnail.id },
        data: { blobUrl: `${LOCAL_PREFIX}${thumbnail.id}` },
      });
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "thumbnail_ready" },
      });
      return NextResponse.json({
        thumbnail: { ...thumbnail, blobUrl: `${LOCAL_PREFIX}${thumbnail.id}` },
        imageBase64: base64,
        contentType: "image/png",
      });
    }

    const provider = getStorageProvider("cloud");
    if (!provider) {
      return NextResponse.json(
        { error: "Cloudinary no configurado", code: "STORAGE_MISSING" },
        { status: 503 }
      );
    }
    const { url: blobUrl } = await provider.upload(pathname, buffer, { contentType: "image/png" });

    const thumbnail = await prisma.thumbnail.create({
      data: {
        userId: user.id,
        projectId,
        blobUrl,
        prompt,
        aiProvider: "openrouter",
      },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "thumbnail_ready" },
    });

    return NextResponse.json({ thumbnail, blobUrl });
  } catch (e: unknown) {
    console.error(e);
    const isPrismaTableMissing =
      typeof e === "object" && e !== null && (e as { code?: string }).code === "P2021";
    if (isPrismaTableMissing) {
      return NextResponse.json(
        {
          error: "Base de datos no inicializada",
          code: "DB_NOT_READY",
          hint: "Ejecuta: bun run db:push. Ver CONFIGURACION.md.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al generar miniatura" },
      { status: 500 }
    );
  }
}
