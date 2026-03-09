import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { LayoutDashboard, FolderOpen, Mic, Layers, Volume2, Settings, CreditCard } from "lucide-react";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const hasClerk = !!clerkKey && clerkKey.startsWith("pk_") && !clerkKey.includes("placeholder");

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))] flex">
      <aside className="w-56 border-r border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] flex flex-col py-6 px-4">
        <div className="flex items-center gap-2 mb-8">
          <LayoutDashboard className="h-6 w-6 text-[rgb(var(--accent))]" />
          <span className="font-semibold text-[rgb(var(--text-primary))]">
            Scripting Tool
          </span>
        </div>
        <nav className="flex flex-col gap-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-muted))] hover:text-[rgb(var(--text-primary))]"
          >
            <LayoutDashboard className="h-4 w-4" />
            Inicio
          </Link>
          <Link
            href="/dashboard/projects"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-muted))] hover:text-[rgb(var(--text-primary))]"
          >
            <FolderOpen className="h-4 w-4" />
            Proyectos
          </Link>
          <Link
            href="/dashboard/presets"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-muted))] hover:text-[rgb(var(--text-primary))]"
          >
            <Layers className="h-4 w-4" />
            Presets
          </Link>
          <Link
            href="/dashboard/canal"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-muted))] hover:text-[rgb(var(--text-primary))]"
          >
            <Mic className="h-4 w-4" />
            Analizar canal
          </Link>
          <Link
            href="/dashboard/voices"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-muted))] hover:text-[rgb(var(--text-primary))]"
          >
            <Volume2 className="h-4 w-4" />
            Voces
          </Link>
          <Link
            href="/dashboard/billing"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-muted))] hover:text-[rgb(var(--text-primary))]"
          >
            <CreditCard className="h-4 w-4" />
            Facturación
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-muted))] hover:text-[rgb(var(--text-primary))]"
          >
            <Settings className="h-4 w-4" />
            Configuración
          </Link>
        </nav>
        <div className="mt-auto flex items-center gap-2 border-t border-[rgb(var(--border))] pt-4">
          {hasClerk && <UserButton afterSignOutUrl="/" />}
          <span className="text-sm text-[rgb(var(--text-muted))]">Cuenta</span>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
