import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

async function getAuthUser() {
  const { userId } = await auth();
  if (!userId) return null;
  let user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) user = await prisma.user.create({ data: { clerkId: userId } });
  return user;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const preset = await prisma.preset.findFirst({
      where: { id, userId: user.id },
    });
    if (!preset) {
      return NextResponse.json({ error: "Preset no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const { name, description, payload } = body as {
      name?: string;
      description?: string | null;
      payload?: Record<string, unknown>;
    };

    const data: Prisma.PresetUpdateInput = {};
    if (name !== undefined) data.name = String(name).trim() || preset.name;
    if (description !== undefined) data.description = description === "" ? null : (description as string) ?? null;
    if (payload !== undefined && payload !== null && typeof payload === "object") data.payload = payload as Prisma.InputJsonValue;

    const updated = await prisma.preset.update({
      where: { id },
      data,
      include: { channel: true },
    });
    return NextResponse.json({ preset: updated });
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
    return NextResponse.json({ error: "Error al actualizar preset" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const preset = await prisma.preset.findFirst({
      where: { id, userId: user.id },
    });
    if (!preset) {
      return NextResponse.json({ error: "Preset no encontrado" }, { status: 404 });
    }

    await prisma.preset.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
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
    return NextResponse.json({ error: "Error al eliminar preset" }, { status: 500 });
  }
}
