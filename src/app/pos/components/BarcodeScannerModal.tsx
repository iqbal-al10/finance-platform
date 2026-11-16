'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Camera, Flashlight, FlashlightOff, ScanLine } from 'lucide-react'
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat } from '@zxing/library'

// ============================================
// TYPES
// ============================================
interface BarcodeScannerModalProps {
  isOpen: boolean
  onClose: () => void
  /** Dipanggil setiap kali barcode berhasil di-scan. Return true jika sukses (untuk beep sukses), false jika gagal (beep error). */
  onScan: (barcode: string) => Promise<boolean>
  /** Jumlah produk yang sudah berhasil discan (untuk counter di header). */
  scannedCount: number
}

// ============================================
// BEEP (via AudioContext — tanpa file audio)
// ============================================
function playBeep(success: boolean) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = success ? 1200 : 400
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
    setTimeout(() => ctx.close(), 300)
  } catch {
    // silent — audio bukan critical
  }
}

// ============================================
// COMPONENT
// ============================================
export function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  scannedCount,
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const lastScanRef = useRef<{ code: string; time: number } | null>(null)
  const onScanRef = useRef(onScan)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [lastScanned, setLastScanned] = useState<string | null>(null)

  // Keep onScan ref stabil (hindari restart kamera saat parent re-render)
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  // ============================================
  // START / STOP SCANNER
  // ============================================
  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    setError(null)
    setStarting(true)

    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE,
    ])
    hints.set(DecodeHintType.TRY_HARDER, true)

    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 200,
    })

    async function start() {
      try {
        if (!videoRef.current) return

        const controls = await reader.decodeFromVideoDevice(
          undefined, // default camera (belakang di HP)
          videoRef.current,
          async (result, err) => {
            if (cancelled) return
            if (!result) return

            const code = result.getText().trim()
            if (!code) return

            // Debounce: hindari scan dobel barcode yang sama dalam 1.5 detik
            const now = Date.now()
            const last = lastScanRef.current
            if (last && last.code === code && now - last.time < 1500) {
              return
            }
            lastScanRef.current = { code, time: now }

            setLastScanned(code)

            const ok = await onScanRef.current(code)
            playBeep(ok)
          }
        )

        if (cancelled) {
          controls.stop()
          return
        }

        controlsRef.current = controls
        setStarting(false)

        // Deteksi torch support
        try {
          const stream = videoRef.current?.srcObject as MediaStream | null
          const track = stream?.getVideoTracks?.()[0]
          const caps = (track?.getCapabilities?.() || {}) as MediaTrackCapabilities & {
            torch?: boolean
          }
          if (caps.torch) setTorchSupported(true)
        } catch {
          // silent
        }
      } catch (e: any) {
        console.error('[BarcodeScanner] start error:', e)
        if (cancelled) return
        setStarting(false)
        if (e?.name === 'NotAllowedError') {
          setError(
            'Izin kamera ditolak. Buka Chrome Settings → Site settings → iqbizz.my.id → Camera → Allow, lalu refresh.'
          )
        } else if (e?.name === 'NotFoundError') {
          setError('Kamera tidak ditemukan di perangkat ini.')
        } else {
          setError(e?.message || 'Gagal membuka kamera.')
        }
      }
    }

    start()

    return () => {
      cancelled = true
      try {
        controlsRef.current?.stop()
      } catch {
        // silent
      }
      controlsRef.current = null
      setTorchSupported(false)
      setTorchOn(false)
      setLastScanned(null)
      lastScanRef.current = null
    }
  }, [isOpen])

  // ============================================
  // TOGGLE TORCH
  // ============================================
  const toggleTorch = async () => {
    try {
      const stream = videoRef.current?.srcObject as MediaStream | null
      const track = stream?.getVideoTracks?.()[0]
      if (!track) return
      const newState = !torchOn
      await track.applyConstraints({
        advanced: [{ torch: newState } as MediaTrackConstraintSet],
      })
      setTorchOn(newState)
    } catch (e) {
      console.warn('[BarcodeScanner] torch toggle failed:', e)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <div className="relative w-full h-full flex flex-col">
        {/* HEADER */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Scan Barcode</p>
              <p className="text-white/70 text-xs">
                {scannedCount} produk discan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
                title={torchOn ? 'Matikan flashlight' : 'Nyalakan flashlight'}
              >
                {torchOn ? (
                  <FlashlightOff className="w-5 h-5 text-white" />
                ) : (
                  <Flashlight className="w-5 h-5 text-white" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
              title="Tutup"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* VIDEO */}
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />

          {/* FRAME OVERLAY */}
          {!error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-[75%] max-w-[340px] aspect-[4/3]">
                {/* Corners */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
                {/* Scan line animation */}
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-500/80 shadow-[0_0_10px_2px_rgba(239,68,68,0.6)] animate-scanline" />
              </div>
            </div>
          )}

          {/* STARTING */}
          {starting && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-white text-sm">Membuka kamera...</p>
              </div>
            </div>
          )}

          {/* ERROR */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
              <div className="max-w-sm text-center">
                <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
                  <Camera className="w-7 h-7 text-red-400" />
                </div>
                <p className="text-white font-semibold mb-2">Kamera Error</p>
                <p className="text-white/70 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* LAST SCANNED */}
          {lastScanned && !error && (
            <div className="absolute bottom-24 left-0 right-0 flex justify-center px-4">
              <div className="px-4 py-2 bg-black/70 backdrop-blur-sm rounded-full text-white text-sm font-mono">
                {lastScanned}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER HINT */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-6 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-center text-white/80 text-xs">
            Arahkan kamera ke barcode produk. Setiap scan otomatis menambah ke
            keranjang.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes scanline {
          0% {
            top: 10%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            top: 90%;
            opacity: 0;
          }
        }
        :global(.animate-scanline) {
          animation: scanline 2s linear infinite;
        }
      `}</style>
    </div>
  )
}
