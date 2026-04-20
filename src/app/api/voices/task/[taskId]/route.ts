import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/lib/voices/ai33";

/**
 * GET /api/voices/task/[taskId]
 * Proxy to AI33 GET /v1/task/:taskId for client-side polling.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const key = process.env.AI33_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "AI33_API_KEY no configurada" }, { status: 503 });
  }

  const { taskId } = await params;
  if (!taskId) {
    return NextResponse.json({ error: "taskId requerido" }, { status: 400 });
  }

  try {
    const task = await getTask(taskId);
    return NextResponse.json(task);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Error al consultar tarea", detail: message.slice(0, 200) },
      { status: 500 }
    );
  }
}
