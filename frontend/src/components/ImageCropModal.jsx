import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Move, Sparkles } from 'lucide-react'

export default function ImageCropModal({ isOpen, imageSrc, onClose, onCropComplete, isUploading = false }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const imageRef = useRef(null)
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 })

  // Reset transform when new image is loaded
  useEffect(() => {
    if (imageSrc) {
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
  }, [imageSrc])

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target
    setImgNaturalSize({ width: naturalWidth, height: naturalHeight })
    // If the image is tall (portrait), shift the pan slightly down so the face (upper region) is centered
    if (naturalHeight > naturalWidth) {
      const ratio = naturalHeight / naturalWidth
      if (ratio > 1.2) {
        setPan({ x: 0, y: Math.min(30, (ratio - 1) * 25) })
      }
    }
  }

  // Pointer drag events for mouse & touch
  const handlePointerDown = (e) => {
    setIsDragging(true)
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0
    dragStartRef.current = { x: clientX - pan.x, y: clientY - pan.y }
  }

  const handlePointerMove = useCallback((e) => {
    if (!isDragging) return
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0
    setPan({
      x: clientX - dragStartRef.current.x,
      y: clientY - dragStartRef.current.y,
    })
  }, [isDragging])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      return () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
      }
    }
  }, [isDragging, handlePointerMove, handlePointerUp])

  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleConfirmCrop = async () => {
    if (!imageRef.current) return

    const canvas = document.createElement('canvas')
    const outputSize = 512 // 512x512 high-resolution square avatar
    canvas.width = outputSize
    canvas.height = outputSize
    const ctx = canvas.getContext('2d')

    if (!ctx) return

    const img = imageRef.current
    const nw = img.naturalWidth || outputSize
    const nh = img.naturalHeight || outputSize

    // Preview circle diameter is 240px
    const previewDiameter = 240
    const scaleFactor = outputSize / previewDiameter

    // Calculate base rendering dimensions (cover mode)
    const aspect = nw / nh
    let baseW, baseH
    if (aspect > 1) {
      baseH = previewDiameter
      baseW = previewDiameter * aspect
    } else {
      baseW = previewDiameter
      baseH = previewDiameter / aspect
    }

    const scaledW = baseW * zoom * scaleFactor
    const scaledH = baseH * zoom * scaleFactor

    const drawX = (outputSize - scaledW) / 2 + (pan.x * scaleFactor)
    const drawY = (outputSize - scaledH) / 2 + (pan.y * scaleFactor)

    // Clear and draw image
    ctx.clearRect(0, 0, outputSize, outputSize)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, drawX, drawY, scaledW, scaledH)

    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], 'profile_avatar.jpg', { type: 'image/jpeg' })
      onCropComplete(file)
    }, 'image/jpeg', 0.92)
  }

  return (
    <AnimatePresence>
      {Boolean(isOpen && imageSrc) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Adjust Profile Photo</h3>
                <p className="text-xs text-slate-500">Drag to position, zoom to fit your face perfectly</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Interactive Crop Viewport */}
          <div className="relative flex flex-col items-center justify-center p-6 bg-slate-900 select-none overflow-hidden min-h-[300px]">
            {/* Circular Mask Viewport */}
            <div
              className="relative w-[240px] h-[240px] rounded-full overflow-hidden shadow-2xl ring-4 ring-indigo-500/80 cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={handlePointerDown}
            >
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop preview"
                onLoad={handleImageLoad}
                draggable={false}
                className="absolute max-w-none pointer-events-none transition-transform duration-75 ease-out select-none"
                style={{
                  width: imgNaturalSize.width && imgNaturalSize.height
                    ? (imgNaturalSize.width >= imgNaturalSize.height ? 'auto' : '100%')
                    : '100%',
                  height: imgNaturalSize.width && imgNaturalSize.height
                    ? (imgNaturalSize.width >= imgNaturalSize.height ? '100%' : 'auto')
                    : '100%',
                  transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
                  left: '50%',
                  top: '50%',
                  transformOrigin: 'center center',
                }}
              />
              {/* Subtle crosshair guide */}
              <div className="absolute inset-0 pointer-events-none rounded-full border border-white/20" />
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <Move size={12} />
              <span>Drag to move • Scroll or slider to zoom</span>
            </div>
          </div>

          {/* Controls */}
          <div className="p-5 space-y-4 bg-white">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom(z => Math.max(1, +(z - 0.15).toFixed(2)))}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>

              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />

              <button
                type="button"
                onClick={() => setZoom(z => Math.min(3, +(z + 0.15).toFixed(2)))}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                title="Reset Position"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCrop}
                disabled={isUploading}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} strokeWidth={2.5} />
                    <span>Save Photo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

