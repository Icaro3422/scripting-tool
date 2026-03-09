import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

/** Lista los canales analizados del usuario para vincular a proyectos */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ channels: [] });

    const channels = await prisma.channel.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ channels });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: "Error al listar canales" }, { status: 500 });
  }
}
