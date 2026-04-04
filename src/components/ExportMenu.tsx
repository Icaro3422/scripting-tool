"use client";

import { FileJson, FileSpreadsheet } from "lucide-react";
import { type PromptResult, toJsonExport, toCsvExport, downloadFile } from "@/lib/text-processing";

interface ExportMenuProps {
  prompts: PromptResult[];
  disabled?: boolean;
}

export function ExportMenu({ prompts, disabled = false }: ExportMenuProps) {
  const timestamp = new Date().toLocaleDateString("sv-SE");

  function handleExportJson() {
    const content = toJsonExport(prompts);
    downloadFile(content, `prompts-${timestamp}.json`, "application/json");
  }

  function handleExportCsv() {
    const content = toCsvExport(prompts);
    downloadFile(content, `prompts-${timestamp}.csv`, "text/csv");
  }

  if (!prompts.length) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[rgb(var(--text-muted))]">Exportar:</span>
      <button
        type="button"
        onClick={handleExportJson}
        disabled={disabled}
        className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-surface))] disabled:opacity-50 flex items-center gap-1.5"
      >
        <FileJson className="h-3.5 w-3.5" />
        JSON
      </button>
      <button
        type="button"
        onClick={handleExportCsv}
        disabled={disabled}
        className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-surface))] disabled:opacity-50 flex items-center gap-1.5"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        CSV
      </button>
    </div>
  );
}
