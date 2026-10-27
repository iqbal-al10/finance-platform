// ============================================
// MAGIC BYTES VALIDATION
// --------------------------------------------
// Cek apakah isi file benar-benar PNG/JPEG/WEBP/PDF,
// bukan hanya header Content-Type yang dipalsukan.
// ============================================

function isPNG(buffer: Buffer): boolean {
  if (buffer.length < 8) return false
  return (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  )
}

function isJPEG(buffer: Buffer): boolean {
  if (buffer.length < 3) return false
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
}

function isWEBP(buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  const riff =
    buffer[0] === 0x52 && buffer[1] === 0x49 &&
    buffer[2] === 0x46 && buffer[3] === 0x46
  const webp =
    buffer[8] === 0x57 && buffer[9] === 0x45 &&
    buffer[10] === 0x42 && buffer[11] === 0x50
  return riff && webp
}

export function isValidImageBuffer(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case 'image/png':
      return isPNG(buffer)
    case 'image/jpeg':
    case 'image/jpg':
      return isJPEG(buffer)
    case 'image/webp':
      return isWEBP(buffer)
    default:
      return false
  }
}

export function isValidPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false
  return (
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 // F
  )
}
