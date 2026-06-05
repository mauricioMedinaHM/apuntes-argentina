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
