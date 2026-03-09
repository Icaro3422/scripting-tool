import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scripting Tool",
    short_name: "Scripting Tool",
    description: "Producción completa para videos de YouTube: script, miniatura, título y descripción con IA.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0f0f0f",
    theme_color: "#6366f1",
    orientation: "any",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["productivity", "utilities"],
  };
}
