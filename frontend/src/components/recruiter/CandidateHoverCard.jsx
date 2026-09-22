import { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Briefcase, GraduationCap, User } from 'lucide-react'

/**
 * Extracts a concise professional headline for the candidate.
 * E.g., "Python Developer at TechCorp" or "Senior Frontend Engineer"
 */
export function getCandidateHeadline(candidate, app) {
  const c = candidate || app?.candidate || app
  if (c?.headline?.trim()) return c.headline.trim()

  const work = c?.work_experience || app?.candidate?.work_experience
  if (Array.isArray(work) && work.length > 0) {
    const latest = work[0]
    if (latest.title && latest.company) {
      return `${latest.title} at ${latest.company}`
    }
    if (latest.title) return latest.title
  }

  if (c?.title?.trim()) return c.title.trim()

  if (c?.skills && Array.isArray(c.skills) && c.skills.length > 0) {
    return `${c.skills.slice(0, 2).join(' / ')} Developer`
  }

  return 'Software Professional'
}

/**
 * Extracts latest education details.
 * E.g., "B.Tech Computer Science, Stanford University"
 */
export function getCandidateEducation(candidate, app) {
  const c = candidate || app?.candidate || app
  const eduList = c?.education || app?.candidate?.education
  if (Array.isArray(eduList) && eduList.length > 0) {
    const latest = eduList[0]
    const deg = latest.degree || latest.field_of_study || ''
    const inst = latest.institution || ''
    const year = latest.end_year ? ` (${latest.end_year})` : ''
    if (deg && inst) return `${deg}, ${inst}${year}`
    if (deg) return `${deg}${year}`
    if (inst) return `${inst}${year}`
  }
  return null
}

/**
 * Calculates optimal viewport position for the portal tooltip.
 */
function useTooltipPosition(triggerRef, open) {
  const [pos, setPos] = useState({ x: 0, y: 0, showAbove: true })

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return

    const updatePosition = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const tooltipWidth = 260
      const tooltipHeight = 100
      const margin = 12

      let left = rect.left + rect.width / 2 - tooltipWidth / 2
      let showAbove = true

      // Horizontal boundaries
      if (left < margin) left = margin
      if (left + tooltipWidth > window.innerWidth - margin) {
        left = window.innerWidth - tooltipWidth - margin
      }

      // Vertical placement (prefer above, flip to below if tight)
      let top = rect.top - tooltipHeight - 8
      if (top < margin) {
        top = rect.bottom + 8
        showAbove = false
      }

      setPos({ x: left, y: top, showAbove })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, triggerRef])

  return pos
}

/**
 * Compact, light-themed candidate preview hover pop-over.
 * Displays candidate headline and latest education in a clean, professional card.
 */
export default function CandidateHoverCard({
  candidate,
  app,
  headline: customHeadline,
  education: customEducation,
  children,
  className = '',
  style,
}) {
  const [open, setOpen] = useState(false)
  const timer = useRef(null)
  const triggerRef = useRef(null)
  const pos = useTooltipPosition(triggerRef, open)

  const headline = customHeadline || getCandidateHeadline(candidate, app)
  const education = customEducation || getCandidateEducation(candidate, app)
  const candidateName = app?.candidate_name || candidate?.name

  const handleMouseEnter = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), 120)
  }

  const handleMouseLeave = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), 150)
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`inline-flex items-center ${className}`}
        style={style}
      >
        {children}
      </span>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: pos.showAbove ? 4 : -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: pos.showAbove ? 4 : -4, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                onMouseEnter={() => clearTimeout(timer.current)}
                onMouseLeave={() => setOpen(false)}
                className="fixed z-[9999] pointer-events-none"
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  width: '260px',
                }}
              >
                <div className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-lg shadow-slate-900/5 text-left space-y-2 backdrop-blur-xs">
                  {candidateName && (
                    <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
                      <div className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <User size={10} />
                      </div>
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {candidateName}
                      </span>
                    </div>
                  )}

                  {/* Headline */}
                  <div className="flex items-start gap-2">
                    <Briefcase size={12} className="text-indigo-500 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[11.5px] font-semibold text-slate-700 leading-snug line-clamp-2">
                        {headline}
                      </span>
                    </div>
                  </div>

                  {/* Education */}
                  {education && (
                    <div className="flex items-start gap-2 pt-1 border-t border-slate-50">
                      <GraduationCap size={12} className="text-violet-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-medium text-slate-500 leading-snug line-clamp-2">
                          {education}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}
