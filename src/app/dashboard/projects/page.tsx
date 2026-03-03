"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, ChevronRight } from "lucide-react";

interface Project {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  scripts: { id: string }[];
  thumbnails: { id: string }[];
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))]">
          Proyectos
        </h1>
        <Link
          href="/dashboard/projects/new"
          className="rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-white font-medium hover:opacity-90"
        >
          Nuevo proyecto
        </Link>
      </div>

      {loading ? (
        <p className="text-[rgb(var(--text-muted))]">Cargando...</p>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-12 text-center">
          <FolderOpen className="h-12 w-12 text-[rgb(var(--text-muted))] mx-auto mb-4" />
          <p className="text-[rgb(var(--text-secondary))] mb-4">
            Aún no tienes proyectos. Crea uno para generar scripts, títulos y
            descripciones con IA.
          </p>
          <Link
            href="/dashboard/projects/new"
            className="inline-flex rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-white font-medium hover:opacity-90"
          >
            Crear proyecto
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/dashboard/projects/${p.id}`}
                className="flex items-center justify-between rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-4 hover:bg-[rgb(var(--bg-muted))] transition"
              >
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5 text-[rgb(var(--accent))]" />
                  <div>
                    <p className="font-medium text-[rgb(var(--text-primary))]">
                      {p.title}
                    </p>
                    <p className="text-sm text-[rgb(var(--text-muted))]">
                      {p.scripts.length > 0 && "Script · "}
                      {p.thumbnails.length > 0 && "Miniatura · "}
                      {new Date(p.updatedAt).toLocaleDateString("es")}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-[rgb(var(--text-muted))]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
