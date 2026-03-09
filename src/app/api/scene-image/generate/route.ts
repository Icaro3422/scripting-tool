import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getStorageProvider, getStorageAvailability } from "@/lib/storage";
import { recordUsageAndDeduct } from "@/lib/billing";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_IMAGE_MODEL = "black-forest-labs/flux.2-pro";
const LOCAL_PREFIX = "local://";

/**
 * Construye un prompt detallado para que la IA genere la imagen de una escena del guion.
 * El texto del fragmento es la narración; la imagen debe representar visualmente ese momento.
 * Si hay imagen de referencia, se añade instrucción en el prompt (la imagen se envía aparte en content).
 */
function buildSceneImagePrompt(sceneText: string, hasReferenceImage: boolean): string {
  const clean = sceneText.replace(/\s+/g, " ").trim().slice(0, 800);
  const styleInstruction = hasReferenceImage
    ? "Match the visual style, colors, lighting, and mood of the reference image provided. Keep consistency with that aesthetic."
    : "Style: cinematic, 16:9 aspect ratio, high quality, detailed visual.";
  return [
    "Single frame for a video. This is one scene from a script.",
    "Scene description (what is being said or shown at this moment):",
    clean,
    `${styleInstruction} Depict the scene clearly: characters, setting, actions, or mood as described. No text overlay, no watermarks, no logos. Photorealistic or polished illustration.`,
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
      projectId: projectIdParam,
      videoId,
      fragmentIndex,
      sceneText,
      modelId = DEFAULT_IMAGE_MODEL,
      storageMode = "cloud",
      referenceImageBase64,
    } = body as {
      projectId?: string;
      videoId?: string;
      fragmentIndex: number;
      sceneText: string;
      modelId?: string;
      storageMode?: "cloud" | "local";
      referenceImageBase64?: string;
    };

    if ((!projectIdParam && !videoId) || typeof fragmentIndex !== "number" || !sceneText || typeof sceneText !== "string") {
      return NextResponse.json(
        { error: "projectId o videoId, fragmentIndex y sceneText son requeridos" },
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

    let projectId: string;
    let targetVideoId: string | null = null;
    if (videoId) {
      const v = await prisma.video.findFirst({
        where: { id: videoId, project: { userId: user.id } },
      });
      if (!v) return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
      projectId = v.projectId;
      targetVideoId = v.id;
    } else {
      const p = await prisma.project.findFirst({
        where: { id: projectIdParam!, userId: user.id },
      });
      if (!p) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
      projectId = p.id;
    }

    const hasReferenceImage = Boolean(
      referenceImageBase64 &&
      typeof referenceImageBase64 === "string" &&
      referenceImageBase64.startsWith("data:image/")
    );
    const prompt = buildSceneImagePrompt(sceneText, hasReferenceImage);

    const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
      { type: "text", text: prompt },
    ];
    if (hasReferenceImage && referenceImageBase64) {
      content.push({ type: "image_url", image_url: { url: referenceImageBase64 as string } });
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      },
      body: JSON.stringify({
        model: modelId || DEFAULT_IMAGE_MODEL,
        messages: [{ role: "user", content }],
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
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const inputTokens = data.usage?.prompt_tokens ?? 500;
    const outputTokens = data.usage?.completion_tokens ?? 500;
    await recordUsageAndDeduct({
      userId: user.id,
      operationType: "scene-image",
      provider: "openrouter",
      model: modelId || DEFAULT_IMAGE_MODEL,
      inputTokens,
      outputTokens,
      metadata: { fragmentIndex },
    });
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
          videoId: targetVideoId,
          projectId: targetVideoId ? null : projectId,
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
        videoId: targetVideoId,
        projectId: targetVideoId ? null : projectId,
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
    const msg = e instanceof Error ? e.message : "Error al generar imagen de escena";
    const isPrismaTableMissing =
      typeof e === "object" && e !== null && (e as { code?: string }).code === "P2021";
    if (isPrismaTableMissing) {
      return NextResponse.json(
        { error: "Base de datos no inicializada", code: "DB_NOT_READY" },
        { status: 503 }
      );
    }
    if (msg.includes("Saldo insuficiente")) {
      return NextResponse.json({ error: msg, code: "INSUFFICIENT_BALANCE" }, { status: 402 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
