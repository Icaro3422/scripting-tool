# Scripting Tool – Producción YouTube con IA

Herramienta para equipos o creadores que quieren llevar todos los pasos de producción de videos de YouTube con IA: **script**, **miniatura**, **título** y **descripción**. Puedes elegir entre modelos económicos (DeepSeek, GPT-4o Mini) o de pago (Claude, ChatGPT, Gemini).

Incluye análisis de canal (estilo [Scripzy](https://scripzy.app/script-lab)): al pegar la URL de un canal se mapea banner, miniaturas, engagement y se crean **presets** para dar contexto a la IA y generar contenido coherente con el canal.

## Características

- **Análisis de canal**: URL del canal → mapeo de datos (thumbnail, banner, estadísticas) y creación de presets.
- **Múltiples modelos de IA**: DeepSeek, OpenAI (GPT-4o / GPT-4o Mini), Anthropic (Claude), Google (Gemini) y **OpenRouter** (cientos de modelos con una sola API key).
- **Escenas del guion**: En cada video puedes dividir el texto en fragmentos por **rango fijo (máx. 21 palabras)** o **solo por signos de puntuación** (frases/oraciones), para timeline y generación de imágenes por escena.
- **Flujo claro**: Proyecto → pestañas Script / Título / Descripción / Miniatura. Los scripts generados **se guardan en el proyecto** y se listan en la pestaña Script (siempre sabes dónde está cada script).
- **Presets**: Creados desde el análisis de canal para dar tono, formato y contexto a la IA.
- **Auth**: Clerk (Google y preparado para wallets en el futuro). Las rutas `/api/*` exigen sesión: el middleware protege la app y cada handler relevante comprueba `auth()` y responde `401` en JSON si no hay usuario.
- **Almacenamiento**: Scripts y metadatos en PostgreSQL. Miniaturas: **Cloudinary** (nube) o **local** (carpeta en tu computadora, PWA).
- **PWA**: Instalable como app; en Configuración eliges si guardar en la nube o en una carpeta local.

## Requisitos

- Node.js 18+
- Podman (o Docker) para PostgreSQL
- Cuentas/API keys según lo que uses:
  - Clerk (Google sign-in)
  - Al menos un proveedor de IA: OpenAI, Anthropic, DeepSeek y/o Google AI
  - YouTube Data API v3 (para análisis de canal)
  - Opcional: Cloudinary (`CLOUDINARY_*`) para miniaturas en la nube; o usa modo Local en la app
  - Opcional: Hugging Face (TTS / voces)
  - Recomendado para unificar modelos: **OpenRouter** (`OPENROUTER_API_KEY`)
  - Opcional: **OpenRouter Management key** (`OPENROUTER_MANAGEMENT_KEY`) para ver actividad/consumo por modelo en Facturación

## Instalación

1. **Clonar e instalar dependencias**

   ```bash
   cd scripting-tool
   npm install
   ```

2. **Base de datos con Podman**

   ```bash
   podman-compose up -d
   # o: docker-compose up -d
   ```

   Asegúrate de tener `DATABASE_URL` en `.env` (ver abajo). Por defecto el `docker-compose` expone PostgreSQL en `localhost:5432` con usuario/contraseña `postgres` y base `scripting_tool`.

3. **Variables de entorno**

   Copia `.env.example` a `.env` y rellena las que uses. **Guía detallada:** abre **[CONFIGURACION.md](./CONFIGURACION.md)** para los pasos de cada plataforma (Clerk, YouTube API, IA, etc.).

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL`: `postgresql://postgres:postgres@localhost:5432/scripting_tool`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY`
   - `YOUTUBE_API_KEY` (para análisis de canal)
   - Al menos una de: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `GOOGLE_AI_API_KEY`, `OPENROUTER_API_KEY`
   - Opcional: `OPENROUTER_MANAGEMENT_KEY` (consumo oficial OpenRouter por modelo en `/dashboard` → Facturación)
   - Opcional: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (miniaturas en nube)
   - Opcional: `HUGGINGFACE_API_KEY` (para TTS/voces)
   - Opcional: `BILLING_ENABLED=true` para descontar de un balance interno al usar IA (ver Facturación)

4. **Prisma**

   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Arrancar la app**

   ```bash
   npm run dev
   ```

   Abre [http://localhost:3000](http://localhost:3000). Inicia sesión con Clerk (Google) y usa el dashboard para analizar canales, crear presets y proyectos, y generar script/título/descripción.

## Almacenamiento (económico)

- **Scripts y presets**: Se guardan en **PostgreSQL** (texto/JSON). No necesitas blob para eso.
- **Miniaturas / archivos**: Para una herramienta “casi gratuita”:
  - **Vercel Blob**: Integrado con Vercel, pay-per-use; en beta el plan Pro tiene margen. Ideal si despliegas en Vercel.
  - **Cloudinary**: Plan free con 25 créditos/mes (1 crédito = 1 GB almacenamiento o 1 GB ancho de banda). Bueno para imágenes/miniaturas.

Puedes usar solo la DB y añadir Blob o Cloudinary cuando implementes la generación/upload de miniaturas.

## Autenticación (Clerk)

- **Middleware** ([`src/middleware.ts`](src/middleware.ts)): rutas públicas explícitas: `/`, `/sign-in`, `/sign-up`, `/api/webhooks/*`. El resto requiere sesión Clerk.
- **Handlers API**: además del middleware, las rutas bajo `src/app/api/**/route.ts` deben usar `auth()` de `@clerk/nextjs/server` y devolver `{ error: "No autorizado" }` con status `401` si no hay `userId`, para respuestas JSON coherentes en `fetch`.

## OpenRouter

- **`OPENROUTER_API_KEY`**: inferencia (chat, imágenes de miniatura/escena vía la API compatible con OpenAI).
- Cuando la respuesta incluye `usage.cost` (USD), el registro de facturación usa ese coste para calcular el cargo interno; si no viene, se usa una estimación por tokens.
- **`OPENROUTER_MANAGEMENT_KEY`** (opcional): permite llamar a la API de actividad de OpenRouter. La app expone `GET /api/billing/openrouter-activity` (solo servidor, con sesión de usuario) y la vista **Facturación** muestra el resultado y un agregado local por modelo.

## Facturación y uso

- Variable `BILLING_ENABLED`: si es `true`, cada operación registrada descuenta del campo `balanceCents` del usuario en base de datos; si es `false`, solo se guardan filas en `UsageRecord`.
- Los importes mostrados en la UI de facturación usan la escala **centavos de USD** (dividir entre 100 para obtener dólares) cuando el coste proviene de OpenRouter; en otros proveedores se sigue usando la estimación por tokens definida en [`src/lib/billing.ts`](src/lib/billing.ts).
- **Facturación** en el dashboard incluye: balance, historial reciente, tabla **por modelo** (datos de esta app) y bloque opcional **consumo OpenRouter** (API oficial).

## API HTTP (referencia rápida)

| Método y ruta | Propósito |
|---------------|-----------|
| `GET/POST /api/projects` | Listar / crear proyectos |
| `GET/PATCH/DELETE /api/projects/[id]` | Detalle y edición de proyecto |
| `GET/POST /api/projects/[id]/videos` | Videos del proyecto |
| `GET/PATCH /api/projects/[id]/videos/[videoId]` | Detalle de video |
| `POST /api/projects/[id]/videos/[videoId]/publish` | Publicar (si aplica) |
| `GET/POST /api/presets`, `GET/PATCH/DELETE /api/presets/[id]` | Presets |
| `POST /api/channel/analyze`, `GET /api/channel/search` | Análisis y búsqueda de canales YouTube |
| `GET /api/channels` | Canales del usuario |
| `POST /api/script/generate` | Generar script / título / descripción / tags |
| `POST /api/thumbnail/generate`, `POST /api/scene-image/generate` | Miniaturas e imágenes de escena (OpenRouter) |
| `GET /api/ai/models` | Lista de modelos (estáticos + OpenRouter si hay key) |
| `GET /api/voices`, `POST /api/voices/preview` | Catálogo de voces y preview TTS (HF) |
| `GET /api/settings/storage` | Disponibilidad Cloudinary / local |
| `GET /api/billing/summary` | Balance y uso reciente + agregado por modelo |
| `GET /api/billing/openrouter-activity` | Actividad OpenRouter (requiere management key) |

Todas las rutas anteriores requieren usuario autenticado con Clerk salvo las que en el futuro se añadan bajo `/api/webhooks` para webhooks públicos firmados.

## Estructura del proyecto

- `src/app`: App Router (landing, auth, dashboard, proyectos, canal).
- `src/app/api`: API routes (canal/analyze, presets, projects, script/generate).
- `src/lib`: DB (Prisma), IA (providers), YouTube (análisis), storage (Cloudinary/local), utils.
- `src/types`: Tipos (modelos de IA).
- `prisma/schema.prisma`: Modelos User, Channel, Preset, Project, Script, Thumbnail.
- `docker-compose.yml`: PostgreSQL para desarrollo local con Podman/Docker.

## Próximos pasos sugeridos

- **Librería de voces**: Ampliar TTS (p. ej. más modelos HF o XTTS) para exportar el guion con voz.
- **Wallets**: Usar Clerk para conectar wallets y preparar flujos de pago.

## Licencia

Privado / uso interno según tu proyecto.
