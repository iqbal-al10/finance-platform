'use client'

import { useEffect, useState } from 'react'
import {
  Mail,
  MessageCircle,
  Instagram,
  Facebook,
  Twitter,
  Youtube,
} from 'lucide-react'

interface PublicSettings {
  siteName: string
  platformDescription: string
  supportEmail: string
  supportPhone: string
  waAdminNumber: string
  instagramUrl: string
  facebookUrl: string
  twitterUrl: string
  youtubeUrl: string
  footerText: string
  footerEnabled: boolean
}

const EMPTY: PublicSettings = {
  siteName: '',
  platformDescription: '',
  supportEmail: '',
  supportPhone: '',
  waAdminNumber: '',
  instagramUrl: '',
  facebookUrl: '',
  twitterUrl: '',
  youtubeUrl: '',
  footerText: '',
  footerEnabled: true,
}

// ============================================
// FOOTER
// --------------------------------------------
// Client component yang fetch /api/settings/public
// (cache 30 detik). Menampilkan kontak & sosmed.
// - Jika footerEnabled = false -> return null
// - Jika footerText kosong -> tidak tampil
// ============================================
export function Footer() {
  const [settings, setSettings] = useState<PublicSettings>(EMPTY)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings/public', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          setSettings({
            siteName: data.siteName || '',
            platformDescription: data.platformDescription || '',
            supportEmail: data.supportEmail || '',
            supportPhone: data.supportPhone || '',
            waAdminNumber: data.waAdminNumber || '',
            instagramUrl: data.instagramUrl || '',
            facebookUrl: data.facebookUrl || '',
            twitterUrl: data.twitterUrl || '',
            youtubeUrl: data.youtubeUrl || '',
            footerText: data.footerText || '',
            footerEnabled:
              data.footerEnabled !== undefined ? data.footerEnabled : true,
          })
          setLoaded(true)
        }
      } catch {
        // silent
        if (!cancelled) setLoaded(true)
      }
    }
    fetchSettings()
    return () => {
      cancelled = true
    }
  }, [])

  // Jangan render sebelum load (mencegah flicker)
  if (!loaded) return null

  // Jika footer dinonaktifkan → tidak render
  if (!settings.footerEnabled) return null

  const year = new Date().getFullYear()
  const brand = settings.siteName || 'IQBizz'

  // Bersihkan nomor WA untuk link wa.me
  const cleanWa = settings.waAdminNumber.replace(/[^0-9]/g, '')
  const waLink = cleanWa ? `https://wa.me/${cleanWa}` : ''

  // Cek apakah ada minimal 1 kontak atau sosmed
  const hasContact =
    Boolean(settings.supportEmail) || Boolean(waLink)
  const hasSocial =
    Boolean(settings.instagramUrl) ||
    Boolean(settings.facebookUrl) ||
    Boolean(settings.twitterUrl) ||
    Boolean(settings.youtubeUrl)

  return (
    <footer className="border-t border-gray-200 bg-white px-4 sm:px-6 py-[17.7px] mt-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
        {/* Brand & Copyright */}
        <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
          <span className="font-semibold text-gray-700">{brand}</span>
          <span className="hidden sm:inline text-gray-300">|</span>
          <span>
            © {year} {brand}.
            {settings.footerText && (
              <>
                {' '}
                {settings.footerText}
              </>
            )}
          </span>
        </div>

        {/* Kontak & Sosmed */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {settings.supportEmail && (
            <a
              href={`mailto:${settings.supportEmail}`}
              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
              title={`Email: ${settings.supportEmail}`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Email</span>
            </a>
          )}

          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-green-600 transition-colors"
              title="WhatsApp Admin"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
          )}

          {hasSocial && (
            <span className="hidden sm:inline text-gray-300">|</span>
          )}

          {settings.instagramUrl && (
            <a
              href={settings.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-pink-600 transition-colors"
              title="Instagram"
            >
              <Instagram className="w-3.5 h-3.5" />
            </a>
          )}

          {settings.facebookUrl && (
            <a
              href={settings.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition-colors"
              title="Facebook"
            >
              <Facebook className="w-3.5 h-3.5" />
            </a>
          )}

          {settings.twitterUrl && (
            <a
              href={settings.twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-sky-500 transition-colors"
              title="Twitter / X"
            >
              <Twitter className="w-3.5 h-3.5" />
            </a>
          )}

          {settings.youtubeUrl && (
            <a
              href={settings.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-red-600 transition-colors"
              title="YouTube"
            >
              <Youtube className="w-3.5 h-3.5" />
            </a>
          )}

          {!hasContact && !hasSocial && (
            <span className="text-gray-400">IQCorporation</span>
          )}
        </div>
      </div>
    </footer>
  )
}
