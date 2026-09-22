import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Github, Star, GitFork, Users, ExternalLink, AlertCircle, Loader2 } from 'lucide-react'
import { analyzeGitHub } from '../../services/api'
export { getCandidateHeadline, getCandidateEducation } from './CandidateHoverCard'

/* ── Common Language Colors ─────────────────────────────────── */
const LANG_COLORS = {
  Python: '#3572A5',
  JavaScript: '#F7DF1E',
  TypeScript: '#2B7489',
  Go: '#00ADD8',
  Rust: '#DEA584',
  Java: '#B07219',
  Ruby: '#701516',
  'C++': '#F34B7D',
  'C#': '#178600',
  Swift: '#FA7343',
  Kotlin: '#A97BFF',
  Shell: '#89E051',
  CSS: '#563D7C',
  HTML: '#E34C26',
  PHP: '#4F5D95',
  C: '#555555',
  Vue: '#41B883',
  Dart: '#00B4AB',
  Scala: '#C22D40',
  SQL: '#C46633'
}

const pct = (v) => Math.round((v || 0) * 100)

/* ── Positioning Hook with Window Boundaries ─────────────────── */
function useTooltipPosition(triggerRef, open) {
  const [pos, setPos] = useState({ x: 0, y: 0, showAbove: true })

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return

    const updatePosition = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const tooltipWidth = 300
      const tooltipHeight = 220
      const margin = 12

      let left = rect.left + rect.width / 2 - tooltipWidth / 2
      let showAbove = true

      // Horizontal boundary clamping
      if (left < margin) left = margin
      if (left + tooltipWidth > window.innerWidth - margin) {
        left = window.innerWidth - tooltipWidth - margin
      }

      // Vertical placement
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
 * Compact, light-themed GitHub Hover Card.
 * Displays candidate GitHub profile metrics, top languages, and top repo in a clean, small card.
 */
export default function GithubHoverCard({
  username,
  children,
  className = '',
  style
}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const timer = useRef(null)
  const triggerRef = useRef(null)
  const pos = useTooltipPosition(triggerRef, open)

  const cleanUser = typeof username === 'string' ? username.trim().replace(/^@/, '') : ''

  const load = useCallback(async () => {
    if (data || loading || !cleanUser) return
    setLoading(true)
    try {
      const res = await analyzeGitHub({ username: cleanUser })
      setData(res.data?.data || res.data || res)
    } catch {
      setData({ err: true })
    } finally {
      setLoading(false)
    }
  }, [data, loading, cleanUser])

  const handleMouseEnter = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setOpen(true)
      load()
    }, 120)
  }

  const handleMouseLeave = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(false), 180)
  }

  if (!cleanUser) {
    return children ? <>{children}</> : null
  }

  const profile = data?.profile || {}
  const langs = Object.entries(data?.languages || {}).slice(0, 3)
  const topRepos = (data?.top_repositories || []).slice(0, 1)
  const totalStars = data?.total_stars ?? topRepos.reduce((s, r) => s + (r.stars || 0), 0)
  const score = data?.contribution_score != null ? pct(data.contribution_score) : null

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`inline-flex items-center ${className}`}
        style={style}
      >
        {children || (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 hover:bg-slate-200/70 border border-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer">
            <Github size={13} className="text-slate-600" />
            <span>@{cleanUser}</span>
          </span>
        )}
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
                onMouseLeave={handleMouseLeave}
                className="fixed z-[10000] w-[300px] bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-900/10 p-3.5 select-none pointer-events-auto"
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                }}
              >
                {loading && !data ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Loader2 size={20} className="animate-spin text-indigo-600" />
                    <span className="text-xs font-medium">Analyzing @{cleanUser}...</span>
                  </div>
                ) : data?.err ? (
                  <div className="py-4 px-2 text-center">
                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                      <AlertCircle size={14} />
                      <span>Profile preview unavailable</span>
                    </div>
                    <a
                      href={`https://github.com/${cleanUser}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:underline"
                    >
                      <span>View GitHub Profile</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                ) : data ? (
                  <div className="space-y-2.5">
                    {/* Header: Avatar, Name, Username & Score */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        {profile.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
                            <Github size={18} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {profile.name || cleanUser}
                          </h4>
                          {score != null && (
                            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded shrink-0">
                              {score}%
                            </span>
                          )}
                        </div>
                        <a
                          href={`https://github.com/${cleanUser}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 transition truncate"
                        >
                          <span>@{cleanUser}</span>
                          <ExternalLink size={10} className="text-slate-400 shrink-0" />
                        </a>
                      </div>
                    </div>

                    {/* Bio (if available) */}
                    {profile.bio && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {profile.bio}
                      </p>
                    )}

                    {/* Stats Row */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/70 text-[10.5px] font-semibold text-slate-600">
                        <Star size={11} className="text-amber-500 fill-amber-400" />
                        <span>{totalStars}</span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/70 text-[10.5px] font-semibold text-slate-600">
                        <GitFork size={11} className="text-indigo-500" />
                        <span>{profile.public_repos || 0} repos</span>
                      </span>

                      {profile.followers != null && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/70 text-[10.5px] font-semibold text-slate-600">
                          <Users size={11} className="text-slate-400" />
                          <span>{profile.followers}</span>
                        </span>
                      )}
                    </div>

                    {/* Top Languages */}
                    {langs.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-0.5">
                          Top:
                        </span>
                        {langs.map(([lang]) => (
                          <span
                            key={lang}
                            className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-600 bg-slate-50 px-1.5 py-0.2 rounded border border-slate-200/50"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: LANG_COLORS[lang] || '#6366F1' }}
                            />
                            <span>{lang}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Top Repository */}
                    {topRepos.length > 0 && topRepos[0] && (
                      <div className="pt-1.5 border-t border-slate-100">
                        <a
                          href={topRepos[0].url || `https://github.com/${cleanUser}/${topRepos[0].name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-1.5 rounded-lg bg-slate-50/70 hover:bg-indigo-50/50 border border-slate-200/70 hover:border-indigo-200 transition group"
                        >
                          <div className="flex items-center justify-between gap-1 text-[11px]">
                            <span className="font-bold text-slate-800 group-hover:text-indigo-600 truncate">
                              ★ {topRepos[0].name}
                            </span>
                            <span className="font-mono text-[10px] text-amber-600 font-bold shrink-0">
                              {topRepos[0].stars || 0}★
                            </span>
                          </div>
                          {topRepos[0].description && (
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {topRepos[0].description}
                            </p>
                          )}
                        </a>
                      </div>
                    )}
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}
