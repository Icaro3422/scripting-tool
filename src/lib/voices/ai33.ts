/**
 * Cliente AI33 Pro – ElevenLabs & Minimax TTS
 * Docs: https://ai33.pro/app/api-document
 * Auth header: xi-api-key
 */

const AI33_BASE = "https://api.ai33.pro";

function getKey() {
  return process.env.AI33_API_KEY ?? "";
}

function ai33Headers(extra?: Record<string, string>) {
  return {
    "xi-api-key": getKey(),
    ...extra,
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type AI33TaskStatus = "doing" | "done" | "error";

export interface AI33Task {
  id: string;
  created_at: string;
  status: AI33TaskStatus;
  error_message: string | null;
  credit_cost: number;
  metadata: Record<string, unknown>;
  type: string;
  progress?: number;
}

export interface AI33TtsResponse {
  success: boolean;
  task_id: string;
  ec_remain_credits: number;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
  preview_url?: string;
  category?: string;
}

export interface MinimaxVoice {
  voice_id: string;
  voice_name: string;
  tag_list: string[];
  sample_audio?: string;
  cover_url?: string;
  gender?: string;
}

// ─── ElevenLabs ──────────────────────────────────────────────────────────────

/**
 * List recommended ElevenLabs voices (v2 endpoint).
 * Docs: GET /v2/voices
 */
export async function listElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  const res = await fetch(`${AI33_BASE}/v2/voices`, {
    headers: ai33Headers(),
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI33 listVoices (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  // ElevenLabs /v2/voices returns { voices: [...] }
  return (data?.voices ?? data ?? []) as ElevenLabsVoice[];
}

/**
 * Create ElevenLabs TTS task (async).
 * Returns task_id for polling.
 */
export async function createElevenLabsTts(opts: {
  voiceId: string;
  text: string;
  modelId?: string;
  outputFormat?: string;
}): Promise<AI33TtsResponse> {
  const { voiceId, text, modelId = "eleven_multilingual_v2", outputFormat = "mp3_44100_128" } = opts;
  const res = await fetch(
    `${AI33_BASE}/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`,
    {
      method: "POST",
      headers: ai33Headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ text, model_id: modelId }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI33 ElevenLabs TTS (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Minimax ─────────────────────────────────────────────────────────────────

/**
 * List Minimax voices (paginated).
 */
export async function listMinimaxVoices(page = 1, pageSize = 50): Promise<MinimaxVoice[]> {
  const res = await fetch(`${AI33_BASE}/v1m/voice/list`, {
    method: "POST",
    headers: ai33Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ page, page_size: pageSize, tag_list: [] }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI33 listMinimaxVoices (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data?.data?.voice_list ?? []) as MinimaxVoice[];
}

/**
 * Create Minimax TTS task (async).
 */
export async function createMinimaxTts(opts: {
  voiceId: string;
  text: string;
  model?: string;
  speed?: number;
  vol?: number;
  pitch?: number;
}): Promise<AI33TtsResponse> {
  const { voiceId, text, model = "speech-2.6-hd", speed = 1, vol = 1, pitch = 0 } = opts;
  const res = await fetch(`${AI33_BASE}/v1m/task/text-to-speech`, {
    method: "POST",
    headers: ai33Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      text,
      model,
      voice_setting: { voice_id: voiceId, vol, pitch, speed },
      language_boost: "Auto",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI33 Minimax TTS (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Common Task Polling ──────────────────────────────────────────────────────

/**
 * GET /v1/task/:taskId — poll until done or timeout.
 */
export async function getTask(taskId: string): Promise<AI33Task> {
  const res = await fetch(`${AI33_BASE}/v1/task/${taskId}`, {
    headers: ai33Headers({ "Content-Type": "application/json" }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI33 getTask (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Poll task until status = "done" | "error" or timeout.
 * @param taskId Task UUID
 * @param opts.maxMs Max wait ms (default 60_000)
 * @param opts.intervalMs Polling interval ms (default 2_000)
 */
export async function pollTask(
  taskId: string,
  opts: { maxMs?: number; intervalMs?: number } = {}
): Promise<AI33Task> {
  const { maxMs = 60_000, intervalMs = 2_000 } = opts;
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const task = await getTask(taskId);
    if (task.status === "done" || task.status === "error") return task;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("AI33 task timeout");
}
