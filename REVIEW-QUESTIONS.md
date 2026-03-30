# Code Review — Preguntas al Desarrollador

**Fecha**: 27 marzo 2026  
**Branch revisado**: `main`  
**Objetivo**: Entender decisiones de diseño, identificar riesgos, y mapear intencionalidad vs. deuda técnica.

---

## 1. Billing & Dinero Real

### 1.1 Race Condition en `recordUsageAndDeduct`

**Archivo**: `src/lib/billing.ts:36-67`

```typescript
if (BILLING_ENABLED) {
    const user = await prisma.user.findUnique({        // ← Lee balance FUERA de tx
      where: { id: params.userId },
      select: { balanceCents: true },
    });
    if (!user) throw new Error("Usuario no encontrado");

    const newBalance = user.balanceCents - costCents;   // ← Calcula FUERA
    if (newBalance < 0) {                               // ← Chequea FUERA
      throw new Error(`Saldo insuficiente...`);
    }

    await prisma.$transaction([                         // ← Deduce DENTRO
      prisma.usageRecord.create({ ... }),
      prisma.user.update({
        where: { id: params.userId },
        data: { balanceCents: newBalance },             // ← Escribe valor calculado
      }),
    ]);
  }
```

**Pregunta**: ¿Estás al tanto de que esto tiene un TOCTOU (Time-of-Check-to-Time-of-Use)? Si dos requests concurrentes leen el balance al mismo tiempo, ambos pasan el chequeo y ambos deducen. A escala, esto pierde dinero real. ¿Fue una decisión consciente por no tener billing activado todavía, o es un bug que necesitás que arregle? ¿Tenés pensado usar `decrement` atómico de Prisma dentro de la transacción?

### 1.2 Tarifa Plana sin Diferencia por Modelo

**Archivo**: `src/lib/billing.ts:13`

```typescript
const CENTS_PER_1K_TOKENS = 0.2; // ~$0.002 por 1K tokens
```

**Pregunta**: Esto cobra lo mismo por GPT-4o que por DeepSeek. Si mañana activás billing real, ¿no va a haber un exploit donde el usuario usa modelos caros pagando precio barato? ¿Hay un plan para tener pricing diferenciado por modelo, o esta tarifa plana es intencional para simplificar el MVP?

---

## 2. Seguridad — Inputs y Auth

### 2.1 Zod Instalado pero Nunca Importado

**Archivo**: `package.json` (zod está en dependencies), pero no hay ningún `import` de Zod en todo el proyecto.

**Pregunta**: `zod` está como dependencia. ¿Tenías planeado usarlo y quedó pendiente, o lo instalaste para otra cosa? Todas las rutas hacen body casting con `as` sin validación runtime:

```typescript
// src/app/api/thumbnail/generate/route.ts:57-77
const { projectId: projectIdParam, videoId, title, ... } = body as {
  projectId?: string;
  videoId?: string;
  title: string;
  // ...
};
```

Un `title` de 50MB se guarda directo en la base. ¿Querés que agreguemos schemas Zod para todas las rutas?

### 2.2 `voices/preview` sin Autenticación

**Archivo**: `src/app/api/voices/preview/route.ts:28`

```typescript
export async function POST(req: NextRequest) {
  const key = process.env.HUGGINGFACE_API_KEY;
  // ... no hay auth() call en ningún lado
```

**Pregunta**: Esta ruta acepta POST requests sin autenticación. Cualquiera con la URL puede quemar tu cuota de HuggingFace. ¿Es intencional (por ejemplo, para demo pública) o se te pasó agregar el auth? La ruta de voices list (`GET /api/voices`) tampoco tiene auth. El middleware de Clerk protege esto o no?

### 2.3 Endpoint de Storage sin Auth

**Archivo**: `src/app/api/settings/storage/route.ts:7-9`

```typescript
export async function GET() {
  const availability = getStorageAvailability();
  return NextResponse.json(availability);
}
```

**Pregunta**: Esto devuelve si Cloudinary está configurado o no a cualquier request sin autenticación. Es info de infraestructura. ¿Necesitás que sea público o lo podemos proteger?

### 2.4 Leakeo de Errores de APIs Externas

**Archivo**: `src/app/api/thumbnail/generate/route.ts:154-159`

```typescript
if (!res.ok) {
  const err = await res.text();
  console.error("OpenRouter image error:", res.status, err);
  return NextResponse.json(
    { error: "Error al generar la imagen", detail: err.slice(0, 200) },  // ← Leakea raw error
    { status: 502 }
  );
}
```

**Pregunta**: El error crudo de OpenRouter (que puede contener endpoints, rate limit headers, info interna) se devuelve al cliente. ¿Es a propósito para debugging, o preferís que lo loggeemos server-side y devolvamos un mensaje genérico?

---

## 3. Arquitectura y Patrones

### 3.1 Duplicación Masiva de `getOrCreateUser`

Encontré el mismo patrón copiado en **7 rutas** distintas:

```typescript
// Cada ruta repite esto:
let user = await prisma.user.findUnique({ where: { clerkId: userId } });
if (!user) {
  user = await prisma.user.create({ data: { clerkId: userId } });
}
```

Rutas afectadas: `script/generate`, `thumbnail/generate`, `scene-image/generate`, `channel/analyze`, `projects`, `presets`, `presets/[id]`.

**Pregunta**: ¿Hay alguna razón por la que no se extrajo esto a un `getOrCreateUser(clerkId)` compartido? ¿Querés que lo refactoricemos a `src/lib/api-helpers.ts`? Lo mismo aplica para la resolución de `projectId`/`videoId` que está copiada en 3 rutas.

### 3.2 `chatCompletion` vs `chatCompletionWithUsage` — Código Duplicado

**Archivo**: `src/lib/ai/providers.ts:36-143` vs `149-199`

`chatCompletionWithUsage` es una copia casi idéntica de `chatCompletion` para OpenRouter, con la única diferencia de que devuelve `usage`. Para otros proveedores, simplemente llama a `chatCompletion` y devuelve `{ content }`.

```typescript
// Línea 198 — fallback para no-OpenRouter:
const content = await chatCompletion(provider, model, messages, options);
return { content };
```

**Pregunta**: ¿Por qué no integrar `usage` directamente en `chatCompletion` y que devuelva `{ content, usage? }` en todos los casos? ¿Hay algún motivo por el que necesitás mantener las dos funciones separadas?

### 3.3 Fetch Directo a OpenRouter Bypass de la Abstracción

**Archivo**: `src/app/api/thumbnail/generate/route.ts:139-152`

```typescript
const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${OPENROUTER_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  },
  body: JSON.stringify({
    model: modelId || DEFAULT_IMAGE_MODEL,
    messages: [{ role: "user", content: prompt }],
    modalities: ["image", "text"],
    image_config: { aspect_ratio: "16:9" },
  }),
});
```

**Pregunta**: Tenés `src/lib/ai/providers.ts` con una abstracción limpia, pero thumbnail y scene-image hacen fetch directo a OpenRouter. ¿Es porque `chatCompletion` no soporta `modalities: ["image", "text"]`? Si mañana queremos soportar DALL-E o Gemini nativo para imágenes, ¿cómo lo encaramos? ¿Extendemos la abstracción o mantenemos el fetch directo?

### 3.4 `local://` — Dos Writes para Un Create

**Archivo**: `src/app/api/thumbnail/generate/route.ts:195-208` (referencia por patrón repetido)

```typescript
// Paso 1: Create con URL temporal
const thumbnail = await prisma.thumbnail.create({
  data: { blobUrl: `${LOCAL_PREFIX}temp-${Date.now()}`, ... }
});
// Paso 2: Update con URL real
await prisma.thumbnail.update({
  where: { id: thumbnail.id },
  data: { blobUrl: `${LOCAL_PREFIX}${thumbnail.id}` }
});
```

**Pregunta**: ¿Por qué no usar el CUID que Prisma genera directamente en el create? El `temp-{timestamp}` parece innecesario. ¿Hay algún motivo por el que necesitás el ID antes de crear el registro? ¿O es un leftover de una iteración anterior?

---

## 4. Frontend y Performance

### 4.1 Página Video Editor — 1027 Líneas con 25+ UseState

**Archivo**: `src/app/dashboard/projects/[id]/videos/[videoId]/page.tsx` (1027 líneas)

**Pregunta**: Esta página maneja script generation, title generation, description generation, tags generation, thumbnail generation, scene images, File System Access API, IndexedDB, y selección de modelos. Todo en un solo componente. ¿Tenías planeado dividirla en custom hooks o sub-componentes? ¿O fue una decisión pragmática de "primero que funcione"? ¿Querés que la refactoricemos?

### 4.2 Interfaz `Video` Definida Dos Veces con Formas Distintas

**Archivo 1**: `src/app/dashboard/projects/[id]/page.tsx:24-34` (conceptual)

```typescript
interface Video {
  id: string;
  title: string;
  scripts: { id: string }[];  // ← Solo ID
  // ...
}
```

**Archivo 2**: `src/app/dashboard/projects/[id]/videos/[videoId]/page.tsx:55-68` (conceptual)

```typescript
interface Video {
  id: string;
  title: string;
  scripts: Script[];  // ← Objeto completo
  // ...
}
```

**Pregunta**: `Video` está definida dos veces con shapes diferentes. ¿Querés que unifiquemos esto en un `src/types/` compartido? ¿O hay alguna razón para que sean distintas?

### 4.3 `SCENE_IMAGE_MODELS` Duplicado en Dos Componentes

**Archivo**: `src/components/ScriptTimeline.tsx:19-25` y `src/components/ScriptFragmentsTable.tsx:16-22`

```typescript
// Exactamente el mismo array en ambos archivos:
const SCENE_IMAGE_MODELS = [
  { id: "google/gemini-2.5-flash-image", name: "Gemini 2.5 Flash" },
  { id: "black-forest-labs/flux-1.1-pro", name: "FLUX 1.1 Pro" },
  // ...
];
```

**Pregunta**: ¿Lo extraemos a un shared constant en `src/lib/constants.ts` o hay una razón para que cada componente lo tenga propio?

### 4.4 Zero Memoización en Páginas Pesadas

**Archivo**: `src/app/dashboard/projects/[id]/videos/[videoId]/page.tsx`

Busqué `useCallback` y `useMemo` — resultados: 0 usos de `useMemo` en todo el proyecto, 1 `useCallback` (solo en `InstallPwaButton`).

**Pregunta**: Con ~25 estados, cada cambio recrea todos los handlers. ¿Notaste problemas de performance en la práctica? ¿Es algo que intencionalmente ignoraste por ser MVP, o es un tema que no consideraste? ¿Querés que agreguemos memoización estratégica?

### 4.5 `fragmentarEstricto` Recalcula en Cada Render

**Archivo**: `src/components/ScriptTimeline.tsx:54`

```typescript
const fragmentos = fragmentarEstricto(scriptContent, 15, 21);
```

Y el mismo cálculo en `src/components/ScriptFragmentsTable.tsx:45`. No está envuelto en `useMemo`.

**Pregunta**: Para scripts largos, ¿esto puede causar lag visible? ¿O los scripts son suficientemente cortos que no importa?

### 4.6 Refetch Completo del Video Después de Cada Generación

**Archivo**: `src/app/dashboard/projects/[id]/videos/[videoId]/page.tsx:358-360` (referencia conceptual)

```typescript
// Después de generar script, título, descripción O tags:
const ref = await fetch(`/api/projects/${projectId}/videos/${videoId}`);
const refData = await ref.json();
if (refData.video) setVideo(refData.video);
```

**Pregunta**: Esto re-fetchea TODOS los datos del video después de cada generación individual. ¿Es intencional para mantener consistencia, o podríamos hacer update optimista solo del campo modificado?

---

## 5. Decisiones de Diseño Específicas

### 5.1 Proveedores de AI — ¿Cuál es el Camino?

**Archivo**: `src/lib/ai/providers.ts`

Tenés soporte para 5 proveedores (OpenAI, Anthropic, DeepSeek, Google, OpenRouter), pero los modelos default hardcodeados no siempre matchean `AI_MODELS` en `src/types/ai.ts`:

```typescript
// providers.ts:65 — default hardcodeado:
model: model.startsWith("claude-") ? model : "claude-3-5-haiku-20241022",

// types/ai.ts — la entrada en AI_MODELS probablemente dice "claude-3-5-haiku"
```

**Pregunta**: ¿El plan es mantener los 5 proveedores o eventualmente consolidar todo a OpenRouter como gateway? ¿Por qué DeepSeek usa la baseURL de OpenAI directamente en vez de pasar por OpenRouter?

### 5.2 `googleapis` como Dependencia

**Archivo**: `package.json`

```json
"googleapis": "^145.0.0"
```

**Pregunta**: Esta es la librería completa de Google APIs para Node — es ENORME. ¿Estás seguro de que solo se importa en código server-side? Si se leak al client bundle, es un problema de tamaño serio. ¿Querés que verifiquemos el tree-shaking?

### 5.3 Módulo Blob Sin Usar

**Archivo**: `src/lib/blob.ts` — importa `@vercel/blob` con `uploadBlob`, `deleteBlob`, `listBlobs`.

Estas funciones **no se usan en ningún lado** del proyecto. Se migró a Cloudinary.

**Pregunta**: ¿Lo dejamos como está por si volvemos a Vercel Blob, o lo limpiamos? ¿Y la dependencia `@vercel/blob` en package.json — la sacamos?

---

## 6. Errores y Transacciones

### 6.1 Writes Múltiples sin Transacción

**Archivo**: `src/app/api/script/generate/route.ts:141-159`

```typescript
// Crea script — UNA query
const script = await prisma.script.create({
  data: { userId: user.id, videoId: targetVideoId, ... },
});
// Actualiza status del video — OTRA query separada
if (targetVideoId) {
  await prisma.video.update({
    where: { id: targetVideoId },
    data: { status: "script_ready" },
  });
}
```

**Pregunta**: Si el script se crea pero el update del video falla, queda inconsistencia. ¿Querés que envolvamos estas operaciones en un `$transaction`? Lo mismo pasa en thumbnail y scene-image generates.

### 6.2 Respuestas de Error Inconsistentes

Comparando las respuestas de error entre rutas:

| Ruta | Shape |
|------|-------|
| `script/generate` | `{ error, code?, hint? }` |
| `thumbnail/generate` | `{ error, code?, hint?, detail? }` |
| `channel/analyze` | `{ error, code?, hint? }` |
| `voices/preview` | `{ error, code?, detail? }` |

En el frontend (`videos/[videoId]/page.tsx`), se manejan así:

```typescript
setThumbError(data.error || data.detail || "Error al generar miniatura");
```

**Pregunta**: ¿Definimos un `ApiError` type estandarizado y lo usamos en todas las rutas? Algo como `{ error: string, code?: string, detail?: string }`.

---

## 7. Preguntas Generales

### 7.1 Origen del Proyecto

- ¿El `fragmentarEstricto` fue portado de un proyecto Python anterior? El comentario dice "port de la lógica Python" — ¿hay más código que vino de ahí?
- ¿Cuál fue el orden de desarrollo? ¿Primero la generación de scripts, después thumbnails, después billing?

### 7.2 Escala Esperada

- ¿Cuántos usuarios concurrentes esperás tener?
- ¿El billing se va a activar pronto? Esto afecta la prioridad del fix del race condition.
- ¿Hay planes para multi-tenancy o es single-user por ahora?

### 7.3 Qué Querés que Hagamos Primero

Basado en todo lo anterior, mi recomendación de prioridad sería:

1. **Hoy**: Fix billing race condition (dinero real)
2. **Hoy**: Proteger `/api/voices/preview` con auth
3. **Esta semana**: Zod schemas en todas las rutas
4. **Esta semana**: Rate limiting básico
5. **Próximo**: Extraer helpers compartidos (`getOrCreateUser`, `resolveProjectOrVideo`)
6. **Próximo**: Refactor de video editor page
7. **Mejora**: Transacciones para multi-writes
8. **Mejora**: Estandarizar error responses

¿Estás de acuerdo con este orden? ¿Hay algo que priorices distinto?

---

*Documento generado como parte de code review del branch `main`.*
