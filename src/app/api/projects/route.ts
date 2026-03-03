import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ projects: [] });

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      include: {
        channel: true,
        scripts: { orderBy: { updatedAt: "desc" }, take: 1 },
        thumbnails: { orderBy: { updatedAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ projects });
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
    return NextResponse.json({ error: "Error al listar proyectos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    let user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      user = await prisma.user.create({ data: { clerkId: userId } });
    }

    const body = await req.json();
    const { title, description, channelId } = body as {
      title: string;
      description?: string;
      channelId?: string;
    };
    if (!title) {
      return NextResponse.json({ error: "title requerido" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        channelId: channelId ?? null,
        title,
        description: description ?? null,
      },
      include: { channel: true },
    });
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
    return NextResponse.json({ error: "Error al crear proyecto" }, { status: 500 });
  }
}
