import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const { id } = await params;
    let project = await prisma.project.findFirst({
      where: { id, userId: user.id },
      include: {
        channel: true,
        videos: {
          orderBy: { updatedAt: "desc" },
          include: {
            scripts: { orderBy: { updatedAt: "desc" } },
            thumbnails: { orderBy: { updatedAt: "desc" } },
          },
        },
        scripts: { orderBy: { updatedAt: "desc" } },
        thumbnails: { orderBy: { updatedAt: "desc" } },
      },
    });
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    if (project.videos.length === 0) {
      const video = await prisma.video.create({
        data: {
          projectId: project.id,
          title: project.scripts.length > 0 ? project.title : "Video 1",
          description: project.description,
          status: (project as { status?: string }).status ?? "draft",
        },
      });
      if (project.scripts.length > 0 || project.thumbnails.length > 0) {
        await prisma.script.updateMany({
          where: { projectId: project.id },
          data: { videoId: video.id, projectId: null },
        });
        await prisma.thumbnail.updateMany({
          where: { projectId: project.id },
          data: { videoId: video.id, projectId: null },
        });
      }
      project = await prisma.project.findFirst({
        where: { id, userId: user.id },
        include: {
          channel: true,
          videos: {
            orderBy: { updatedAt: "desc" },
            include: {
              scripts: { orderBy: { updatedAt: "desc" } },
              thumbnails: { orderBy: { updatedAt: "desc" } },
            },
          },
          scripts: true,
          thumbnails: true,
        },
      })!;
    }
    return NextResponse.json({ project });
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
    return NextResponse.json({ error: "Error al obtener proyecto" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const { id } = await params;
    const project = await prisma.project.findFirst({
      where: { id, userId: user.id },
    });
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const body = await req.json();
    const {
      title,
      description,
      status,
      channelId,
      contentStyle,
      presetIds,
      brandColors,
      typography,
      referenceImageUrls,
    } = body as {
      title?: string;
      description?: string;
      status?: string;
      channelId?: string | null;
      contentStyle?: string;
      presetIds?: string[];
      brandColors?: string[];
      typography?: string | null;
      referenceImageUrls?: string[];
    };

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
    if (channelId !== undefined) data.channelId = channelId || null;
    if (contentStyle !== undefined) data.contentStyle = contentStyle;
    if (presetIds !== undefined && Array.isArray(presetIds)) data.presetIds = presetIds;
    if (brandColors !== undefined && Array.isArray(brandColors)) data.brandColors = brandColors;
    if (typography !== undefined) data.typography = typography || null;
    if (referenceImageUrls !== undefined && Array.isArray(referenceImageUrls))
      data.referenceImageUrls = referenceImageUrls;

    const updated = await prisma.project.update({
      where: { id },
      data,
      include: {
        channel: true,
        videos: { orderBy: { updatedAt: "desc" }, include: { scripts: true, thumbnails: true } },
      },
    });
    return NextResponse.json({ project: updated });
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
    return NextResponse.json({ error: "Error al actualizar proyecto" }, { status: 500 });
  }
}
