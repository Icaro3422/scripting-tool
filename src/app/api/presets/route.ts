import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ presets: [] });

    const presets = await prisma.preset.findMany({
      where: { userId: user.id },
      include: { channel: true },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ presets });
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
    return NextResponse.json({ error: "Error al listar presets" }, { status: 500 });
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
    const { name, description, payload, channelId } = body as {
      name: string;
      description?: string;
      payload?: Record<string, unknown>;
      channelId?: string;
    };
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name es requerido" }, { status: 400 });
    }

    const preset = await prisma.preset.create({
      data: {
        userId: user.id,
        channelId: channelId || null,
        name: name.trim(),
        description: description ?? null,
        payload: (payload && typeof payload === "object" ? payload : {}) as Prisma.InputJsonValue,
      },
      include: { channel: true },
    });
    return NextResponse.json({ preset });
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
    return NextResponse.json({ error: "Error al crear preset" }, { status: 500 });
  }
}
