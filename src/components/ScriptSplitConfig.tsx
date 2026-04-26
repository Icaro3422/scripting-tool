"use client";

import { useState, useMemo } from "react";
import { countWords, previewStrictFragmentCount, previewFragmentCount, type SplitMethod, type SplitConfigState } from "@/lib/text-processing";
import { Settings2, Hash, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type { SplitMethod, SplitConfigState };

interface ScriptSplitConfigProps {
  scriptContent: string;
  onMethodChange?: (method: SplitMethod, config: SplitConfigState) => void;
  /**
   * Initial method - only applied on mount.
   * For controlled component, manage state in parent and pass via initialConfig.
   */
  initialMethod?: SplitMethod;
  /**
   * Initial config - only applied on mount.
   * For controlled component, manage state in parent and update via onMethodChange.
   */
  initialConfig?: Partial<SplitConfigState>;
}

const DEFAULT_CONFIG: SplitConfigState = {
  method: "strict",
  targetChunks: 10,
  strictMinWords: 15,
  strictMaxWords: 21,
};

/**
 * Safely parse a number input value, distinguishing empty/NaN from 0.
 */
function parseNumberInput(value: string, fallback: number): number {
  if (value === "") return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function ScriptSplitConfig({
  scriptContent,
  onMethodChange,
  initialMethod,
  initialConfig,
}: ScriptSplitConfigProps) {
  const [config, setConfig] = useState<SplitConfigState>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
    method: initialMethod ?? initialConfig?.method ?? DEFAULT_CONFIG.method,
  });

  const { fragmentCount, wordCount } = useMemo(() => {
    if (!scriptContent.trim()) {
      return { fragmentCount: 0, wordCount: 0 };
    }

    const wc = countWords(scriptContent);

    // Use preview helpers to estimate fragment count for UI
    const fc = config.method === "strict"
      ? previewStrictFragmentCount(scriptContent, { minWords: config.strictMinWords, maxWords: config.strictMaxWords })
      : previewFragmentCount(scriptContent, config.targetChunks);

    return { fragmentCount: fc, wordCount: wc };
  }, [scriptContent, config]);

  function handleMethodChange(newMethod: SplitMethod) {
    const newConfig = { ...config, method: newMethod };
    setConfig(newConfig);
    onMethodChange?.(newMethod, newConfig);
  }

  type NumericConfigKey = "targetChunks" | "strictMinWords" | "strictMaxWords";

  function handleConfigChange(key: NumericConfigKey, value: number) {
    const newConfig: SplitConfigState = { ...config, [key]: value };

    // Ensure min <= max when updating either field
    if (key === "strictMinWords" && value > newConfig.strictMaxWords) {
      newConfig.strictMaxWords = value;
    } else if (key === "strictMaxWords" && value < newConfig.strictMinWords) {
      newConfig.strictMinWords = value;
    }

    setConfig(newConfig);
    onMethodChange?.(newConfig.method, newConfig);
  }

  if (!scriptContent.trim()) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Settings2 className="h-4 w-4 text-[rgb(var(--text-muted))]" />
        <h3 className="text-sm font-medium text-[rgb(var(--text-primary))]">
          Método de división del guion
        </h3>
      </div>

      {/* Method selector toggle */}
      <div className="flex gap-2 mb-4" role="group" aria-label="Split method">
        <button
          type="button"
          aria-pressed={config.method === "strict"}
          onClick={() => handleMethodChange("strict")}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition",
            config.method === "strict"
              ? "bg-[rgb(var(--accent))] text-white"
              : "bg-[rgb(var(--bg-muted))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]"
          )}
        >
          <Hash className="h-4 w-4" />
          Por palabras ({config.strictMinWords}-{config.strictMaxWords})
        </button>
        <button
          type="button"
          aria-pressed={config.method === "count"}
          onClick={() => handleMethodChange("count")}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition",
            config.method === "count"
              ? "bg-[rgb(var(--accent))] text-white"
              : "bg-[rgb(var(--bg-muted))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]"
          )}
        >
          <List className="h-4 w-4" />
          Por cantidad de escenas
        </button>
      </div>

      {/* Additional config per method */}
      {config.method === "count" && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label htmlFor="targetChunks" className="text-sm text-[rgb(var(--text-muted))]">
            Número de escenas:
          </label>
          <input
            id="targetChunks"
            type="text"
            inputMode="numeric"
            defaultValue={config.targetChunks}
            onChange={(e) => {
              e.target.value = e.target.value.replace(/[^0-9]/g, "");
              const val = e.target.value;
              if (val === "") return;
              const num = parseInt(val, 10);
              if (num > 0 && num <= 500) {
                handleConfigChange("targetChunks", num);
              }
            }}
            onBlur={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, "");
              const num = parseInt(val || "10", 10);
              if (num < 2) {
                handleConfigChange("targetChunks", 10);
              } else if (num > 500) {
                handleConfigChange("targetChunks", 500);
              }
            }}
            placeholder="10"
            className="w-20 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-2 py-1.5 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
          />
          <span className="text-xs text-[rgb(var(--text-muted))]">(2-500)</span>
        </div>
      )}

      {config.method === "strict" && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label htmlFor="strictMinWords" className="text-sm text-[rgb(var(--text-muted))]">
            Palabras por escena:
          </label>
          <input
            id="strictMinWords"
            type="text"
            inputMode="numeric"
            defaultValue={config.strictMinWords}
            onChange={(e) => {
              e.target.value = e.target.value.replace(/[^0-9]/g, "");
              const val = e.target.value;
              if (val === "") return;
              const num = parseInt(val, 10);
              if (num > 0 && num <= 100) {
                handleConfigChange("strictMinWords", num);
              }
            }}
            onBlur={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, "");
              const num = parseInt(val || "15", 10);
              if (num < 5) {
                handleConfigChange("strictMinWords", 5);
              } else if (num > 100) {
                handleConfigChange("strictMinWords", 100);
              }
            }}
            placeholder="15"
            className="w-20 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-2 py-1.5 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
          />
          <span className="text-sm text-[rgb(var(--text-muted))]">a</span>
          <input
            id="strictMaxWords"
            type="text"
            inputMode="numeric"
            defaultValue={config.strictMaxWords}
            onChange={(e) => {
              e.target.value = e.target.value.replace(/[^0-9]/g, "");
              const val = e.target.value;
              if (val === "") return;
              const num = parseInt(val, 10);
              if (num > 0 && num <= 100) {
                handleConfigChange("strictMaxWords", num);
              }
            }}
            onBlur={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, "");
              const num = parseInt(val || "21", 10);
              if (num < 5) {
                handleConfigChange("strictMaxWords", 5);
              } else if (num > 100) {
                handleConfigChange("strictMaxWords", 100);
              }
            }}
            placeholder="21"
            className="w-20 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-2 py-1.5 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
          />
        </div>
      )}

      {/* Preview stats */}
      <div className="rounded-lg bg-[rgb(var(--bg-muted))] p-3 text-sm flex flex-wrap gap-x-4 gap-y-1">
        <span className="text-[rgb(var(--text-muted))]">
          <strong className="text-[rgb(var(--text-primary))]">
            {fragmentCount}
          </strong>{" "}
          fragmentos
        </span>
        <span className="text-[rgb(var(--text-muted))]">
          <strong className="text-[rgb(var(--text-primary))]">
            {wordCount}
          </strong>{" "}
          palabras
        </span>
        <span className="text-[rgb(var(--text-muted))]">
          Promedio:{" "}
          <strong className="text-[rgb(var(--text-primary))]">
            {wordCount > 0 && fragmentCount > 0
              ? Math.round(wordCount / fragmentCount)
              : 0}
          </strong>{" "}
          palabras/escena
        </span>
      </div>
    </div>
  );
}
