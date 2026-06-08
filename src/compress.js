// ── Compresión de imágenes en el navegador antes de subir ───────────────────
// El flujo de subida usa presigned URLs (el archivo va directo del navegador a R2,
// sin pasar por el servidor), así que la compresión del lado del server no se aplica.
// Y en Vercel serverless no hay Ghostscript para PDFs. Por eso optimizamos las
// imágenes acá, en el cliente: reduce el peso de subida, el storage y el ancho de banda.
//
// Mantiene el formato original (jpg→jpg, png→png) para que la extensión, el
// Content-Type firmado y la validación de magic-bytes del server sigan coincidiendo.

const MAX_DIM = 1920        // lado más largo máximo
const JPEG_QUALITY = 0.82

/**
 * Comprime una imagen (jpg/jpeg/png) redimensionando a MAX_DIM y re-encodeando.
 * Devuelve un File nuevo, o el original si no es imagen o si no se logró reducir.
 */
export async function compressImage(file) {
  if (!file || !/^image\/(jpe?g|png)$/i.test(file.type)) return file
  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    const scale = Math.min(1, MAX_DIM / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close?.(); return file }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const type = /png$/i.test(file.type) ? 'image/png' : 'image/jpeg'
    const quality = type === 'image/jpeg' ? JPEG_QUALITY : undefined
    const blob = await new Promise(res => canvas.toBlob(res, type, quality))

    // Solo usar la versión comprimida si realmente pesa menos
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name, { type, lastModified: Date.now() })
  } catch {
    return file   // ante cualquier error, subir el original sin romper nada
  }
}
