# SECURITY FINDINGS — ApuntesArgentina
**Fecha de auditoría:** 2026-06-05  
**Auditor:** Red Team / Pentesting automatizado  
**Scope:** server.js · UploadPage.jsx · ApuntesPage.jsx · App.jsx · device.js · .env · package.json · vite.config.js

---

## RESUMEN EJECUTIVO

| Severidad | Cantidad |
|-----------|----------|
| CRÍTICA   | 3        |
| ALTA      | 5        |
| MEDIA     | 6        |
| BAJA      | 4        |

El vector de ataque más grave es la **ausencia total de autenticación en el backend**: cualquier persona que conozca la URL del servidor puede subir, eliminar y leer archivos sin presentar ningún token de Clerk. El sistema de ownership basado en `uploaderId` es un UUID generado en `localStorage` del navegador del uploader — conocerlo o adivinarlo es suficiente para borrar cualquier archivo.

---

## HALLAZGOS CRÍTICOS

---

### CRIT-01: Sin autenticación en ningún endpoint del backend — bypass total de Clerk

**Severidad:** CRÍTICA  
**Archivo:** `server.js` (todos los endpoints)  
**CVSS estimado:** 9.8

**Descripción:**  
El frontend muestra un "gate" de Clerk en `UploadPage.jsx` (línea 298: `if (!isSignedIn) { return ... }`), pero el backend Express **no valida ningún token de Clerk** en ningún endpoint. No existe middleware que llame a `verifyToken()` ni a la Clerk Backend SDK. El bloqueo ocurre exclusivamente en el navegador, siendo trivialmente bypasseable.

**Payload de ataque — subir un archivo sin cuenta:**
```bash
curl -X POST http://localhost:3002/api/upload \
  -F "file=@malware.pdf" \
  -F "university=UBA" \
  -F "career=Ingenieria" \
  -F "subject=Calculo"
```

La petición se procesa completamente. El archivo queda subido en R2. No se requiere cookie, token JWT, ni ningún header de autenticación.

**Impacto:**  
- Cualquier persona puede subir archivos sin registrarse (la promesa del frontend "necesitás una cuenta para subir" es falsa a nivel técnico).
- Cualquier persona puede llenar el bucket R2 hasta agotar el almacenamiento.
- Se invalida completamente el modelo de seguridad basado en Clerk.

**Línea vulnerable:** `server.js:292` — `app.post('/api/upload', uploadLimiter, upload.single('file'), async (req, res) => {`  
No hay middleware de auth antes ni dentro del handler.

---

### CRIT-02: Delete bypass — cualquiera puede borrar cualquier archivo si conoce el uploaderId

**Severidad:** CRÍTICA  
**Archivo:** `server.js:337-363`, `src/device.js:1-14`  
**CVSS estimado:** 9.1

**Descripción:**  
El mecanismo de ownership para borrar archivos consiste en comparar un `uploaderId` (UUID v4 almacenado en `localStorage`) enviado en el body del DELETE con el registrado en `_meta/uploads.json`. Este UUID **no es un secreto**: es generado en el browser del uploader sin firmarse ni vincularse a una sesión. Hay tres vectores para explotarlo:

**Vector A — Lectura del deviceId del target:**  
El `_meta/uploads.json` contiene pares `{ key: { uploaderId, uploadedAt } }`. Aunque `/api/uploads` filtra los `uploaderId` (línea 430-435), el endpoint `/api/verify-owner` (línea 439) recibe `uploaderId` en el body y responde `{ isOwner: true/false }`. Un atacante puede usar este endpoint para oracle-attack y confirmar si un UUID es dueño de un archivo.

**Vector B — Robo del localStorage:**  
El `uploaderId` es un UUID v4 visible en `localStorage` bajo la clave `aa-device-id`. Cualquier ataque XSS exitoso (ver ALTA-01) permite robar este valor.

**Vector C — Ausencia de autenticación en DELETE:**  
Como en CRIT-01, el DELETE tampoco requiere token Clerk. Solo se necesita el `uploaderId` correcto.

**Payload de ataque — borrar un archivo de otro usuario:**
```bash
# Paso 1: conseguir el uploaderId por social engineering, XSS, o
# simplemente enviando el propio deviceId si el atacante también es uploader del archivo
curl -X DELETE http://localhost:3002/api/files \
  -H "Content-Type: application/json" \
  -d '{"key":"UBA/Ingenieria/Calculo/apunte_victima.pdf","uploaderId":"uuid-robado-o-adivinado"}'
```

**Impacto:**  
Borrado masivo y no autorizado de todo el contenido del vault.

**Líneas vulnerables:**  
- `server.js:349` — `const record = uploads[rawKey]` — se busca con `rawKey` (sin sanitizar), pero se borra con `key` (sanitizado): desincronización entre los dos.
- `src/device.js:5-8` — el UUID se almacena en texto plano en `localStorage`.

---

### CRIT-03: Race condition / inconsistencia rawKey vs key en DELETE — posible bypass de ownership

**Severidad:** CRÍTICA  
**Archivo:** `server.js:341-355`  
**CVSS estimado:** 8.5

**Descripción:**  
En el endpoint DELETE existe una inconsistencia deliberada en el código:

```javascript
// server.js:341
const key = sanitizeKey(rawKey)   // key sanitizado para el borrado real

// server.js:349  
const record = uploads[rawKey]    // se busca con rawKey ORIGINAL (sin sanitizar) para el check de ownership
```

Si un atacante envía un `rawKey` que:
1. Después de `sanitizeKey()` coincide con un archivo real (el que quiere borrar)
2. Antes de sanitizar NO coincide con ningún registro en `uploads.json` (retorna `undefined`)

Entonces `record` es `undefined`, y el servidor responde `403` con `"No se encontró el registro de este archivo"`. Sin embargo, esto sugiere que archivos subidos sin pasar por el registro `_meta/uploads.json` (p.ej., subidos directamente a R2, o si `writeMeta` falló en background) son **inborrables vía UI** pero el servidor hace el `DeleteObjectCommand` con `key` sanitizado en línea 355 si el `record` no es `undefined`.

Más grave: si `_meta/uploads.json` se corrompe o se borra (ver ALTA-02), **todos los archivos quedan "sin dueño" y nadie puede borrarlos** — o peor, si un atacante puede escribir en ese JSON con `uploaderId` propio para todos los registros, se vuelve dueño de todo.

**Payload:**
```bash
# Forzar la condición: enviar key con variante de mayúsculas/acentos que
# sanitizePath normalice a algo distinto de la clave original en uploads.json
curl -X DELETE http://localhost:3002/api/files \
  -H "Content-Type: application/json" \
  -d '{"key":"UBA/Ingenieria/Calculo/../Calculo/apunte.pdf","uploaderId":"cualquier-cosa"}'
```

**Línea vulnerable:** `server.js:349` — `const record = uploads[rawKey]` en lugar de `uploads[key]`.

---

## HALLAZGOS ALTOS

---

### ALTA-01: Ratings sin autenticación + sin límite por archivo — inflate/deflate DoS sobre el índice

**Severidad:** ALTA  
**Archivo:** `server.js:406-423`  
**CVSS estimado:** 7.5

**Descripción:**  
El endpoint `POST /api/ratings` tiene solo un rate limit de 30 req/min por IP. No valida que el usuario esté autenticado, ni que ya haya votado antes (el control de "ya voté" está únicamente en `localStorage` del cliente, línea 19 de `ApuntesPage.jsx`). Un atacante puede:

1. Inflar artificialmente el rating de sus propios archivos.
2. Degradar archivos de competidores a 1 estrella sistemáticamente.
3. Hacer crecer `_meta/ratings.json` indefinidamente en R2.

**Payload — inflar rating de un archivo:**
```bash
for i in $(seq 1 1000); do
  curl -s -X POST http://localhost:3002/api/ratings \
    -H "Content-Type: application/json" \
    -d '{"key":"UBA/Ingenieria/Calculo/apunte.pdf","stars":5}'
done
```

Con 30 req/min por IP, basta rotar IPs (VPN, Tor) o esperar para acumular miles de votos falsos. El `avg` calculado en línea 418 (`entry.total / entry.count`) nunca resetea ni valida rangos razonables de `count`.

**Impacto:** Manipulación del sistema de calificaciones, DoS sobre `_meta/ratings.json` al crecer sin límite.

**Línea vulnerable:** `server.js:406` — `app.post('/api/ratings', rateLimit({...}), async (req, res) => {`

---

### ALTA-02: Corrupción del _meta/uploads.json — escritura concurrente sin mutex

**Severidad:** ALTA  
**Archivo:** `server.js:326-329`  
**CVSS estimado:** 7.3

**Descripción:**  
La escritura en `_meta/uploads.json` ocurre en background con `.then()` sin mutex ni bloqueo:

```javascript
// server.js:326-329
readMeta('_meta/uploads.json').then(data => {
  data[key] = { uploaderId, uploadedAt: new Date().toISOString() }
  return writeMeta('_meta/uploads.json', data)
}).catch(console.error)
```

Si dos uploads ocurren concurrentemente (posible: `uploadLimiter` permite 20/hora, no 1 a la vez), ambos leen el mismo estado de `uploads.json`, cada uno agrega su entrada, y el último en escribir sobreescribe la entrada del otro. Resultado: registros perdidos, archivos que quedan sin dueño (nadie puede borrarlos, ver CRIT-03).

El mismo patrón existe en `writeMeta` para ratings en línea 419.

**Payload de ataque:**
```bash
# Lanzar 5 uploads simultáneos
for i in $(seq 1 5); do
  curl -X POST http://localhost:3002/api/upload \
    -F "file=@test$i.pdf" \
    -F "university=UBA" \
    -F "career=Ing" \
    -F "subject=Calc" &
done; wait
```

**Impacto:** Corrupción de metadatos, archivos sin dueño permanente, inconsistencias en el vault.

**Línea vulnerable:** `server.js:326`

---

### ALTA-03: CORS permite requests sin Origin en entornos no-producción

**Severidad:** ALTA  
**Archivo:** `server.js:83`

**Descripción:**  
```javascript
if (!origin && process.env.NODE_ENV !== 'production') return cb(null, true)
```

Si el servidor se despliega en staging o Railway sin `NODE_ENV=production`, cualquier cliente sin header `Origin` (curl, scripts, herramientas automatizadas) puede hacer peticiones CORS sin restricción. En producción correctamente configurada esto no aplica, pero si el deployer olvida setear la variable, el CORS queda completamente abierto.

Adicionalmente, el trust proxy está configurado como `app.set('trust proxy', 1)` (línea 67) pero no se valida que el proxy sea de confianza — en infraestructura compartida un atacante podría falsificar `X-Forwarded-For` para bypassear el rate limit.

**Payload:**
```bash
NODE_ENV="" curl -X POST http://staging.apuntesargentina.ar/api/upload \
  -F "file=@evil.pdf" -F "university=UBA" -F "career=Ing" -F "subject=Mat"
```

**Línea vulnerable:** `server.js:83`

---

### ALTA-04: Mimetype validado solo por header HTTP — content-type spoofing

**Severidad:** ALTA  
**Archivo:** `server.js:129-133`

**Descripción:**  
La validación de tipo de archivo en multer usa exclusivamente `file.mimetype`, que proviene del header `Content-Type` del multipart enviado por el cliente. Un atacante puede:

1. Renombrar `evil.html` a `notes.pdf`
2. Enviar `Content-Type: application/pdf` en el multipart field

El servidor acepta el archivo como PDF válido, lo sube a R2 con `ContentType: 'application/pdf'`, y cuando se sirve vía `/api/preview`, el navegador lo renderiza como HTML ejecutando scripts.

**Payload:**
```bash
curl -X POST http://localhost:3002/api/upload \
  -F 'file=@/tmp/xss.html;type=application/pdf;filename=apunte.pdf' \
  -F "university=UBA" -F "career=Ingenieria" -F "subject=Calculo"
```

Donde `xss.html` contiene `<script>alert(document.cookie)</script>`.

Cuando una víctima visite `/api/preview?key=UBA/Ingenieria/Calculo/apunte.pdf`, el servidor responderá con `Content-Type: application/pdf` pero el contenido será HTML con scripts ejecutables.

**Nota:** El navegador moderno puede ignorar el `Content-Type` declarado si detecta HTML, pero esto depende del navegador y de los headers de seguridad (CSP está deshabilitado, ver MEDIA-01).

**Línea vulnerable:** `server.js:129` — `fileFilter: (_req, file, cb) => { if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true) }`

---

### ALTA-05: uploaderId expuesto en FormData y almacenado en R2 metadata sin cifrar

**Severidad:** ALTA  
**Archivo:** `server.js:318-323`, `src/device.js:5-8`

**Descripción:**  
El `uploaderId` (UUID del dispositivo) se envía en el FormData de cada upload (visible en DevTools), se almacena en `_meta/uploads.json` en R2, y también se guarda como metadata del objeto S3 en el campo `uploader-id`. 

Si el bucket R2 tiene permisos de lectura pública (práctica común para CDN), cualquiera con acceso a los objetos puede obtener el `uploaderId` de cualquier archivo a través de la metadata S3, y luego borrar todos los archivos del mismo dispositivo.

```bash
# Obtener metadata del objeto en R2 con permisos públicos
aws s3api head-object --bucket apuntes-argentina \
  --key "UBA/Ingenieria/Calculo/apunte.pdf" \
  --endpoint-url https://xxx.r2.cloudflarestorage.com
# Retorna: "uploader-id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Ahora borrar todos los archivos de ese dispositivo
curl -X DELETE http://api.apuntesargentina.ar/api/files \
  -H "Content-Type: application/json" \
  -d '{"key":"UBA/Ingenieria/Calculo/apunte.pdf","uploaderId":"xxxxxxxx-xxxx-..."}'
```

**Línea vulnerable:** `server.js:321` — `'uploader-id': uploaderId`

---

## HALLAZGOS MEDIOS

---

### MEDIA-01: CSP deshabilitado explícitamente

**Severidad:** MEDIA  
**Archivo:** `server.js:70-74`

**Descripción:**  
```javascript
app.use(helmet({
  contentSecurityPolicy: false,  // CSP DESACTIVADO
  crossOriginEmbedderPolicy: false,
```

El comentario dice "sin CSP agresivo para no romper el iframe de preview", pero deshabilitar CSP completamente elimina la principal defensa contra XSS. Combinado con ALTA-04 (HTML disfrazado de PDF), si el preview se sirve desde el mismo origen que la app, un XSS puede robar tokens Clerk, `localStorage` completo (incluido `aa-device-id`), etc.

**Línea vulnerable:** `server.js:71`

---

### MEDIA-02: Rate limit bypasseable mediante rotación de IPs / X-Forwarded-For spoofing

**Severidad:** MEDIA  
**Archivo:** `server.js:67`, `server.js:94-106`

**Descripción:**  
`app.set('trust proxy', 1)` hace que Express use `X-Forwarded-For` para identificar la IP del cliente. En despliegues sin un proxy confiable que valide este header, cualquier atacante puede falsificar su IP:

```bash
curl -X POST http://localhost:3002/api/upload \
  -H "X-Forwarded-For: 1.2.3.4" \
  -F "file=@test.pdf" -F "university=UBA" -F "career=Ing" -F "subject=Mat"
```

Con esto, el `uploadLimiter` (20 uploads/hora) es bypasseable cambiando el header en cada request. Un atacante automatizado puede subir miles de archivos por hora.

**Línea vulnerable:** `server.js:67`

---

### MEDIA-03: Endpoint /api/health expone el nombre del bucket

**Severidad:** MEDIA  
**Archivo:** `server.js:260-262`

**Descripción:**  
```javascript
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', bucket: BUCKET })
})
```

El nombre del bucket Cloudflare R2 se expone públicamente sin autenticación. Este valor, combinado con la URL del endpoint R2 (también inferible), puede facilitar ataques directos al storage.

**Payload:**
```bash
curl http://localhost:3002/api/health
# Retorna: {"status":"ok","bucket":"apuntes-argentina-prod"}
```

**Línea vulnerable:** `server.js:261`

---

### MEDIA-04: Nombre de archivo del usuario no sanitizado correctamente — posible null-byte en S3 key

**Severidad:** MEDIA  
**Archivo:** `server.js:306-313`

**Descripción:**  
El nombre limpio del archivo se construye con:

```javascript
const baseName = req.file.originalname
  .normalize('NFC')
  .replace(/\.\w+$/, '')
  .replace(/[^\w.\- áéíóúÁÉÍÓÚñÑüÜ]/g, '_')
  .slice(0, 150)
const clean = baseName + ext
const key = `${uni}/${career}/${subject}/${clean}`
```

El problema: `ext` viene de `compressFile()` que usa `originalname.match(/\.\w+$/)?.[0] ?? ''`. Si `originalname` es `"evil.pdf.html"`, la extensión extraída es `".html"`, y aunque `baseName` queda como `"evil_pdf"`, el key final es `"evil_pdf.html"`. Los ALLOWED_MIMES validan el `file.mimetype` (que el atacante controla), no la extensión real del archivo.

Adicionalmente, `originalname` no está completamente sanitizado de caracteres Unicode que podrían causar comportamientos inesperados en S3/R2 keys.

**Línea vulnerable:** `server.js:303` — `const { buffer, mimetype, ext } = await compressFile(req.file.buffer, req.file.mimetype, req.file.originalname)`

---

### MEDIA-05: Ratings acumulan sin límite — DoS sobre _meta/ratings.json

**Severidad:** MEDIA  
**Archivo:** `server.js:415-421`

**Descripción:**  
El objeto `_meta/ratings.json` crece indefinidamente a medida que se agregan votos. No hay límite en el tamaño del JSON ni paginación. Con suficientes archivos y votos, este archivo puede crecer a megabytes, y cada request a `/api/ratings` (línea 401) devuelve **el JSON completo** al cliente sin paginación.

```bash
# Ver todos los ratings (potencialmente MBs de respuesta)
curl http://localhost:3002/api/ratings
```

**Impacto:** DoS por respuesta masiva, costos elevados de R2 egress, OOM en el servidor al parsear el JSON.

**Línea vulnerable:** `server.js:401`

---

### MEDIA-06: buildTree() lista TODO el bucket en cada llamada — sin caché ni paginación eficiente

**Severidad:** MEDIA  
**Archivo:** `server.js:143-167`

**Descripción:**  
`buildTree()` usa `ListObjectsV2Command` con un do-while que pagina hasta listar **todos** los objetos del bucket. Con miles de archivos, esto:
1. Tarda varios segundos (la API está bloqueada esperando).
2. Consume créditos de API de R2 en cada request a `/api/tree`.
3. No tiene caché: cada `GET /api/tree` reitera el proceso.

Un atacante puede hacer DoS del servidor y agotar el presupuesto de R2:
```bash
while true; do curl http://localhost:3002/api/tree; done
```

El `globalLimiter` de 200 req/15min limita a ~13 req/min por IP, pero desde múltiples IPs es explotable. Además, `updateIndex()` (que también llama `buildTree()`) se invoca en **cada upload** sin rate limiting propio (línea 331).

**Línea vulnerable:** `server.js:143`, `server.js:331`

---

## HALLAZGOS BAJOS

---

### BAJA-01: CLERK_SECRET_KEY en .env sin separación de entorno

**Severidad:** BAJA  
**Archivo:** `.env`

**Descripción:**  
El archivo `.env` contiene tanto `VITE_CLERK_PUBLISHABLE_KEY` (que Vite expone al bundle del frontend, lo cual es correcto) como `CLERK_SECRET_KEY` (que NUNCA debe llegar al frontend). Sin embargo, dado que el backend no usa Clerk en absoluto (ver CRIT-01), la `CLERK_SECRET_KEY` está definida pero no utilizada — riesgo de que en el futuro alguien la use incorrectamente o de que quede expuesta en logs.

Además, `VITE_CLERK_PUBLISHABLE_KEY` aparece en el bundle JavaScript del frontend (por diseño de Vite), pero si accidentalmente se define alguna variable con prefijo `VITE_` que contenga secretos, quedarían expuestos.

**Impacto bajo actual** porque el secret key no se usa, pero el patrón es riesgoso.

---

### BAJA-02: deleteFile en UploadPage.jsx no envía uploaderId

**Severidad:** BAJA  
**Archivo:** `src/UploadPage.jsx:255-263`

**Descripción:**  
```javascript
// UploadPage.jsx:258
await fetch(`${API}/files`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key })  // SIN uploaderId
})
```

La función `deleteFile` en `UploadPage.jsx` envía el DELETE sin incluir `uploaderId`. El backend responderá `403 "No se encontró el registro de este archivo"` para archivos registrados, pero para archivos sin registro en `_meta/uploads.json` podría proceder diferente (ver CRIT-03). Esta inconsistencia también significa que los usuarios legítimos no pueden borrar sus archivos desde `UploadPage`.

**Línea vulnerable:** `src/UploadPage.jsx:258`

---

### BAJA-03: Información de error interna filtrada en error handler

**Severidad:** BAJA  
**Archivo:** `server.js:452-457`

**Descripción:**  
```javascript
app.use((err, _req, res, _next) => {
  if (err.message?.includes('CORS')) return res.status(403).json({ error: err.message })
  if (err.message?.includes('Tipo no permitido')) return res.status(415).json({ error: err.message })
  console.error('[error]', err.message)
  res.status(500).json({ error: 'Error interno del servidor' })
})
```

El mensaje de error de CORS se expone directamente al cliente: `"CORS: origin no permitido — https://evil.com"`. Esto confirma al atacante que el CORS está configurado y cuál es el error exacto. Menor, pero es information disclosure.

En algunos casos los handlers individuales también exponen `err.message` directamente (p.ej., `server.js:288`: `res.status(500).json({ error: err.message })`), lo que podría exponer mensajes de error internos de AWS SDK con información del bucket o credenciales.

**Línea vulnerable:** `server.js:288, 333, 362`

---

### BAJA-04: compress-pdf usa tmp files sin hardened path

**Severidad:** BAJA  
**Archivo:** `server.js:185-193`

**Descripción:**  
```javascript
const tmpIn = join(tmpdir(), `aa_${randomBytes(6).toString('hex')}.pdf`)
await writeFile(tmpIn, buffer)
const compressed = await compressPdf(tmpIn, { resolution: 'ebook' })
```

El archivo temporal se crea con nombre aleatorio (6 bytes = 12 hex chars) en el directorio temp del sistema. Aunque el nombre es suficientemente aleatorio, `compress-pdf` internamente usa Ghostscript. Si Ghostscript no está instalado o hay vulnerabilidades en la versión del sistema, el proceso podría fallar de forma no esperada. Más importante: si el servidor se cae durante la compresión, el archivo temporal **no se elimina** (el `finally { await unlink(tmpIn) }` solo corre si `writeFile` y `compressPdf` completan sin lanzar al `catch`).

Si `compressPdf` lanza, el `catch` exterior en `compressFile` captura el error pero el archivo temporal queda en disco. Con suficientes uploads que fallan en compresión, el disco se llena.

**Línea vulnerable:** `server.js:185-193` — el `finally` en línea 192 solo cubre el bloque interno, pero si `writeFile` en línea 187 falla, el archivo no existe y `unlink` silencia el error — correcto. Si `compressPdf` falla con un throw que escapa al `catch` del try interno, el `finally` sí corre. Hay cobertura parcial, pero no total.

---

## TABLA DE RESUMEN

| ID | Severidad | Categoría | Archivo | Línea |
|----|-----------|-----------|---------|-------|
| CRIT-01 | CRÍTICA | Autenticación | server.js | 292 |
| CRIT-02 | CRÍTICA | Delete abuse / Auth | server.js, device.js | 337, 5 |
| CRIT-03 | CRÍTICA | Business logic / rawKey vs key | server.js | 349 |
| ALTA-01 | ALTA | Rating manipulation / Auth | server.js | 406 |
| ALTA-02 | ALTA | Race condition / uploads.json | server.js | 326 |
| ALTA-03 | ALTA | CORS misconfiguration | server.js | 83 |
| ALTA-04 | ALTA | File content attack / MIME spoof | server.js | 129 |
| ALTA-05 | ALTA | uploaderId en S3 metadata | server.js | 321 |
| MEDIA-01 | MEDIA | CSP deshabilitado | server.js | 71 |
| MEDIA-02 | MEDIA | Rate limit bypass / X-Forwarded-For | server.js | 67 |
| MEDIA-03 | MEDIA | Info disclosure / bucket name | server.js | 261 |
| MEDIA-04 | MEDIA | Filename sanitization | server.js | 303 |
| MEDIA-05 | MEDIA | DoS / ratings JSON unbounded | server.js | 401 |
| MEDIA-06 | MEDIA | DoS / buildTree sin caché | server.js | 143 |
| BAJA-01 | BAJA | CLERK_SECRET_KEY sin uso | .env | — |
| BAJA-02 | BAJA | deleteFile sin uploaderId | UploadPage.jsx | 258 |
| BAJA-03 | BAJA | Error message disclosure | server.js | 288 |
| BAJA-04 | BAJA | Tmp file leak | server.js | 185 |

---

## DEPENDENCIAS — CVEs conocidos

`npm audit` retornó **0 vulnerabilidades** al momento de la auditoría. Las versiones actuales están dentro de rangos seguros.

Sin embargo, se recomienda vigilar:
- `multer@1.4.5-lts.1`: versión LTS de mantenimiento mínimo. Evaluar migración a `busboy` o `formidable`.
- `compress-pdf@0.6.3`: wrapper de Ghostscript. La seguridad depende de la versión de Ghostscript instalada en el servidor (no gestionada por npm).
- `express@4.19.x`: Express 5 ya está disponible; Express 4 sigue con soporte pero tiene patrones legacy.

---

*Reporte generado para uso interno. No distribuir.*
