import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { uploadBlob } from "@/lib/blob";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_IMAGE_MODEL = "black-forest-labs/flux.2-pro";

/** Construye el prompt para una miniatura viral de YouTube (estilo gancho, contraste, texto) */
function buildThumbnailPrompt(title: string, colors: string, referenceHint: string): string {
  const parts = [
    "YouTube thumbnail, viral style, high CTR. Professional, eye-catching, bold.",
    "Format: 16:9, high contrast, clear focal point. Include bold text overlay if it fits.",
    `Main subject or concept: ${title}.`,
  ];
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

    const key = process.env.BLOB_READ_WRITE_TOKEN;
    if (!key) {
      return NextResponse.json(
        {
          error: "BLOB_READ_WRITE_TOKEN no configurada",
          code: "BLOB_MISSING",
          hint: "Necesaria para guardar la miniatura. Ver CONFIGURACION.md → Vercel Blob.",
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
    } = body as {
      projectId: string;
      title: string;
      colors?: string;
      referenceHint?: string;
      modelId?: string;
    };

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

    const prompt = buildThumbnailPrompt(
      title.slice(0, 200),
      typeof colors === "string" ? colors : "",
      typeof referenceHint === "string" ? referenceHint : ""
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
    const { url: blobUrl } = await uploadBlob(pathname, buffer, { contentType: "image/png" });

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
