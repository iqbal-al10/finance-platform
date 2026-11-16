// ============================================
// AVATAR HELPERS
// --------------------------------------------
// Avatar di DB bisa berupa:
// - Preset name  : "avatar-1", "avatar-2", ..., "avatar-12"
//   → dirender sebagai emoji + warna background
//     (sama persis dengan /profile).
// - Path lokal   : "/uploads/avatars/xxx.png"
// - URL eksternal: "https://res.cloudinary.com/..."
//   → dirender sebagai <img>.
// - null         : belum set avatar
//   → fallback emoji 👤 dengan bg netral
//     (sama persis dengan /profile).
//
// Catatan:
// - Preset avatar TIDAK dirender dari file SVG
//   (file-nya tidak ada). Preset dirender via
//   emoji + warna background, sama seperti
//   /profile.
// ============================================

export interface AvatarOption {
  id: string
  emoji: string
  color: string
  label: string
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'avatar-1', emoji: '🧑‍🌾', color: '#27AE60', label: 'Petani' },
  { id: 'avatar-2', emoji: '🕵️', color: '#34495E', label: 'Detektif' },
  { id: 'avatar-3', emoji: '🧑‍🎤', color: '#E84393', label: 'Penyanyi' },
  { id: 'avatar-4', emoji: '🧑‍💻', color: '#96CEB4', label: 'Programmer' },
  { id: 'avatar-5', emoji: '👨‍💼', color: '#FFEAA7', label: 'Bisnis' },
  { id: 'avatar-6', emoji: '👩‍🎨', color: '#DDA0DD', label: 'Seniman' },
  { id: 'avatar-7', emoji: '🧑‍🏫', color: '#FF8A94', label: 'Guru' },
  { id: 'avatar-8', emoji: '👨‍🔬', color: '#A29BFE', label: 'Ilmuwan' },
  { id: 'avatar-9', emoji: '🧑‍🚀', color: '#FD79A8', label: 'Astronot' },
  { id: 'avatar-10', emoji: '👨‍🍳', color: '#00B894', label: 'Koki' },
  { id: 'avatar-11', emoji: '🧑‍⚕️', color: '#E17055', label: 'Dokter' },
  { id: 'avatar-12', emoji: '🏋️', color: '#E67E22', label: 'Atlet' },
]

export interface AvatarData {
  type: 'preset' | 'image' | 'none'
  emoji: string | null
  color: string | null
  imageUrl: string | null
  label: string | null
}

/**
 * Parse avatar string (dari DB) menjadi data render.
 *
 * - Preset (avatar-1 s/d avatar-12) → { type: 'preset', emoji, color, label }
 * - URL/path (http/https, /uploads/, /) → { type: 'image', imageUrl }
 * - null/empty → { type: 'none' }
 */
export function getAvatarData(avatar: string | null | undefined): AvatarData {
  if (!avatar || avatar.trim() === '') {
    return { type: 'none', emoji: null, color: null, imageUrl: null, label: null }
  }

  const trimmed = avatar.trim()

  // Preset
  const preset = AVATAR_OPTIONS.find((a) => a.id === trimmed)
  if (preset) {
    return {
      type: 'preset',
      emoji: preset.emoji,
      color: preset.color,
      imageUrl: null,
      label: preset.label,
    }
  }

  // Path lokal / URL eksternal
  if (trimmed.startsWith('/') || trimmed.startsWith('http')) {
    return {
      type: 'image',
      emoji: null,
      color: null,
      imageUrl: trimmed,
      label: null,
    }
  }

  // Unknown format → anggap none
  return { type: 'none', emoji: null, color: null, imageUrl: null, label: null }
}

/**
 * Inisial nama (fallback netral, max 2 char).
 * Dipakai jika butuh fallback text-based (bukan di avatar preset).
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'

  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)

  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
}