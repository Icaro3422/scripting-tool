import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStorageAvailability } from "@/lib/storage";

/**
 * GET: disponibilidad de modos de almacenamiento (cloud con Cloudinary, local siempre).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const availability = getStorageAvailability();
  return NextResponse.json(availability);
}
