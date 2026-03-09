import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

/**
 * Publica un video en YouTube. Requiere OAuth2 del usuario (no solo API key).
 * Por ahora devuelve error indicando que la publicación directa requiere OAuth.
 */
export async function POST(
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
        scripts: { orderBy: { createdAt: "desc" }, take: 1 },
        thumbnails: { where: { fragmentIndex: null }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!video) return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });

    const hasScript = video.scripts.length > 0;
    const hasTitle = !!video.title?.trim();
    const hasDescription = !!video.description?.trim();
    const hasThumbnail = video.thumbnails.length > 0;
    if (!hasScript || !hasTitle || !hasDescription || !hasThumbnail) {
      return NextResponse.json(
        { error: "El video debe tener script, título, descripción y miniatura para publicar" },
        { status: 400 }
      );
    }

    if (!video.project.channel) {
      return NextResponse.json(
        { error: "Conecta un canal de YouTube al proyecto para publicar" },
        { status: 400 }
      );
    }

    // TODO: Implementar OAuth2 con Google y videos.insert de YouTube API
    // Por ahora devolvemos un mensaje informativo
    return NextResponse.json({
      error: "Publicación directa en desarrollo",
      code: "OAUTH_REQUIRED",
      hint: "La publicación en YouTube requiere conectar tu cuenta de Google con OAuth2. Esta funcionalidad estará disponible próximamente.",
    }, { status: 501 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al publicar" }, { status: 500 });
  }
}
