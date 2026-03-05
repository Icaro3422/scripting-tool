import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getStorageProvider, getStorageAvailability } from "@/lib/storage";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_IMAGE_MODEL = "black-forest-labs/flux.2-pro";
const LOCAL_PREFIX = "local://";

/**
 * Construye un prompt detallado para que la IA genere la imagen de una escena del guion.
 * El texto del fragmento es la narración; la imagen debe representar visualmente ese momento.
 */
function buildSceneImagePrompt(sceneText: string): string {
  const clean = sceneText.replace(/\s+/g, " ").trim().slice(0, 800);
  return [
    "Single frame for a video. This is one scene from a script.",
    "Scene description (what is being said or shown at this moment):",
    clean,
    "Style: cinematic, 16:9 aspect ratio, high quality, detailed visual. Depict the scene clearly: characters, setting, actions, or mood as described. No text overlay, no watermarks, no logos. Photorealistic or polished illustration.",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    if (!OPENROUTER_KEY) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY no configurada", code: "OPENROUTER_KEY_MISSING" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const {
      projectId,
      fragmentIndex,
      sceneText,
      modelId = DEFAULT_IMAGE_MODEL,
      storageMode = "cloud",
    } = body as {
      projectId: string;
      fragmentIndex: number;
      sceneText: string;
      modelId?: string;
      storageMode?: "cloud" | "local";
    };

    if (!projectId || typeof fragmentIndex !== "number" || !sceneText || typeof sceneText !== "string") {
      return NextResponse.json(
        { error: "projectId, fragmentIndex y sceneText son requeridos" },
        { status: 400 }
      );
    }

    const availability = getStorageAvailability();
    if (storageMode === "cloud" && !availability.cloud) {
      return NextResponse.json(
        { error: "Cloudinary no configurado", code: "STORAGE_MISSING" },
        { status: 503 }
      );
    }

    let user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) user = await prisma.user.create({ data: { clerkId: userId } });

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
    });
    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const prompt = buildSceneImagePrompt(sceneText);

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
      console.error("OpenRouter scene image error:", res.status, err);
      return NextResponse.json(
        { error: "Error al generar la imagen de la escena", detail: err.slice(0, 200) },
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
    const pathname = `scene-images/${projectId}/${fragmentIndex}-${Date.now()}.png`;

    if (storageMode === "local") {
      const thumbnail = await prisma.thumbnail.create({
        data: {
          userId: user.id,
          projectId,
          blobUrl: `${LOCAL_PREFIX}${"scene-" + fragmentIndex}-${Date.now()}`,
          prompt,
          aiProvider: "openrouter",
          fragmentIndex,
        },
      });
      await prisma.thumbnail.update({
        where: { id: thumbnail.id },
        data: { blobUrl: `${LOCAL_PREFIX}${thumbnail.id}` },
      });
      return NextResponse.json({
        thumbnail: { ...thumbnail, blobUrl: `${LOCAL_PREFIX}${thumbnail.id}`, fragmentIndex },
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
        fragmentIndex,
      },
    });

    return NextResponse.json({
      thumbnail: { ...thumbnail, fragmentIndex },
      blobUrl,
    });
  } catch (e: unknown) {
    console.error(e);
    const isPrismaTableMissing =
      typeof e === "object" && e !== null && (e as { code?: string }).code === "P2021";
    if (isPrismaTableMissing) {
      return NextResponse.json(
        { error: "Base de datos no inicializada", code: "DB_NOT_READY" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al generar imagen de escena" },
      { status: 500 }
    );
  }
}
