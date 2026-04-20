"use client";

import { useState } from "react";
import { Wallet, History, Loader2, BarChart3 } from "lucide-react";
import { useBillingSummary, useOpenRouterActivity } from "@/hooks/use-billing";
import {
  OPERATION_LABELS,
  formatUsdFromInternalCents,
  extractActivityRows,
  formatCellValue,
} from "@/lib/billing-ui";

export default function BillingPage() {
  const { summary, loading } = useBillingSummary();
  const { state: orActivity, fetchActivity } = useOpenRouterActivity();
  const [activityDate, setActivityDate] = useState("");

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-[rgb(var(--text-muted))]">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando facturación...
      </div>
    );
  }

  const usageByModel = summary?.usageByModel ?? [];
  const orRows =
    orActivity.loading === false && orActivity.configured && "data" in orActivity
      ? extractActivityRows(orActivity.data)
      : null;

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-xl font-semibold text-[rgb(var(--text-primary))] mb-2">
        Facturación y uso de IA
      </h1>
      <p className="text-sm text-[rgb(var(--text-muted))] mb-6">
        Balance y registro de uso en esta app. Con OpenRouter, el descuento puede basarse en el coste
        real (<code className="bg-[rgb(var(--bg-muted))] px-1 rounded text-xs">usage.cost</code> en USD).
      </p>

      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Wallet className="h-8 w-8 text-[rgb(var(--accent))]" />
          <div>
            <p className="text-sm font-medium text-[rgb(var(--text-muted))]">Balance (créditos internos)</p>
            <p className="text-2xl font-bold text-[rgb(var(--text-primary))]">
              {formatUsdFromInternalCents(summary?.balanceCents ?? 0)}
            </p>
          </div>
        </div>
        <p className="text-xs text-[rgb(var(--text-muted))]">
          Con <code className="bg-[rgb(var(--bg-muted))] px-1 rounded">BILLING_ENABLED=true</code> se descuenta
          del balance al generar contenido. Con <code className="bg-[rgb(var(--bg-muted))] px-1 rounded">false</code>{" "}
          solo se registra el uso. Los importes mostrados usan la misma escala que los créditos registrados (≈ USD
          cuando el proveedor informa coste).
        </p>
      </div>

      {usageByModel.length > 0 && (
        <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-6 mb-6">
          <h2 className="font-medium text-[rgb(var(--text-primary))] mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Uso en esta app por modelo
          </h2>
          <p className="text-xs text-[rgb(var(--text-muted))] mb-3">
            Agregado desde los registros guardados en tu cuenta (todas las operaciones registradas).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[rgb(var(--border))] text-left text-[rgb(var(--text-muted))]">
                  <th className="py-2 pr-4 font-medium">Modelo</th>
                  <th className="py-2 pr-4 font-medium">Ops</th>
                  <th className="py-2 pr-4 font-medium">Tokens in</th>
                  <th className="py-2 pr-4 font-medium">Tokens out</th>
                  <th className="py-2 font-medium">Coste reg.</th>
                </tr>
              </thead>
              <tbody>
                {usageByModel.map((row) => (
                  <tr key={row.model} className="border-b border-[rgb(var(--border))] last:border-0">
                    <td className="py-2 pr-4 text-[rgb(var(--text-primary))] break-all max-w-[200px]">
                      {row.model}
                    </td>
                    <td className="py-2 pr-4 text-[rgb(var(--text-secondary))]">{row.operations}</td>
                    <td className="py-2 pr-4 text-[rgb(var(--text-secondary))]">
                      {row.inputTokens.toLocaleString("es")}
                    </td>
                    <td className="py-2 pr-4 text-[rgb(var(--text-secondary))]">
                      {row.outputTokens.toLocaleString("es")}
                    </td>
                    <td className="py-2 text-[rgb(var(--text-primary))] font-medium">
                      {formatUsdFromInternalCents(row.costCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-6 mb-6">
        <h2 className="font-medium text-[rgb(var(--text-primary))] mb-2 flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Consumo OpenRouter (API oficial)
        </h2>
        <p className="text-xs text-[rgb(var(--text-muted))] mb-4">
          Datos de la cuenta OpenRouter (por modelo / día según su API). Configura{" "}
          <code className="bg-[rgb(var(--bg-muted))] px-1 rounded">OPENROUTER_MANAGEMENT_KEY</code> en el servidor.
        </p>

        {orActivity.loading ? (
          <div className="flex items-center gap-2 text-[rgb(var(--text-muted))] text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando actividad…
          </div>
        ) : !orActivity.configured ? (
          <p className="text-sm text-[rgb(var(--text-muted))]">
            {(orActivity as { message?: string }).message ??
              "Añade OPENROUTER_MANAGEMENT_KEY en .env para ver el desglose oficial."}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--text-muted))] mb-1">
                  Fecha UTC (opcional)
                </label>
                <input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-sm text-[rgb(var(--text-primary))]"
                />
              </div>
              <button
                type="button"
                onClick={() => fetchActivity(activityDate)}
                className="rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
              >
                Consultar
              </button>
            </div>
            {!orActivity.ok && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
                Respuesta OpenRouter: HTTP {orActivity.status}. Revisa la clave de gestión o el rango de fechas
                permitido.
              </p>
            )}
            {orRows && orRows.length > 0 ? (
              <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-lg border border-[rgb(var(--border))]">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-[rgb(var(--bg-muted))]">
                    <tr className="text-left text-[rgb(var(--text-muted))]">
                      {Object.keys(orRows[0]).map((k) => (
                        <th key={k} className="py-2 px-2 font-medium whitespace-nowrap">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orRows.map((row, i) => (
                      <tr key={i} className="border-t border-[rgb(var(--border))]">
                        {Object.keys(orRows[0]).map((k) => (
                          <td key={k} className="py-1.5 px-2 text-[rgb(var(--text-primary))] break-all max-w-[240px]">
                            {formatCellValue(row[k])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : orActivity.ok ? (
              <p className="text-sm text-[rgb(var(--text-muted))]">
                No hay filas en formato tabla en la respuesta. Estructura recibida (referencia):
              </p>
            ) : null}
            {!orRows?.length && orActivity.configured && "data" in orActivity && (
              <pre className="mt-2 text-xs bg-[rgb(var(--bg-muted))] p-3 rounded-lg overflow-x-auto max-h-48 text-[rgb(var(--text-secondary))]">
                {JSON.stringify(orActivity.data, null, 2)}
              </pre>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-6">
        <h2 className="font-medium text-[rgb(var(--text-primary))] mb-4 flex items-center gap-2">
          <History className="h-5 w-5" />
          Historial de uso
        </h2>
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <span className="text-[rgb(var(--text-secondary))]">
            Total consumido:{" "}
            <strong className="text-[rgb(var(--text-primary))]">
              {formatUsdFromInternalCents(summary?.totalSpentCents ?? 0)}
            </strong>
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
                    {formatUsdFromInternalCents(r.costCents)}
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
        Los pagos a OpenRouter, OpenAI y otros proveedores se gestionan en sus cuentas. Esta vista resume lo que esta
        aplicación registra y, si configuras la clave de gestión, el informe oficial de OpenRouter.
      </p>
    </div>
  );
}


