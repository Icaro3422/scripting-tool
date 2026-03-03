# Scripting Tool – Producción YouTube con IA

Herramienta para equipos o creadores que quieren llevar todos los pasos de producción de videos de YouTube con IA: **script**, **miniatura**, **título** y **descripción**. Puedes elegir entre modelos económicos (DeepSeek, GPT-4o Mini) o de pago (Claude, ChatGPT, Gemini).

Incluye análisis de canal (estilo [Scripzy](https://scripzy.app/script-lab)): al pegar la URL de un canal se mapea banner, miniaturas, engagement y se crean **presets** para dar contexto a la IA y generar contenido coherente con el canal.

## Características

- **Análisis de canal**: URL del canal → mapeo de datos (thumbnail, banner, estadísticas) y creación de presets.
- **Múltiples modelos de IA**: DeepSeek, OpenAI (GPT-4o / GPT-4o Mini), Anthropic (Claude), Google (Gemini). Enfoque económico con opción de modelos baratos.
- **Flujo claro**: Proyecto → pestañas Script / Título / Descripción / Miniatura. Los scripts generados **se guardan en el proyecto** y se listan en la pestaña Script (siempre sabes dónde está cada script).
- **Presets**: Creados desde el análisis de canal para dar tono, formato y contexto a la IA.
- **Auth**: Clerk (Google y preparado para wallets en el futuro).
- **Almacenamiento**: Scripts y metadatos en PostgreSQL; opcional **Vercel Blob** (o Cloudinary) para miniaturas y blobs.

## Requisitos

- Node.js 18+
- Podman (o Docker) para PostgreSQL
- Cuentas/API keys según lo que uses:
  - Clerk (Google sign-in)
  - Al menos un proveedor de IA: OpenAI, Anthropic, DeepSeek y/o Google AI
  - YouTube Data API v3 (para análisis de canal)
  - Opcional: Vercel Blob (`BLOB_READ_WRITE_TOKEN`) para almacenar archivos
  - Opcional: Hugging Face (TTS / voces)

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
   - Al menos una de: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `GOOGLE_AI_API_KEY`
   - Opcional: `BLOB_READ_WRITE_TOKEN` (Vercel Blob)
   - Opcional: `HUGGINGFACE_API_KEY` (para TTS/voces)

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

## Estructura del proyecto

- `src/app`: App Router (landing, auth, dashboard, proyectos, canal).
- `src/app/api`: API routes (canal/analyze, presets, projects, script/generate).
- `src/lib`: DB (Prisma), IA (providers), YouTube (análisis), blob, utils.
- `src/types`: Tipos (modelos de IA).
- `prisma/schema.prisma`: Modelos User, Channel, Preset, Project, Script, Thumbnail.
- `docker-compose.yml`: PostgreSQL para desarrollo local con Podman/Docker.

## Próximos pasos sugeridos

- **Miniaturas con IA**: Endpoint para generar/subir miniaturas y guardar URL en `Thumbnail` (Vercel Blob o Cloudinary).
- **Librería de voces**: Integrar Hugging Face TTS (p. ej. SpeechT5 o XTTS) para previsualizar o exportar el script con voz.
- **Wallets**: Usar Clerk para conectar wallets y preparar flujos de pago.

## Licencia

Privado / uso interno según tu proyecto.
