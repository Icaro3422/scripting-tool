import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { prisma } from "@/lib/db";

const maxPromptResultsPerWrite = 50;

const splitConfigSchema = z.object({
  method: z.string().min(1),
  targetChunks: z.number().int().positive().optional(),
  strictMinWords: z.number().int().positive().optional(),
  strictMaxWords: z.number().int().positive().optional(),
});

const promptResultSchema = z.object({
  fragment_id: z.number().int().positive(),
  original_text: z.string().min(1),
  image_prompt: z.string().min(1),
});

const identitySchema = z.object({
  scriptId: z.string().min(1),
  scriptContentHash: z.string().regex(/^[a-f0-9]{64}$/i),
  style: z.string().min(1).max(500),
  splitConfig: splitConfigSchema,
  fragmentCount: z.number().int().positive(),
});

const upsertSchema = identitySchema.extend({
  results: z.array(promptResultSchema).min(1).max(maxPromptResultsPerWrite),
  source: z.string().max(50).optional().default("ai"),
  replaceSet: z.boolean().optional().default(false),
});

const patchSchema = identitySchema.extend({
  fragmentId: z.number().int().positive(),
  originalText: z.string().min(1),
  imagePrompt: z.string().min(1),
});

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeStyle(style: string): string {
  return style.trim().slice(0, 500);
}

function buildIdentity(input: z.infer<typeof identitySchema>) {
  const style = normalizeStyle(input.style);
  const splitConfig = input.splitConfig;

  return {
    ...input,
    style,
    splitConfig,
    styleHash: hash(style.toLowerCase()),
    splitConfigHash: hash(stableStringify(splitConfig)),
  };
}

function validatePromptResults(results: z.infer<typeof promptResultSchema>[], fragmentCount: number) {
  const ids = new Set<number>();
  for (const result of results) {
    if (result.fragment_id > fragmentCount) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["results"],
          message: `fragment_id ${result.fragment_id} excede fragmentCount ${fragmentCount}`,
        },
      ]);
    }
    if (ids.has(result.fragment_id)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["results"],
          message: `fragment_id duplicado: ${result.fragment_id}`,
        },
      ]);
    }
    ids.add(result.fragment_id);
  }
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Solicitud inválida", details: error.flatten() },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  console.error(`[prompt-persistence] ${fallback}:`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

async function getUserVideo(
  projectId: string,
  videoId: string,
  clerkUserId: string,
) {
  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId } });
  if (!user) return { user: null, video: null };

  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      projectId,
      project: { userId: user.id },
    },
  });

  return { user, video };
}

async function assertScriptForVideo(scriptId: string, videoId: string, userId: string) {
  const script = await prisma.script.findFirst({
    where: {
      id: scriptId,
      videoId,
      userId,
    },
  });

  return script;
}

function serializePromptSet(promptSet: {
  id: string;
  scriptId: string;
  scriptContentHash: string;
  style: string;
  splitConfig: unknown;
  fragmentCount: number;
  updatedAt: Date;
  prompts: Array<{
    fragmentId: number;
    originalText: string;
    imagePrompt: string;
    source: string;
    status: string;
    updatedAt: Date;
  }>;
}) {
  return {
    promptSet: {
      id: promptSet.id,
      scriptId: promptSet.scriptId,
      scriptContentHash: promptSet.scriptContentHash,
      style: promptSet.style,
      splitConfig: promptSet.splitConfig,
      fragmentCount: promptSet.fragmentCount,
      updatedAt: promptSet.updatedAt,
    },
    results: promptSet.prompts
      .map((prompt) => ({
        fragment_id: prompt.fragmentId,
        original_text: prompt.originalText,
        image_prompt: prompt.imagePrompt,
        source: prompt.source,
        status: prompt.status,
        updatedAt: prompt.updatedAt,
      }))
      .sort((a, b) => a.fragment_id - b.fragment_id),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> },
) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id: projectId, videoId } = await params;
    const { user, video } = await getUserVideo(projectId, videoId, clerkUserId);
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (!video) return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });

    const searchParams = req.nextUrl.searchParams;
    const scriptId = searchParams.get("scriptId");
    const scriptContentHash = searchParams.get("scriptContentHash");
    const splitConfigRaw = searchParams.get("splitConfig");
    const styleRaw = searchParams.get("style");

    if (!scriptId || !scriptContentHash || !splitConfigRaw || !styleRaw?.trim()) {
      return NextResponse.json(
        { error: "scriptId, scriptContentHash, splitConfig y style son requeridos" },
        { status: 400 },
      );
    }

    const splitConfig = splitConfigSchema.parse(JSON.parse(splitConfigRaw));
    const validatedHash = z.string().regex(/^[a-f0-9]{64}$/i).parse(scriptContentHash);
    const script = await assertScriptForVideo(scriptId, video.id, user.id);
    if (!script) return NextResponse.json({ error: "Script no encontrado" }, { status: 404 });

    const splitConfigHash = hash(stableStringify(splitConfig));
    const styleHash = hash(normalizeStyle(styleRaw).toLowerCase());

    const promptSet = await prisma.imagePromptSet.findUnique({
      where: {
        image_prompt_set_identity: {
          videoId: video.id,
          scriptId,
          scriptContentHash: validatedHash,
          styleHash,
          splitConfigHash,
        },
      },
      include: { prompts: true },
    });

    if (!promptSet) {
      return NextResponse.json({ promptSet: null, results: [] });
    }

    return NextResponse.json(serializePromptSet(promptSet));
  } catch (error) {
    return errorResponse(error, "Error al cargar prompts persistidos");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> },
) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id: projectId, videoId } = await params;
    const { user, video } = await getUserVideo(projectId, videoId, clerkUserId);
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (!video) return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });

    const parsed = upsertSchema.parse(await req.json());
    validatePromptResults(parsed.results, parsed.fragmentCount);
    const script = await assertScriptForVideo(parsed.scriptId, video.id, user.id);
    if (!script) return NextResponse.json({ error: "Script no encontrado" }, { status: 404 });

    const identity = buildIdentity(parsed);
    const saved = await prisma.$transaction(async (tx) => {
      const promptSet = await tx.imagePromptSet.upsert({
        where: {
          image_prompt_set_identity: {
            videoId: video.id,
            scriptId: parsed.scriptId,
            scriptContentHash: identity.scriptContentHash,
            styleHash: identity.styleHash,
            splitConfigHash: identity.splitConfigHash,
          },
        },
        create: {
          userId: user.id,
          videoId: video.id,
          scriptId: parsed.scriptId,
          scriptContentHash: identity.scriptContentHash,
          style: identity.style,
          styleHash: identity.styleHash,
          splitConfig: identity.splitConfig,
          splitConfigHash: identity.splitConfigHash,
          fragmentCount: parsed.fragmentCount,
        },
        update: {
          style: identity.style,
          splitConfig: identity.splitConfig,
          fragmentCount: parsed.fragmentCount,
          isActive: true,
        },
      });

      if (parsed.replaceSet) {
        await tx.imagePrompt.deleteMany({ where: { promptSetId: promptSet.id } });
      }

      for (const result of parsed.results) {
        await tx.imagePrompt.upsert({
          where: {
            promptSetId_fragmentId: {
              promptSetId: promptSet.id,
              fragmentId: result.fragment_id,
            },
          },
          create: {
            promptSetId: promptSet.id,
            userId: user.id,
            fragmentId: result.fragment_id,
            originalText: result.original_text,
            imagePrompt: result.image_prompt,
            source: parsed.source,
            status: parsed.source === "manual" ? "edited" : "generated",
          },
          update: {
            originalText: result.original_text,
            imagePrompt: result.image_prompt,
            source: parsed.source,
            status: parsed.source === "manual" ? "edited" : "generated",
          },
        });
      }

      return tx.imagePromptSet.findUnique({
        where: { id: promptSet.id },
        include: { prompts: true },
      });
    });

    return NextResponse.json(saved ? serializePromptSet(saved) : { promptSet: null, results: [] });
  } catch (error) {
    return errorResponse(error, "Error al guardar prompts persistidos");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; videoId: string }> },
) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id: projectId, videoId } = await params;
    const { user, video } = await getUserVideo(projectId, videoId, clerkUserId);
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (!video) return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });

    const parsed = patchSchema.parse(await req.json());
    if (parsed.fragmentId > parsed.fragmentCount) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ["fragmentId"],
          message: `fragmentId ${parsed.fragmentId} excede fragmentCount ${parsed.fragmentCount}`,
        },
      ]);
    }
    const script = await assertScriptForVideo(parsed.scriptId, video.id, user.id);
    if (!script) return NextResponse.json({ error: "Script no encontrado" }, { status: 404 });

    const identity = buildIdentity(parsed);
    const promptSet = await prisma.imagePromptSet.upsert({
      where: {
        image_prompt_set_identity: {
          videoId: video.id,
          scriptId: parsed.scriptId,
          scriptContentHash: identity.scriptContentHash,
          styleHash: identity.styleHash,
          splitConfigHash: identity.splitConfigHash,
        },
      },
      create: {
        userId: user.id,
        videoId: video.id,
        scriptId: parsed.scriptId,
        scriptContentHash: identity.scriptContentHash,
        style: identity.style,
        styleHash: identity.styleHash,
        splitConfig: identity.splitConfig,
        splitConfigHash: identity.splitConfigHash,
        fragmentCount: parsed.fragmentCount,
      },
      update: {
        style: identity.style,
        splitConfig: identity.splitConfig,
        fragmentCount: parsed.fragmentCount,
        isActive: true,
      },
    });

    const prompt = await prisma.imagePrompt.upsert({
      where: {
        promptSetId_fragmentId: {
          promptSetId: promptSet.id,
          fragmentId: parsed.fragmentId,
        },
      },
      create: {
        promptSetId: promptSet.id,
        userId: user.id,
        fragmentId: parsed.fragmentId,
        originalText: parsed.originalText,
        imagePrompt: parsed.imagePrompt,
        source: "manual",
        status: "edited",
      },
      update: {
        originalText: parsed.originalText,
        imagePrompt: parsed.imagePrompt,
        source: "manual",
        status: "edited",
      },
    });

    return NextResponse.json({
      result: {
        fragment_id: prompt.fragmentId,
        original_text: prompt.originalText,
        image_prompt: prompt.imagePrompt,
        source: prompt.source,
        status: prompt.status,
        updatedAt: prompt.updatedAt,
      },
    });
  } catch (error) {
    return errorResponse(error, "Error al editar prompt persistido");
  }
}
