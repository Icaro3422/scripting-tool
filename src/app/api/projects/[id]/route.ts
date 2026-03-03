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
    const project = await prisma.project.findFirst({
      where: { id, userId: user.id },
      include: {
        channel: true,
        scripts: { orderBy: { updatedAt: "desc" } },
        thumbnails: { orderBy: { updatedAt: "desc" } },
      },
    });
    if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
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
    const { title, description, status } = body as {
      title?: string;
      description?: string;
      status?: string;
    };

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
      },
      include: { channel: true, scripts: true, thumbnails: true },
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
