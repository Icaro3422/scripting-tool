import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const { id: projectId } = await params;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
      include: { _count: { select: { videos: true } } },
    });
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const title = (body.title as string) || `Video ${project._count.videos + 1}`;

    const video = await prisma.video.create({
      data: {
        projectId,
        title,
        status: "draft",
      },
      include: {
        scripts: true,
        thumbnails: true,
      },
    });
    return NextResponse.json({ video });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al crear video" }, { status: 500 });
  }
}
