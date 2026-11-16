import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

// ============================================
// SHORTLINK REDIRECT
// --------------------------------------------
// URL pendek: https://iqbizz.my.id/v/a1b2c3
// → redirect ke halaman verifikasi asli
// ============================================

export default async function ShortlinkRedirect({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  if (!code) {
    redirect('/')
  }

  try {
    const shortlink = await prisma.saleShortlink.findUnique({
      where: { code },
      select: { saleId: true, sig: true },
    })

    if (!shortlink) {
      // Shortlink tidak ditemukan → redirect ke home
      redirect('/')
    }

    // Redirect ke halaman verifikasi asli
    redirect(`/pos/verify/${shortlink.saleId}?sig=${shortlink.sig}`)
  } catch (error) {
    // Jika redirect() dipanggil, Next.js melempar error khusus (NEXT_REDIRECT).
    // Jangan tangkap error itu. Hanya log error lain.
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof (error as any).digest === 'string' &&
      (error as any).digest.startsWith('NEXT_REDIRECT')
    ) {
      throw error
    }
    console.error('[shortlink] error:', error)
    redirect('/')
  }
}
