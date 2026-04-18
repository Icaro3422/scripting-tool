import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type OperationType = "script" | "thumbnail" | "scene-image" | "channel-analyze";

const BILLING_ENABLED = process.env.BILLING_ENABLED === "true";

/**
 * Estima el coste en centavos a partir de tokens.
 * OpenRouter pricing típico: ~$0.0005-0.002 por 1K tokens según modelo.
 * Usamos un promedio conservador para facturación al usuario.
 */
const CENTS_PER_1K_TOKENS = 0.2; // ~$0.002 por 1K tokens

export function estimateCostCents(inputTokens: number, outputTokens: number): number {
  const total = inputTokens + outputTokens;
  return Math.max(1, Math.round((total / 1000) * CENTS_PER_1K_TOKENS));
}

/**
 * Si OpenRouter devuelve `usage.cost` (USD), convierte a centavos de USD (entero).
 * Si no hay coste reportado o es 0, usa la estimación por tokens.
 */
export function resolveCostCents(
  inputTokens: number,
  outputTokens: number,
  actualCostUsd?: number
): number {
  if (actualCostUsd != null && Number.isFinite(actualCostUsd) && actualCostUsd > 0) {
    return Math.max(1, Math.round(actualCostUsd * 100));
  }
  return estimateCostCents(inputTokens, outputTokens);
}

type RecordUsageParams = {
  userId: string;
  operationType: OperationType;
  provider: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  /** USD reportado por OpenRouter en `usage.cost` cuando aplica */
  actualCostUsd?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Registra uso de IA y, si BILLING_ENABLED, descuenta del balance.
 * Si billing desactivado, solo registra (sin descontar).
 * Lanza si hay billing y balance insuficiente.
 */
export async function recordUsageAndDeduct(params: RecordUsageParams): Promise<{ costCents: number }> {
  const costCents = resolveCostCents(
    params.inputTokens,
    params.outputTokens,
    params.actualCostUsd
  );

  if (BILLING_ENABLED) {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { balanceCents: true },
    });
    if (!user) throw new Error("Usuario no encontrado");

    const newBalance = user.balanceCents - costCents;
    if (newBalance < 0) {
      throw new Error(
        `Saldo insuficiente. Necesitas ${(costCents / 100).toFixed(2)} (unidades de balance). Tu balance: ${(user.balanceCents / 100).toFixed(2)}. Recarga en Facturación.`
      );
    }

    await prisma.$transaction([
      prisma.usageRecord.create({
        data: {
          userId: params.userId,
          operationType: params.operationType,
          provider: params.provider,
          model: params.model ?? null,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          costCents,
          metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      }),
      prisma.user.update({
        where: { id: params.userId },
        data: { balanceCents: newBalance },
      }),
    ]);
  } else {
    await recordUsageOnly(params);
  }

  return { costCents };
}

/**
 * Registra uso sin descontar (para modo demo o cuando el balance no aplica).
 * Útil para tracking aunque no se cobre.
 */
export async function recordUsageOnly(params: RecordUsageParams): Promise<void> {
  const costCents = resolveCostCents(
    params.inputTokens,
    params.outputTokens,
    params.actualCostUsd
  );
  await prisma.usageRecord.create({
    data: {
      userId: params.userId,
      operationType: params.operationType,
      provider: params.provider,
      model: params.model ?? null,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costCents,
      metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

/** Obtiene el balance y resumen de uso del usuario */
export async function getBillingSummary(userId: string) {
  const [user, usageStats, recentUsage, usageByModel] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { balanceCents: true },
    }),
    prisma.usageRecord.aggregate({
      where: { userId },
      _sum: { costCents: true },
      _count: true,
    }),
    prisma.usageRecord.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.usageRecord.groupBy({
      by: ["model"],
      where: { userId, model: { not: null } },
      _sum: { costCents: true, inputTokens: true, outputTokens: true },
      _count: true,
    }),
  ]);

  return {
    balanceCents: user?.balanceCents ?? 0,
    totalSpentCents: usageStats._sum.costCents ?? 0,
    totalOperations: usageStats._count,
    recentUsage,
    usageByModel: usageByModel.map((row) => ({
      model: row.model as string,
      operations: row._count,
      costCents: row._sum.costCents ?? 0,
      inputTokens: row._sum.inputTokens ?? 0,
      outputTokens: row._sum.outputTokens ?? 0,
    })),
  };
}
