import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const logoAsset = '/logo_t.webp'

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

  useEffect(() => {
    if (!show) return
    const id = setInterval(() => {
      setIndex((i) => (i < MESSAGES.length - 1 ? i + 1 : i))
    }, 700)
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
            {/* ---------- Animated Logo Aura & Asset ---------- */}
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.9,
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
              className="relative flex items-center justify-center w-36 h-36 my-2"
            >
              {/* Pulsing ambient background glow ring */}
              <motion.div
                animate={
                  prefersReducedMotion
                    ? {}
                    : {
                        scale: [1, 1.15, 1],
                        opacity: [0.3, 0.6, 0.3],
                      }
                }
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#2E9BDA]/30 via-[#38AEEA]/20 to-indigo-500/30 blur-2xl pointer-events-none"
              />

              {/* Rotating glowing accent border */}
              <motion.div
                animate={prefersReducedMotion ? {} : { rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border border-dashed border-[#2E9BDA]/40 pointer-events-none"
              />

              {/* Crisp Logo Image */}
              <img
                src={logoAsset}
                alt="CareerShala Logo"
                width={88}
                height={88}
                decoding="async"
                loading="eager"
                className="relative z-10 w-22 h-22 object-contain filter drop-shadow-md"
              />
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