"use client";

import { useState, useEffect } from "react";
import { IMAGE_STYLES } from "@/lib/text-processing";

interface ImageStyleSelectorProps {
  value: string;
  onChange: (style: string) => void;
  disabled?: boolean;
}

const CUSTOM_OPTION = "✏️ Personalizado";

export function ImageStyleSelector({
  value,
  onChange,
  disabled = false,
}: ImageStyleSelectorProps) {
  const [isCustom, setIsCustom] = useState(false);

  // Sync isCustom with value changes
  useEffect(() => {
    // Preset styles should always disable custom mode.
    if (IMAGE_STYLES.includes(value as (typeof IMAGE_STYLES)[number])) {
      setIsCustom(false);
      return;
    }

    // A non-empty, non-preset value represents a custom style.
    if (value !== "") {
      setIsCustom(true);
    }

    // When value === "", preserve the current mode so selecting
    // "Personalizado" can clear the textarea without immediately hiding it.
  }, [value]);

  return (
    <div className="space-y-2">
      <div>
        <label
          htmlFor="image-style"
          className="block text-xs font-medium text-[rgb(var(--text-muted))] mb-1"
        >
          Estilo de imagen
        </label>
        <select
          id="image-style"
          value={isCustom ? CUSTOM_OPTION : value}
          onChange={(e) => {
            if (e.target.value === CUSTOM_OPTION) {
              setIsCustom(true);
              onChange("");
            } else {
              setIsCustom(false);
              onChange(e.target.value);
            }
          }}
          disabled={disabled}
          className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-sm text-[rgb(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))] focus:ring-offset-2 focus:ring-offset-[rgb(var(--bg-muted))] disabled:opacity-50"
          aria-describedby="style-helper"
        >
          <option value="">Seleccionar estilo...</option>
          {IMAGE_STYLES.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
          <option value={CUSTOM_OPTION}>{CUSTOM_OPTION}</option>
        </select>
      </div>
      {isCustom && (
        <div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Describe el estilo visual deseado..."
            rows={3}
            disabled={disabled}
            className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-sm text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))] disabled:opacity-50 resize-none"
          />
        </div>
      )}
      <p className="text-xs text-[rgb(var(--text-muted))]">
        Define el estilo visual de las imágenes generadas
      </p>
    </div>
  );
}
