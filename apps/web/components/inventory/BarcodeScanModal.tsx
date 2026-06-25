'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Scan, Camera, CameraOff, Keyboard, X, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { lookupBarcodeAction, type BarcodeLookupResult } from '@/app/(app)/inventory/actions'

// BarcodeDetector is a browser API not yet in TypeScript's lib
declare const BarcodeDetector: {
  new (options?: { formats?: string[] }): {
    detect(image: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<Array<{ rawValue: string }>>
  }
  getSupportedFormats(): Promise<string[]>
}

interface BarcodeScanModalProps {
  open: boolean
  onClose: () => void
  organizationId: string
  /** Called once a barcode is resolved; caller opens the right modal. */
  onResult: (barcode: string, result: BarcodeLookupResult) => void
}

type Mode = 'keyboard' | 'camera'

export default function BarcodeScanModal({
  open, onClose, organizationId, onResult,
}: BarcodeScanModalProps) {
  const [mode, setMode]             = useState<Mode>('keyboard')
  const [barcode, setBarcode]       = useState('')
  const [looking, setLooking]       = useState(false)
  const [cameraErr, setCameraErr]   = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)

  const inputRef    = useRef<HTMLInputElement>(null)
  const videoRef    = useRef<HTMLVideoElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const rafRef      = useRef<number | null>(null)
  const resolvedRef = useRef(false)  // prevent double-firing

  // Auto-focus input when modal opens in keyboard mode
  useEffect(() => {
    if (open && mode === 'keyboard') {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open, mode])

  // Cleanup camera on close
  useEffect(() => {
    if (!open) {
      stopCamera()
      setBarcode('')
      setCameraErr(null)
      setMode('keyboard')
      resolvedRef.current = false
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function stopCamera() {
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }

  async function startCamera() {
    setCameraErr(null)
    try {
      // Check browser support
      if (typeof BarcodeDetector === 'undefined') {
        setCameraErr('Camera scanning is not supported in this browser. Please use a USB scanner or type the barcode.')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraActive(true)
        scanLoop()
      }
    } catch {
      setCameraErr('Camera access denied. Please allow camera access or use a USB scanner.')
    }
  }

  const scanLoop = useCallback(() => {
    const video = videoRef.current
    if (!video || resolvedRef.current) return

    const detect = async () => {
      if (!video || resolvedRef.current) return
      try {
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e', 'qr_code', 'code_39'] })
        const results = await detector.detect(video)
        const first = results[0]
        if (results.length > 0 && first?.rawValue) {
          void handleBarcode(first.rawValue)
          return
        }
      } catch { /* camera not ready yet */ }
      rafRef.current = requestAnimationFrame(detect)
    }
    rafRef.current = requestAnimationFrame(detect)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleBarcode(code: string) {
    if (resolvedRef.current || !code.trim()) return
    resolvedRef.current = true
    stopCamera()
    setLooking(true)
    const result = await lookupBarcodeAction(code.trim(), organizationId)
    setLooking(false)
    if (!result.ok) {
      resolvedRef.current = false
      setCameraErr(result.error.message)
      return
    }
    onClose()
    onResult(code.trim(), result.data)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && barcode.trim()) {
      void handleBarcode(barcode.trim())
    }
  }

  const isCameraSupported = typeof window !== 'undefined' && 'mediaDevices' in navigator

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Scan className="h-5 w-5 text-primary" />
            Scan Barcode
          </DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => { stopCamera(); setMode('keyboard'); setCameraErr(null) }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'keyboard'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/40'
            }`}
          >
            <Keyboard className="h-4 w-4" />
            USB Scanner / Type
          </button>
          {isCameraSupported && (
            <button
              onClick={() => { setMode('camera'); if (!cameraActive) void startCamera() }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                mode === 'camera'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              <Camera className="h-4 w-4" />
              Camera
            </button>
          )}
        </div>

        {/* Keyboard / USB input */}
        {mode === 'keyboard' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Point your USB scanner at a barcode, or type it manually and press{' '}
              <kbd className="rounded border border-border px-1 py-0.5 text-xs font-mono">Enter</kbd>.
            </p>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Scan or type barcode…"
                disabled={looking}
                className="font-mono"
              />
              <Button
                size="sm"
                onClick={() => void handleBarcode(barcode.trim())}
                disabled={looking || !barcode.trim()}
              >
                {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Go'}
              </Button>
            </div>
          </div>
        )}

        {/* Camera view */}
        {mode === 'camera' && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                muted
                playsInline
              />
              {/* Targeting overlay */}
              {cameraActive && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-28 w-56 rounded border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
                </div>
              )}
              {!cameraActive && !cameraErr && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white/60" />
                </div>
              )}
            </div>
            {cameraActive && (
              <p className="text-center text-xs text-muted-foreground">
                Hold barcode steady inside the frame
              </p>
            )}
            {cameraActive && (
              <Button variant="outline" size="sm" className="w-full" onClick={stopCamera}>
                <CameraOff className="mr-2 h-4 w-4" />
                Stop Camera
              </Button>
            )}
          </div>
        )}

        {/* Error / status */}
        {cameraErr && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <X className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{cameraErr}</span>
          </div>
        )}

        {looking && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking up barcode…
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
