"use client";

import { useState, useMemo } from "react";
import { countWords, previewStrictFragmentCount, previewFragmentCount, type SplitMethod, type SplitConfigState } from "@/lib/text-processing";
import { Settings2, Hash, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type { SplitMethod, SplitConfigState };

interface ScriptSplitConfigProps {
  scriptContent: string;
  onMethodChange?: (method: SplitMethod, config: SplitConfigState) => void;
  initialMethod?: SplitMethod;
  initialConfig?: Partial<SplitConfigState>;
}

const DEFAULT_CONFIG: SplitConfigState = {
  method: "strict",
  targetChunks: 10,
  strictMinWords: 15,
  strictMaxWords: 21,
};

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

      {/* Selector de método */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => handleMethodChange("strict")}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition",
            config.method === "strict"
              ? "bg-[rgb(var(--accent))] text-white"
              : "bg-[rgb(var(--bg-muted))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text-primary))]"
          )}
        >
          <Hash className="h-4 w-4" />
          Por palabras (15-21)
        </button>
        <button
          type="button"
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

      {/* Configuración adicional según método */}
      {config.method === "count" && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="text-sm text-[rgb(var(--text-muted))]">
            Número de escenas:
          </label>
          <input
            type="number"
            min={2}
            max={50}
            value={config.targetChunks}
            onChange={(e) =>
              handleConfigChange(
                "targetChunks",
                Math.max(2, Math.min(50, Number(e.target.value) || 10))
              )
            }
            className="w-20 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-2 py-1.5 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
          />
        </div>
      )}

      {config.method === "strict" && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="text-sm text-[rgb(var(--text-muted))]">
            Palabras por escena:
          </label>
          <input
            type="number"
            min={5}
            max={30}
            value={config.strictMinWords}
            onChange={(e) =>
              handleConfigChange(
                "strictMinWords",
                Math.max(5, Math.min(30, Number(e.target.value) || 15))
              )
            }
            className="w-20 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-2 py-1.5 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
          />
          <span className="text-sm text-[rgb(var(--text-muted))]">a</span>
          <input
            type="number"
            min={5}
            max={35}
            value={config.strictMaxWords}
            onChange={(e) =>
              handleConfigChange(
                "strictMaxWords",
                Math.max(5, Math.min(35, Number(e.target.value) || 21))
              )
            }
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
