# Security Fixes — ApuntesArgentina

Auditoría realizada el 2026-06-05. Todos los cambios están en la rama `dev`.

---

## Vulnerabilidades encontradas y corregidas

### 1. Autenticación en el backend (CRÍTICO) — CORREGIDO

**Problema:** `POST /api/upload` y `DELETE /api/files` no verificaban ningún token de Clerk. Cualquier persona podía subir o borrar archivos con un `curl` directo sin autenticación.

**Corrección:**
- Instalado `@clerk/express`.
- Agregado `clerkMiddleware()` globalmente: adjunta el contexto de auth en cada request.
- Agregado `requireAuth()` como middleware en `POST /api/upload`, `DELETE /api/files` y `POST /api/verify-owner`. Devuelve 401 si el JWT es inválido o inexistente.
- `getAuth(req)` extrae el `userId` verificado del JWT — se usa como identificador de ownership real en lugar del `uploaderId` del body.
- El frontend (`UploadPage.jsx`) ahora obtiene el token vía `session.getToken()` y lo envía como `Authorization: Bearer <token>` en upload y delete.
- `CORS allowedHeaders` actualizado para incluir `Authorization`.

**Archivos:** `server.js`, `src/UploadPage.jsx`

---

### 2. Validación de tipo de archivo por magic bytes — CORREGIDO

**Problema:** Multer validaba únicamente el `Content-Type` del header HTTP, que es trivialmente falsificable. Un atacante podía subir un archivo `.exe` o `.html` declarando `application/pdf`.

**Corrección:**
- Instalado `file-type`.
- Función `validateMagicBytes(buffer, declaredMime)` lee la firma binaria real del buffer antes de procesar el archivo.
- Reglas de matcheo por tipo:
  - PDF: debe detectarse como `application/pdf`.
  - PNG/JPEG: debe detectarse con el mime exacto.
  - OOXML (`.docx`, `.pptx`): deben detectarse como `application/zip` (su contenedor real).
  - Office legacy (`.doc`, `.ppt`): deben detectarse como `application/x-cfb`.
- Si la firma no coincide, se devuelve HTTP 415 con mensaje descriptivo.

**Archivos:** `server.js`

---

### 3. CORS restrictivo — VERIFICADO Y MEJORADO

**Estado previo:** Ya usaba una allowlist de orígenes (`ALLOWED_ORIGINS`). En dev permitía requests sin `Origin` (curl). No usaba `'*'`.

**Mejora aplicada:**
- El header `Authorization` fue agregado a `allowedHeaders` para soportar los tokens de Clerk.
- La lógica de "permitir sin Origin solo en dev" se mantuvo (correcta para desarrollo local).
- En producción, configurar `ALLOWED_ORIGINS` con el dominio real es suficiente.

**Archivos:** `server.js`

---

### 4. Rate limiting — VERIFICADO Y COMPLETADO

**Estado previo:** Existía `globalLimiter` (200/15min), `uploadLimiter` (20/hora), `downloadLimiter` (60/min). Faltaba un limiter dedicado para DELETE y para GET /api/tree y /api/files.

**Corrección:**
- Agregado `deleteLimiter`: 10 deletes/hora por IP para `DELETE /api/files`.
- Agregado `treeLimiter`: 100 req/min por IP para `GET /api/tree` y `GET /api/files`.

**Archivos:** `server.js`

---

### 5. Path traversal / injection en S3 keys — VERIFICADO

**Estado previo:** `sanitizePath()` ya existía y removía `..`, `/`, `\`, null bytes y caracteres especiales.

**Mejora aplicada:**
- El límite máximo por segmento fue reducido de 200 a 100 caracteres (como especifica el requerimiento).
- El nombre del archivo (`baseName`) también fue limitado a 100 chars antes de construir el key.

**Archivos:** `server.js`

---

### 6. Seguridad del endpoint DELETE — CORREGIDO

**Estado previo:** El delete verificaba `uploaderId` del body (device fingerprint no verificado), permitiendo suplantación de identidad.

**Corrección:**
- Ahora usa `requireAuth()` + `getAuth(req).userId` (JWT verificado por Clerk).
- Compara el `userId` del JWT con el `uploaderId` almacenado en `_meta/uploads.json`.
- Protección adicional explícita: si el `rawKey` comienza con `_meta/` o es `index.json`, devuelve 403 antes de cualquier operación.
- Uploads futuros almacenan el `userId` de Clerk (no un device ID anónimo).

**Archivos:** `server.js`

---

### 7. Headers de seguridad HTTP — VERIFICADO Y MEJORADO

**Estado previo:** `helmet` ya estaba instalado. CSP estaba deshabilitado para no romper iframes de preview.

**Corrección:**
- CSP habilitado con directivas básicas seguras para el backend API:
  - `default-src 'self'`
  - `frame-src 'none'`
  - `object-src 'none'`
  - `upgrade-insecure-requests`
- `X-Content-Type-Options: nosniff` — activo por defecto en helmet.
- `X-Frame-Options: DENY` — activo por defecto en helmet.
- `Strict-Transport-Security` — activo por defecto en helmet.

**Archivos:** `server.js`

---

### 8. Variables de entorno — VERIFICADO

**Estado:** Correcto. Solo `VITE_CLERK_PUBLISHABLE_KEY` usa el prefijo `VITE_`. Las credenciales de R2 (`CF_R2_ACCESS_KEY_ID`, `CF_R2_SECRET_ACCESS_KEY`) y `CLERK_SECRET_KEY` NO tienen prefijo `VITE_` y nunca llegan al bundle del frontend.

El `.gitignore` ya excluye `.env` y `.env.local`.

**Acción recomendada:** Rotar las credenciales actuales (que están en texto plano en `.env` del repositorio local) antes de cualquier push o deploy.

---

### 9. Dependencias vulnerables

**Resultado de `npm audit`:** 0 vulnerabilidades encontradas. Sin cambios necesarios.

---

## Paquetes instalados

| Paquete | Versión | Uso |
|---------|---------|-----|
| `@clerk/express` | ^1.x | Middleware de autenticación JWT en el backend |
| `file-type` | ^21.x | Detección de tipo de archivo por magic bytes |

---

## Compatibilidad

Los cambios son retrocompatibles con el flujo existente de Clerk en el frontend. El único cambio de comportamiento observable es:
- Los usuarios no autenticados que intentan subir o borrar archivos reciben HTTP 401 (antes el request era aceptado).
- El frontend ya enviaba tokens de Clerk en otros contextos; ahora también los envía en upload y delete.

---

## Segunda auditoría — 2026-06-08 (features post-deploy de Drive y carpetas)

### 10. `/api/drive-folder` era un proxy abierto de Drive (MEDIO-ALTO) — CORREGIDO

**Problema:** el endpoint aceptaba cualquier folder ID y lo listaba con la `GOOGLE_API_KEY` del sitio, sin verificar que perteneciera a una carpeta registrada. Permitía a cualquiera enumerar carpetas públicas ajenas y consumir la cuota de Google.

**Corrección:**
- Los IDs de subcarpeta que el server entrega (en `/api/files` y `/api/drive-folder`) ahora van **firmados con HMAC-SHA256** (`signDriveId`, secreto derivado de `CLERK_SECRET_KEY`).
- `/api/drive-folder` exige `sig` válida (`verifyDriveSig`, comparación `timingSafeEqual`) o responde **403**. Solo se navegan carpetas que el propio server surfaceó (raíces registradas + sus hijas firmadas).
- Frontend: `enterDriveFolder` propaga la `sig` y la manda en el fetch.

**Archivos:** `server.js`, `src/ApuntesPage.jsx`

### 11. La subida real (presigned URL) no validaba magic-bytes (MEDIO) — CORREGIDO

**Problema:** `validateMagicBytes` solo corría en el `/api/upload` legacy (multer), que ya no se usa. El flujo real (`upload-url` → PUT directo a R2 → `confirm-upload`) nunca inspeccionaba el contenido.

**Corrección:**
- `confirm-upload` ahora descarga los primeros 4 KB del objeto (`GetObject` con `Range: bytes=0-4099`) y corre `validateMagicBytes` contra la extensión declarada.
- Si la firma no coincide (ej: HTML disfrazado de `.pdf`), **borra el objeto de R2** y responde 415.

**Archivos:** `server.js`

---

## Tercera auditoría — 2026-06-09 (pentest + optimización + navegabilidad)

### 12. Fuga de información en errores 500 (BAJO-MEDIO) — CORREGIDO

**Problema:** 18 endpoints devolvían `res.status(500).json({ error: err.message })` con el
mensaje crudo del SDK de R2/Clerk. Eso filtra internals (nombre de bucket, región,
rutas, detalles de la infra) a cualquier cliente que provoque un error.

**Corrección:** helper `serverError(res, scope, err)` que loguea el detalle real en el
servidor y responde siempre `{ error: 'Error interno del servidor' }`. Aplicado a todos
los catch de rutas. Se conservan sólo los mensajes controlados y seguros del error
handler global (CORS / tipo no permitido).

**Archivos:** `server.js`

### 13. Headers de seguridad ausentes en el sitio estático (MEDIO) — CORREGIDO

**Problema:** `helmet` sólo corre sobre `/api`. Las páginas HTML/SPA servidas por Vercel
no tenían ningún header de seguridad → la app podía ser embebida en un iframe ajeno
(clickjacking), sin `nosniff`, sin política de referrer, sin HSTS.

**Corrección:** bloque `headers` en `vercel.json` para `/(.*)`:
`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(), microphone=(), geolocation=()`,
`Strict-Transport-Security` (2 años, preload). No se agregó CSP estricta para no romper
Clerk, los iframes de preview de Drive ni las fuentes de Google.

**Archivos:** `vercel.json`

### 14. Integridad de ratings: pollution de `ratings.json` (BAJO-MEDIO) — CORREGIDO

**Problema:** `POST /api/ratings` no requiere auth y aceptaba calificar cualquier key
con formato válido aunque el archivo no existiera. Permitía inflar `ratings.json` con
keys arbitrarias (integridad de las estrellas + crecimiento no acotado del meta).

**Corrección:** antes de registrar la calificación se hace `HeadObject` sobre la key; si
el archivo no existe en el bucket, responde 404 y no escribe nada. (La deduplicación real
por usuario sigue siendo client-side vía `aa-votes` en localStorage; nota abajo.)

**Archivos:** `server.js`

### 15. Fallback adivinable del secreto de firma de Drive (BAJO) — CORREGIDO

**Problema:** `DRIVE_SIG_SECRET` caía a la constante `'aa-drive-sig-fallback'` si faltaban
los secretos de entorno → firmas HMAC forjables (reabría el proxy de Drive del hallazgo 10).

**Corrección:** el fallback ahora es `randomBytes(32)` por proceso. Las firmas se
regeneran en cada listado, así que no necesitan persistir entre reinicios.

**Archivos:** `server.js`

---

## Optimización y navegabilidad — 2026-06-09

### Code-splitting del bundle

`ApuntesPage` (y su `UploadPage` + `PreviewModal`) ahora se cargan con `React.lazy` +
`Suspense`: sólo se descargan cuando la persona entra al buscador. La landing arranca con
un bundle inicial menor y el código del buscador queda en un chunk aparte (~45 KB / 12 KB gzip).

**Archivos:** `src/App.jsx`

### Botón "atrás" del navegador / Android

Antes, tocar "atrás" dentro del buscador abandonaba el sitio. Ahora un handler de
`popstate` con una entrada de historial "fantasma" hace que cada "atrás" suba un nivel
(preview → carpeta de Drive → materia → carrera → universidad → landing).

**Archivos:** `src/ApuntesPage.jsx`

> ⚠️ Probar en `dev` antes de mergear a `main`: el flujo de `popstate` depende del
> comportamiento real del navegador y no se puede validar con el build estático.

---

## Pendiente — requiere infraestructura externa (no bloqueante)

- **Rate limiting distribuido:** `express-rate-limit` usa memoria local; en serverless cada instancia tiene su contador. Para que sea efectivo hace falta un store compartido (ej. Upstash Redis — plan gratis). Mientras tanto protege por-instancia.
- **Race conditions en metadatos:** `uploads.json` / `folders.json` / `drive-links.json` son read-modify-write sobre un JSON en R2; escrituras concurrentes pueden pisarse. Fix real: mover a un KV/DB (Upstash Redis, Cloudflare D1/KV) o escrituras condicionales con ETag.
- **Deduplicación de ratings:** el "ya votaste" sólo vive en `localStorage` (`aa-votes`), trivial de evadir (borrar el storage o `curl`). El hallazgo 14 ya evita pollution de keys inexistentes, pero el ballot-stuffing por voto repetido sigue siendo posible (limitado a 30/min por IP). Fix real: requerir sesión Clerk en `POST /api/ratings` y deduplicar por `userId`.
