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
  onScan: (barcode: string) => Promise<boolean>
  scannedCount: number
}

interface TapIndicator {
  x: number
  y: number
  visible: boolean
}

// ============================================
// BEEP
// ============================================
function playBeep(success: boolean) {
  try {
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext
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
    // silent
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
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const lastScanRef = useRef<{ code: string; time: number } | null>(null)
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)

  // Penanda: apakah modal ditutup karena popstate (back HP)?
  const closedByPopstateRef = useRef(false)
  // Penanda: apakah pushState berhasil?
  const pushedStateRef = useRef(false)

  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [lastScanned, setLastScanned] = useState<string | null>(null)

  // Zoom
  const [zoomSupported, setZoomSupported] = useState(false)
  const [zoomValue, setZoomValue] = useState(1)
  const [zoomMin, setZoomMin] = useState(1)
  const [zoomMax, setZoomMax] = useState(1)
  const [zoomStep, setZoomStep] = useState(0.1)

  // Tap-to-focus
  const [tapFocusSupported, setTapFocusSupported] = useState(false)
  const [tapIndicator, setTapIndicator] = useState<TapIndicator>({
    x: 0,
    y: 0,
    visible: false,
  })

  // Keep refs stabil
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // ============================================
  // BACK BUTTON HANDLING — VERSI 3 (FIX)
  // --------------------------------------------
  // Logika baru:
  // 1. Buka modal → pushState sekali (guard back HP).
  // 2. Back HP → popstate → onClose (state sudah di-pop browser).
  // 3. X diklik → onClose langsung (TIDAK sentuh history).
  // 4. Cleanup → hanya history.back() jika modal ditutup
  //    BUKAN karena popstate (mis. via X / parent unmount),
  //    supaya state yang kita push tidak nyangkut.
  // ============================================
  useEffect(() => {
    if (!isOpen) return

    // Reset penanda
    closedByPopstateRef.current = false
    pushedStateRef.current = false

    // Push state untuk guard back HP
    try {
      window.history.pushState({ barcodeScanner: true }, '')
      pushedStateRef.current = true
    } catch {
      // silent
    }

    const handlePopState = () => {
      // Tandai bahwa modal ditutup karena back HP
      closedByPopstateRef.current = true
      // Panggil onClose untuk menutup modal
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)

      // Cleanup: jika modal ditutup BUKAN karena popstate,
      // kita perlu pop state yang kita push agar tidak nyangkut.
      if (pushedStateRef.current && !closedByPopstateRef.current) {
        try {
          window.history.back()
        } catch {
          // silent
        }
      }

      pushedStateRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

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
          undefined,
          videoRef.current,
          async (result) => {
            if (cancelled) return
            if (!result) return

            const code = result.getText().trim()
            if (!code) return

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

        // Deteksi capabilities
        try {
          const stream = videoRef.current?.srcObject as MediaStream | null
          const track = stream?.getVideoTracks?.()[0] || null
          trackRef.current = track
          if (!track) return

          const caps = (track.getCapabilities?.() || {}) as any

          // Torch
          if (caps.torch) setTorchSupported(true)

          // Zoom
          if (caps.zoom) {
            setZoomSupported(true)
            const min = caps.zoom.min ?? 1
            const max = caps.zoom.max ?? 1
            const step = caps.zoom.step ?? 0.1
            setZoomMin(min)
            setZoomMax(max)
            setZoomStep(step)
            const settings = track.getSettings?.() as any
            setZoomValue(settings?.zoom ?? min)
          }

          // Tap-to-focus
          if (caps.focusMode && Array.isArray(caps.focusMode)) {
            if (caps.focusMode.includes('single-shot')) {
              setTapFocusSupported(true)
            }
          }
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
      trackRef.current = null
      setTorchSupported(false)
      setTorchOn(false)
      setZoomSupported(false)
      setTapFocusSupported(false)
      setTapIndicator({ x: 0, y: 0, visible: false })
      setLastScanned(null)
      lastScanRef.current = null
    }
  }, [isOpen])

  // ============================================
  // TOGGLE TORCH
  // ============================================
  const toggleTorch = async () => {
    try {
      const track = trackRef.current
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

  // ============================================
  // ZOOM CHANGE
  // ============================================
  const handleZoomChange = async (value: number) => {
    setZoomValue(value)
    try {
      const track = trackRef.current
      if (!track) return
      await track.applyConstraints({
        advanced: [{ zoom: value } as MediaTrackConstraintSet],
      })
    } catch (e) {
      console.warn('[BarcodeScanner] zoom apply failed:', e)
    }
  }

  // ============================================
  // TAP TO FOCUS
  // ============================================
  const handleVideoTap = async (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!tapFocusSupported) return

    const video = videoRef.current
    if (!video) return

    const rect = video.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    setTapIndicator({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      visible: true,
    })
    setTimeout(() => {
      setTapIndicator((prev) => ({ ...prev, visible: false }))
    }, 800)

    try {
      const track = trackRef.current
      if (!track) return
      await track.applyConstraints({
        advanced: [
          {
            focusMode: 'single-shot',
            points: [{ x, y }],
          } as MediaTrackConstraintSet,
        ],
      })
    } catch (err) {
      console.warn('[BarcodeScanner] tap-to-focus failed:', err)
    }
  }

  // ============================================
  // CLOSE VIA X — panggil onClose langsung (TIDAK sentuh history)
  // --------------------------------------------
  // Cleanup useEffect di atas akan membersihkan history state
  // jika modal ditutup BUKAN karena popstate.
  // ============================================
  const handleCloseX = () => {
    onCloseRef.current()
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
              onClick={handleCloseX}
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
            onClick={handleVideoTap}
          />

          {/* TAP INDICATOR */}
          {tapIndicator.visible && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: tapIndicator.x - 24,
                top: tapIndicator.y - 24,
                width: 48,
                height: 48,
                border: '2px solid #FACC15',
                borderRadius: 8,
                boxShadow: '0 0 8px rgba(250,204,21,0.6)',
                transition: 'opacity 0.3s ease',
              }}
            />
          )}

          {/* FRAME OVERLAY */}
          {!error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-[75%] max-w-[340px] aspect-[4/3]">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
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
            <div className="absolute bottom-32 left-0 right-0 flex justify-center px-4">
              <div className="px-4 py-2 bg-black/70 backdrop-blur-sm rounded-full text-white text-sm font-mono">
                {lastScanned}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER — Zoom slider + hint */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-6 bg-gradient-to-t from-black/80 to-transparent space-y-3">
          {zoomSupported && (
            <div className="flex items-center gap-3 px-2">
              <span className="text-white/80 text-xs whitespace-nowrap">
                Zoom
              </span>
              <input
                type="range"
                min={zoomMin}
                max={zoomMax}
                step={zoomStep}
                value={zoomValue}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-white/80 text-xs font-mono w-10 text-right">
                {zoomValue.toFixed(1)}x
              </span>
            </div>
          )}

          <p className="text-center text-white/80 text-xs">
            {tapFocusSupported
              ? 'Arahkan kamera ke barcode. Tap layar untuk fokus, atau geser slider zoom.'
              : 'Arahkan kamera ke barcode produk. Setiap scan otomatis menambah ke keranjang.'}
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
