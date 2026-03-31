import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const OPENROUTER_ACTIVITY = "https://openrouter.ai/api/v1/activity";

/**
 * GET /api/billing/openrouter-activity?date=YYYY-MM-DD
 * Actividad de la cuenta OpenRouter agrupada (p. ej. por modelo). Requiere clave de gestión.
 * @see https://openrouter.ai/docs/api-reference/analytics/get-user-activity
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const key = process.env.OPENROUTER_MANAGEMENT_KEY?.trim();
    if (!key) {
      return NextResponse.json({
        configured: false,
        message: "OPENROUTER_MANAGEMENT_KEY no configurada. Créala en OpenRouter (management key) para ver el consumo oficial por modelo.",
      });
    }

    const date = new URL(req.url).searchParams.get("date");
    const url = new URL(OPENROUTER_ACTIVITY);
    if (date) url.searchParams.set("date", date);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });

    const body: unknown = await res.json().catch(() => ({}));
    return NextResponse.json({
      configured: true,
      ok: res.ok,
      status: res.status,
      date: date ?? undefined,
      data: body,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al consultar OpenRouter" },
      { status: 500 }
    );
  }
}
