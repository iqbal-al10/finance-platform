// ============================================
// CLOUDINARY DIRECT UPLOAD (BROWSER)
// --------------------------------------------
// File dikirim LANGSUNG dari browser ke Cloudinary
// (tidak melewati Vercel), sehingga tidak kena
// batas body 4.5 MB Vercel Functions.
// ============================================

type UploadType =
  | 'product'
  | 'payment-proof'
  | 'avatar'
  | 'logo'
  | 'favicon'
  | 'platform-branding'
  | 'qris'

interface UploadResult {
  success: boolean
  url?: string
  publicId?: string
  error?: string
}

export async function uploadToCloudinary(
  file: File,
  type: UploadType
): Promise<UploadResult> {
  try {
    const signRes = await fetch('/api/upload/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })

    if (!signRes.ok) {
      const err = await signRes.json().catch(() => ({}))
      return { success: false, error: err.error || 'Gagal mendapatkan signature' }
    }

    const sign = await signRes.json()

    const formData = new FormData()
    formData.append('file', file)
    formData.append('api_key', sign.apiKey)
    formData.append('timestamp', String(sign.timestamp))
    formData.append('signature', sign.signature)
    formData.append('folder', sign.folder)
    if (sign.transformation) {
      formData.append('transformation', sign.transformation)
    }

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
      { method: 'POST', body: formData }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error?.message || 'Upload gagal' }
    }

    const data = await res.json()
    return { success: true, url: data.secure_url, publicId: data.public_id }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload gagal',
    }
  }
}
