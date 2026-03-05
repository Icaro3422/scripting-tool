import Link from "next/link";
import { FolderPlus, Link2 } from "lucide-react";
import { InstallPwaButton } from "@/components/InstallPwaButton";

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-[rgb(var(--text-primary))] mb-2">
            Dashboard
          </h1>
          <p className="text-[rgb(var(--text-secondary))]">
            Crea proyectos, analiza canales para presets y genera scripts, títulos y
            descripciones con IA.
          </p>
        </div>
        <InstallPwaButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/canal"
          className="flex items-center gap-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-6 hover:bg-[rgb(var(--bg-muted))] transition"
        >
          <div className="rounded-lg bg-[rgb(var(--accent-soft))] p-3">
            <Link2 className="h-6 w-6 text-[rgb(var(--accent))]" />
          </div>
          <div>
            <h2 className="font-medium text-[rgb(var(--text-primary))]">
              Analizar canal
            </h2>
            <p className="text-sm text-[rgb(var(--text-muted))]">
              Pega la URL de un canal y obtén presets (tono, colores, formato).
            </p>
          </div>
        </Link>

        <Link
          href="/dashboard/projects/new"
          className="flex items-center gap-4 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] p-6 hover:bg-[rgb(var(--bg-muted))] transition"
        >
          <div className="rounded-lg bg-[rgb(var(--accent-soft))] p-3">
            <FolderPlus className="h-6 w-6 text-[rgb(var(--accent))]" />
          </div>
          <div>
            <h2 className="font-medium text-[rgb(var(--text-primary))]">
              Nuevo proyecto
            </h2>
            <p className="text-sm text-[rgb(var(--text-muted))]">
              Crea un video: script, miniatura, título y descripción.
            </p>
          </div>
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-[rgb(var(--text-primary))] mb-4">
          Tus proyectos recientes
        </h2>
        <p className="text-[rgb(var(--text-muted))] text-sm">
          <Link href="/dashboard/projects" className="text-[rgb(var(--accent))] hover:underline">
            Ver todos los proyectos
          </Link>
          . Los scripts generados se guardan en cada proyecto y puedes verlos en
          la pestaña &quot;Script&quot; del proyecto.
        </p>
      </section>
    </div>
  );
}
