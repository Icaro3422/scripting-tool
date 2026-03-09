"use client";

import { useEffect, useState } from "react";
import { Wallet, History, Loader2 } from "lucide-react";

const CURRENCY_OPTIONS: Intl.NumberFormatOptions = {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
};

function formatCop(cents: number): string {
  return (cents / 100).toLocaleString("es-CO", CURRENCY_OPTIONS);
}

const OPERATION_LABELS: Record<string, string> = {
  script: "Guion / Título / Descripción / Tags",
  thumbnail: "Miniatura",
  "scene-image": "Imagen de escena",
  "channel-analyze": "Análisis de canal",
};

export default function BillingPage() {
  const [summary, setSummary] = useState<{
    balanceCents: number;
    totalSpentCents: number;
    totalOperations: number;
    recentUsage: Array<{
      id: string;
      operationType: string;
      provider: string;
      model: string | null;
      costCents: number;
      createdAt: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/summary")
      .then((r) => r.json())
      .then((data) => {
        if (data.balanceCents !== undefined) setSummary(data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-[rgb(var(--text-muted))]">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando facturación...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-xl font-semibold text-[rgb(var(--text-primary))] mb-2">
        Facturación y uso de IA
      </h1>
      <p className="text-sm text-[rgb(var(--text-muted))] mb-6">
        Balance unificado del consumo de IA en tus APIs conectadas (OpenRouter, OpenAI, etc.). Consulta aquí lo que gastas sin tener que revisar cada proveedor por separado.
      </p>

      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="h-8 w-8 text-[rgb(var(--accent))]" />
          <div>
            <p className="text-sm font-medium text-[rgb(var(--text-muted))]">Balance estimado</p>
            <p className="text-2xl font-bold text-[rgb(var(--text-primary))]">
              {formatCop(summary?.balanceCents ?? 0)}
            </p>
          </div>
        </div>
        <p className="text-xs text-[rgb(var(--text-muted))]">
          Con <code className="bg-[rgb(var(--bg-muted))] px-1 rounded">BILLING_ENABLED=true</code> se descuenta del balance al generar contenido. Con <code className="bg-[rgb(var(--bg-muted))] px-1 rounded">false</code> solo se registra el uso.
        </p>
      </div>

      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-6">
        <h2 className="font-medium text-[rgb(var(--text-primary))] mb-4 flex items-center gap-2">
          <History className="h-5 w-5" />
          Historial de uso
        </h2>
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <span className="text-[rgb(var(--text-secondary))]">
            Total consumido: <strong className="text-[rgb(var(--text-primary))]">{formatCop(summary?.totalSpentCents ?? 0)}</strong>
          </span>
          <span className="text-[rgb(var(--text-secondary))]">
            Operaciones: <strong className="text-[rgb(var(--text-primary))]">{summary?.totalOperations ?? 0}</strong>
          </span>
        </div>
        {summary?.recentUsage && summary.recentUsage.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {summary.recentUsage.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between py-2 border-b border-[rgb(var(--border))] last:border-0 text-sm"
              >
                <div>
                  <span className="text-[rgb(var(--text-primary))]">
                    {OPERATION_LABELS[r.operationType] ?? r.operationType}
                  </span>
                  <span className="text-[rgb(var(--text-muted))] ml-2">
                    {r.provider} {r.model ? `· ${r.model}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[rgb(var(--text-muted))]">
                    {new Date(r.createdAt).toLocaleDateString("es")}
                  </span>
                  <span className="font-medium text-[rgb(var(--text-primary))]">
                    {formatCop(r.costCents)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[rgb(var(--text-muted))]">Aún no hay registros de uso.</p>
        )}
      </div>

      <p className="text-xs text-[rgb(var(--text-muted))] mt-6">
        Los pagos a OpenRouter, OpenAI y otros proveedores se gestionan directamente en sus cuentas. Esta vista te ayuda a ver el consumo agregado.
      </p>
    </div>
  );
}
