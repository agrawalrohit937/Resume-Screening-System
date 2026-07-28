import { useEffect, useState } from 'react'

/**
 * Modern High-Contrast ScoreRing
 * Features dynamic gradients, glassmorphism aesthetics, inner indicator accents,
 * performance state badges, and smooth spring-like easing logic.
 *
 * @param {number} score - Value between 0 and 100 (e.g., 82 for 82%).
 *                         Matches the 0-100 scale emitted by the backend ATS engine.
 */
export default function ScoreRing({ score = 0, size = 140, strokeWidth = 10, label = 'ATS Match Score', animated = true }) {
  const [displayScore, setDisplayScore] = useState(0)

  // Calculate precise SVG properties
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  // [BUG-001] score is now 0-100; clamp and use directly as a percentage
  const pct = Math.min(Math.max(Math.round(displayScore), 0), 100)
  const offset = circumference - (pct / 100) * circumference

  // Dynamic spring animation loop
  useEffect(() => {
    if (!animated) {
      setDisplayScore(score)
      return
    }
    const start = Date.now()
    const duration = 1200
    const from = 0
    const to = score
    
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1)
      // Custom swift out, gentle snap-in cubic easing function
      const ease = 1 - Math.pow(1 - t, 4) 
      setDisplayScore(from + (to - from) * ease)
      if (t < 1) requestAnimationFrame(tick)
    }
    
    const timer = setTimeout(() => requestAnimationFrame(tick), 150)
    return () => clearTimeout(timer)
  }, [score, animated])

  // System Theme & Configuration Palette
  const getScoreTheme = (val) => {
    if (val >= 80) return {
      text: 'text-emerald-600',
      track: 'stroke-slate-100',
      gradient: ['#10B981', '#059669'],
      glow: 'rgba(16,185,129,0.14)',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
      status: 'Excellent'
    }
    if (val >= 60) return {
      text: 'text-indigo-600',
      track: 'stroke-slate-100',
      gradient: ['#6366F1', '#4F46E5'],
      glow: 'rgba(99,102,241,0.14)',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
      status: 'Good'
    }
    if (val >= 40) return {
      text: 'text-amber-500',
      track: 'stroke-slate-100',
      gradient: ['#F59E0B', '#D97706'],
      glow: 'rgba(245,158,11,0.14)',
      badge: 'bg-amber-50 text-amber-700 border-amber-200/60',
      status: 'Average'
    }
    return {
      text: 'text-rose-600',
      track: 'stroke-slate-100',
      gradient: ['#F43F5E', '#E11D48'],
      glow: 'rgba(244,63,94,0.14)',
      badge: 'bg-rose-50 text-rose-700 border-rose-200/60',
      status: 'Critical'
    }
  }

  const theme = getScoreTheme(pct)
  const gradId = `ringGradient-${pct}`

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-3xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] w-fit mx-auto select-none">
      
      {/* Outer Visual Container */}
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        
        {/* Layer 1: Radial Depth Glow Backdrop */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-700 ease-out scale-95"
          style={{ background: `radial-gradient(circle, ${theme.glow} 0%, transparent 75%)` }}
        />

        {/* Layer 2: Core Glass Morphic Base plate */}
        <div className="absolute inset-3 rounded-full bg-slate-50/40 border border-slate-100/80 backdrop-blur-[2px] shadow-inner" />

        {/* Layer 3: Main SVG Vector Canvas */}
        <svg width={size} height={size} className="-rotate-90 relative z-10 block">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme.gradient[0]} />
              <stop offset="100%" stopColor={theme.gradient[1]} />
            </linearGradient>
          </defs>

          {/* Clean Track Underlay */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            className={`${theme.track} transition-all duration-500`}
            strokeWidth={strokeWidth - 2}
          />

          {/* Dynamic Active Progress Ring */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-300"
            style={{
              filter: `drop-shadow(0 3px 8px ${theme.gradient[0]}35)`,
            }}
          />
        </svg>

        {/* Center Text Metrics Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-0.5 leading-none">
            Match
          </span>
          <span className={`font-black tracking-tighter leading-none transition-colors duration-500 text-slate-900`} style={{ fontSize: size * 0.22 }}>
            {pct}<span className="text-sm font-bold text-slate-400 ml-0.5">%</span>
          </span>
        </div>
      </div>

      {/* Decorative Details & Status Badge */}
      <div className="mt-4 text-center">
        {label && (
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            {label}
          </p>
        )}
        <span className={`inline-flex items-center text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${theme.badge} shadow-sm transition-all duration-300`}>
          {theme.status}
        </span>
      </div>

    </div>
  )
}