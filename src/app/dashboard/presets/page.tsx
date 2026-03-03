"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Layers, FolderOpen, ExternalLink, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Preset {
  id: string;
  name: string;
  description: string | null;
  channelId: string | null;
  channel: {
    id: string;
    title: string | null;
    youtubeChannelId: string;
  } | null;
  updatedAt: string;
}

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function loadPresets() {
    return fetch("/api/presets")
      .then((r) => r.json())
      .then((data) => {
        if (data.error && data.code === "DB_NOT_READY") {
          setError(data.error);
          setPresets([]);
        } else {
          setError(null);
          setPresets(data.presets ?? []);
        }
      })
      .catch(() => setError("Error al cargar presets"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPresets();
  }, []);

  function openCreate() {
    setEditingId(null);
    setFormName("");
    setFormDescription("");
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(preset: Preset) {
    setEditingId(preset.id);
    setFormName(preset.name);
    setFormDescription(preset.description ?? "");
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setFormName("");
    setFormDescription("");
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = formName.trim();
    if (!name) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        const res = await fetch(`/api/presets/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description: formDescription.trim() || null }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || "Error al guardar");
          return;
        }
        setPresets((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...data.preset } : p)));
      } else {
        const res = await fetch("/api/presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: formDescription.trim() || undefined,
            payload: {},
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || "Error al crear");
          return;
        }
        setPresets((prev) => [data.preset, ...prev]);
      }
      closeModal();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(preset: Preset) {
    if (!confirm(`¿Eliminar el preset "${preset.name}"? Esta acción no se puede deshacer.`)) return;
    setDeletingId(preset.id);
    try {
      const res = await fetch(`/api/presets/${preset.id}`, { method: "DELETE" });
      if (res.status === 204 || res.ok) {
        setPresets((prev) => prev.filter((p) => p.id !== preset.id));
      } else {
        const data = await res.json();
        setError(data.error || "Error al eliminar");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))] mb-2">
            Presets para proyectos
          </h1>
          <p className="text-[rgb(var(--text-secondary))]">
            Aquí se guardan los presets que creas al analizar un canal. Puedes
            elegir uno al generar script, título o descripción en cualquier{" "}
            <Link href="/dashboard/projects" className="text-[rgb(var(--accent))] hover:underline">
              proyecto
            </Link>
            . Crea, edita o elimina presets debajo.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-[rgb(var(--accent))] text-white px-4 py-2.5 font-medium hover:opacity-90 flex items-center gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nuevo preset
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 px-4 py-3 mb-6">
          {error}. Ejecuta <code className="bg-black/10 px-1 rounded">bun run db:push</code> y revisa{" "}
          <strong>CONFIGURACION.md</strong>.
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[rgb(var(--text-muted))]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando presets...
        </div>
      ) : presets.length === 0 && !error ? (
        <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-12 text-center">
          <Layers className="h-12 w-12 text-[rgb(var(--text-muted))] mx-auto mb-4" />
          <p className="text-[rgb(var(--text-secondary))] mb-4">
            Aún no tienes presets. Crea uno desde Analizar canal o con el botón &quot;Nuevo preset&quot;.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-white font-medium hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Nuevo preset
            </button>
            <Link
              href="/dashboard/canal"
              className="inline-flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] px-4 py-2 text-[rgb(var(--text-primary))] font-medium hover:bg-[rgb(var(--bg-muted))]"
            >
              Ir a Analizar canal
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {presets.map((preset) => (
            <li
              key={preset.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-lg bg-[rgb(var(--accent-soft))] p-2 shrink-0">
                  <Layers className="h-5 w-5 text-[rgb(var(--accent))]" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-[rgb(var(--text-primary))] truncate">
                    {preset.name}
                  </p>
                  <p className="text-sm text-[rgb(var(--text-muted))] truncate">
                    {preset.channel?.title ?? preset.description ?? "Sin canal vinculado"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-[rgb(var(--text-muted))]">
                  {new Date(preset.updatedAt).toLocaleDateString("es")}
                </span>
                <button
                  type="button"
                  onClick={() => openEdit(preset)}
                  className="p-2 rounded-lg text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--bg-muted))] hover:text-[rgb(var(--text-primary))]"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(preset)}
                  disabled={deletingId === preset.id}
                  className="p-2 rounded-lg text-[rgb(var(--text-muted))] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 disabled:opacity-50"
                  title="Eliminar"
                >
                  {deletingId === preset.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
                <Link
                  href="/dashboard/projects"
                  className="text-sm text-[rgb(var(--accent))] hover:underline flex items-center gap-1 px-2 py-1.5"
                >
                  Usar en proyecto
                  <FolderOpen className="h-3.5 w-3.5" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={closeModal}
        >
          <div
            className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[rgb(var(--border))]">
              <h2 className="font-semibold text-[rgb(var(--text-primary))]">
                {editingId ? "Editar preset" : "Nuevo preset"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--text-muted))] mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Preset: Mi canal"
                  className={cn(
                    "w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
                  )}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--text-muted))] mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Breve descripción del preset"
                  rows={2}
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-muted))] px-3 py-2 text-[rgb(var(--text-primary))] placeholder:text-[rgb(var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))] resize-none"
                />
              </div>
              {formError && (
                <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-[rgb(var(--border))] px-4 py-2 text-[rgb(var(--text-primary))] font-medium hover:bg-[rgb(var(--bg-muted))]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editingId ? "Guardar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
