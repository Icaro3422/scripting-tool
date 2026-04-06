export type UsageByModelRow = {
  model: string;
  operations: number;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
};

export type BillingSummary = {
  balanceCents: number;
  totalSpentCents: number;
  totalOperations: number;
  usageByModel?: UsageByModelRow[];
  recentUsage: Array<{
    id: string;
    operationType: string;
    provider: string;
    model: string | null;
    costCents: number;
    createdAt: string;
  }>;
};

export type OpenRouterActivityState =
  | { loading: true }
  | {
    loading: false;
    configured: false;
    message?: string;
  }
  | {
    loading: false;
    configured: true;
    ok: boolean;
    status: number;
    date?: string;
    data: unknown;
  };
