import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const logoVideo = '/logo.mp4'

const MESSAGES = [
  'Initializing AI...',
  'Loading Dashboard...',
  'Preparing Career Intelligence...',
  'Analyzing your profile...',
  'Optimizing resume data...',
  'Syncing career insights...',
  'Calibrating AI models...',
  'Indexing skill graphs...',
  'Loading personalized recommendations...',
  'Building your career dashboard...',
  'Connecting to cloud services...',
  'Applying latest updates...',
  'Finalizing setup...',
  'Almost there...',
  'Ready',
]

const easeOut = [0.16, 1, 0.3, 1]

// Background matching the page
const LOADER_BG = '#F2F4F7'

export default function Loader({ show = true, onExitComplete }) {
  const prefersReducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const videoRef = useRef(null)
  const [videoError, setVideoError] = useState(false)

  useEffect(() => {
    if (!show) return
    const id = setInterval(() => {
      setIndex((i) => (i < MESSAGES.length - 1 ? i + 1 : i))
    }, 1100)
    return () => clearInterval(id)
  }, [show])

  // -------- memoised transition --------
  const logoTransition = useMemo(
    () => ({
      duration: prefersReducedMotion ? 0.15 : 0.6,
      ease: easeOut,
    }),
    [prefersReducedMotion]
  )

  return (
    <AnimatePresence mode="wait" onExitComplete={onExitComplete}>
      {show && (
        <motion.div
          key="careershala-loader"
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto select-none overflow-hidden"
          style={{
            background: LOADER_BG,
          }}
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: {
              duration: prefersReducedMotion ? 0.15 : 0.4,
              ease: easeOut,
            },
          }}
        >
          <div className="relative flex flex-col items-center gap-6 px-6 text-center">
            {/* ---------- Animated Logo Video (Bigger wrapper, proportional mask) ---------- */}
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.96,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                scale: 0.95,
              }}
              transition={logoTransition}
              style={{
                overflow: 'hidden',
                width: '480px',
                height: '270px',
                borderRadius: 0,
                lineHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // THE FIX: 'ellipse closest-side' ensures the fade matches the rectangular shape.
                // It goes fully transparent BEFORE it hits the top or bottom edges.
                WebkitMaskImage: 'radial-gradient(ellipse closest-side, black 50%, transparent 90%)',
                maskImage: 'radial-gradient(ellipse closest-side, black 50%, transparent 90%)',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                muted={true}
                loop
                playsInline
                preload="auto"
                src={logoVideo}
                onError={(e) => {
                  console.warn('[Loader] Video failed to load or autoplay:', e)
                  setVideoError(true)
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: videoError ? 'none' : 'block',
                  border: 'none',
                  outline: 'none',
                  borderRadius: 0,
                  boxShadow: 'none',
                  transform: 'scale(1.15)', 
                  transformOrigin: 'center center',
                }}
              >
                <source src={logoVideo} type="video/mp4" />
              </video>
            </motion.div>

            {/* ---------- Brand ---------- */}
            <motion.div
              initial={{
                opacity: 0,
                y: 6,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: prefersReducedMotion ? 0.15 : 0.5,
                delay: prefersReducedMotion ? 0 : 0.15,
                ease: easeOut,
              }}
              className="flex flex-col items-center gap-2 text-center -mt-2"
            >
              <p className="text-[36px] font-bold tracking-tight text-slate-900 leading-none">
                Career<span className="text-[#2E9BDA]">Shala</span>
              </p>

              <p className="text-[13px] font-bold uppercase tracking-[0.15em] text-slate-500">
                AI Career Copilot
              </p>
            </motion.div>

            {/* ---------- Subtitle ---------- */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: prefersReducedMotion ? 0.15 : 0.5,
                delay: prefersReducedMotion ? 0 : 0.3,
                ease: easeOut,
              }}
              className="text-[15px] font-medium text-slate-500 -mt-1"
            >
              Empowering Careers with AI
            </motion.p>

            {/* ---------- Progress Bar ---------- */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: prefersReducedMotion ? 0.15 : 0.4,
                delay: prefersReducedMotion ? 0 : 0.4,
                ease: easeOut,
              }}
              className="w-64 h-[4px] rounded-full bg-black/5 overflow-hidden mt-2"
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#38AEEA] to-[#1d6fa5]"
                initial={{
                  width: '0%',
                }}
                animate={{
                  width: '100%',
                }}
                transition={{
                  duration: prefersReducedMotion ? 0.3 : 28,
                  ease: easeOut,
                }}
              />
            </motion.div>

            {/* ---------- Status ---------- */}
            <div className="h-5 relative w-72 text-center mt-1">
              <AnimatePresence mode="wait">
                <motion.span
                  key={MESSAGES[index]}
                  initial={{
                    opacity: 0,
                    y: 3,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    y: -3,
                  }}
                  transition={{
                    duration: prefersReducedMotion ? 0.1 : 0.25,
                    ease: easeOut,
                  }}
                  className="absolute inset-0 text-[14px] font-medium text-slate-500"
                >
                  {MESSAGES[index]}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}