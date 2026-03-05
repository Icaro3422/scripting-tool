import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scripting Tool – Producción YouTube con IA",
  description:
    "Scripting, miniatura, título y descripción para tus videos. Múltiples modelos de IA. Presets desde tu canal.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Scripting Tool" },
};

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const hasClerk = !!clerkKey && clerkKey.startsWith("pk_") && !clerkKey.includes("placeholder");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const body = (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
  return hasClerk ? <ClerkProvider>{body}</ClerkProvider> : body;
}
