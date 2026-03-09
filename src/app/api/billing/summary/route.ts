import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getBillingSummary } from "@/lib/billing";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const summary = await getBillingSummary(user.id);
    return NextResponse.json(summary);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al obtener facturación" },
      { status: 500 }
    );
  }
}
