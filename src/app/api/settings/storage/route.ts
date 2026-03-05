import { NextResponse } from "next/server";
import { getStorageAvailability } from "@/lib/storage";

/**
 * GET: disponibilidad de modos de almacenamiento (cloud con Cloudinary, local siempre).
 */
export async function GET() {
  const availability = getStorageAvailability();
  return NextResponse.json(availability);
}
