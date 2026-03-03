import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { ArrowRight, LayoutDashboard } from "lucide-react";

export const dynamic = "force-dynamic";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const hasClerk = !!clerkKey && clerkKey.startsWith("pk_") && !clerkKey.includes("placeholder");

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[rgb(var(--bg-base))]">
      <div className="max-w-2xl w-full text-center space-y-8">
        <h1 className="text-4xl font-semibold tracking-tight text-[rgb(var(--text-primary))]">
          Scripting Tool
        </h1>
        <p className="text-lg text-[rgb(var(--text-secondary))]">
          Producción completa para videos de YouTube: script, miniatura, título y
          descripción con IA. Elige tu modelo (DeepSeek, Claude, ChatGPT, Gemini)
          y trabaja con presets de tu canal.
        </p>

        {!hasClerk ? (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[rgb(var(--accent))] px-6 py-3 text-white font-medium hover:opacity-90 transition"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-6 py-3 text-[rgb(var(--text-primary))] font-medium hover:bg-[rgb(var(--bg-muted))] transition"
            >
              Registrarse
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[rgb(var(--border))] px-6 py-3 text-[rgb(var(--text-primary))] font-medium"
            >
              Ir al Dashboard
            </Link>
          </div>
        ) : (
          <>
            <SignedOut>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/sign-in"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[rgb(var(--accent))] px-6 py-3 text-white font-medium hover:opacity-90 transition"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-surface))] px-6 py-3 text-[rgb(var(--text-primary))] font-medium hover:bg-[rgb(var(--bg-muted))] transition"
                >
                  Registrarse
                </Link>
              </div>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[rgb(var(--accent))] px-6 py-3 text-white font-medium hover:opacity-90 transition"
              >
                Ir al Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </SignedIn>
          </>
        )}

        <ul className="text-left text-[rgb(var(--text-secondary))] space-y-2 pt-8 border-t border-[rgb(var(--border))]">
          <li className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-[rgb(var(--accent))]" />
            Análisis de canal (banner, miniaturas, engagement, tono, colores)
          </li>
          <li className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-[rgb(var(--accent))]" />
            Presets para dar contexto a la IA
          </li>
          <li className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-[rgb(var(--accent))]" />
            Script, título, descripción y miniatura con el modelo que elijas
          </li>
          <li className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-[rgb(var(--accent))]" />
            Librería de voces (Hugging Face)
          </li>
        </ul>
      </div>
    </div>
  );
}
