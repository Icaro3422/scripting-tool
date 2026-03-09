import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const { id: projectId, videoId } = await params;
    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        projectId,
        project: { userId: user.id },
      },
      include: {
        project: { include: { channel: true } },
        scripts: { orderBy: { updatedAt: "desc" } },
        thumbnails: { orderBy: { updatedAt: "desc" } },
      },
    });
    if (!video) return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
    return NextResponse.json({ video });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al obtener video" }, { status: 500 });
  }
}
