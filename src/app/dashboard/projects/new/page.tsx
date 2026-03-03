"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    setErrorHint(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al crear");
        setErrorHint(data.hint ?? null);
        return;
      }
      router.push(`/dashboard/projects/${data.project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))] mb-2">
        Nuevo proyecto
      </h1>
      <p className="text-[rgb(var(--text-secondary))] mb-6">
        Crea un proyecto para generar script, título, descripción y miniatura
        con IA. El script se guarda en este proyecto y siempre podrás verlo en
        la pestaña Script.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-1">
            Título del video / proyecto
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Cómo editar videos en 10 minutos"
            required
            className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-3 py-2.5 text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[rgb(var(--text-primary))] mb-1">
            Descripción (opcional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Breve descripción o tema del video"
            rows={3}
            className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-3 py-2.5 text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))] resize-none"
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 space-y-1">
            <p className="font-medium">{error}</p>
            {errorHint && <p className="text-sm">{errorHint}</p>}
            <p className="text-sm">
              Guía: abre <strong>CONFIGURACION.md</strong> en la raíz del proyecto (sección «Base de datos»).
            </p>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[rgb(var(--accent))] px-4 py-2.5 text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Crear y abrir proyecto
        </button>
      </form>
    </div>
  );
}
