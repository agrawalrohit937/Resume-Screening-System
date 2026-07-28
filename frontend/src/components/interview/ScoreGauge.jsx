import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

// TODO: consumers currently pass maxScore=10 (FeedbackCard) or leave it at 100
// (InterviewReport). Both are supported — the gauge normalizes internally.
export default function ScoreGauge({ score = 0, maxScore = 10, size = 160, label = 'Score', showGrade = true }) {
  const [animated, setAnimated] = useState(0)
  const radius = size / 2 - 14
  const circumference = 2 * Math.PI * radius
  const arcLength = (240 / 360) * circumference
  const pct = maxScore ? Math.round((animated / maxScore) * 100) : 0
  const offset = arcLength - (animated / (maxScore || 1)) * arcLength

  useEffect(() => {
    const t = setTimeout(() => {
      const start = Date.now()
      const duration = 1400
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1)
        const ease = 1 - Math.pow(1 - p, 4)
        setAnimated(parseFloat((score * ease).toFixed(2)))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, 200)
    return () => clearTimeout(t)
  }, [score])

  const palette = (p) => {
    if (p >= 80) return { stroke: '#10B981', text: '#059669', bg: '#ECFDF5', ring: 'rgba(16,185,129,0.18)' }
    if (p >= 60) return { stroke: '#2E9BDA', text: '#1d6fa5', bg: '#EFF6FF', ring: 'rgba(46,155,218,0.18)' }
    if (p >= 40) return { stroke: '#F59E0B', text: '#B45309', bg: '#FFFBEB', ring: 'rgba(245,158,11,0.18)' }
    return { stroke: '#F43F5E', text: '#BE123C', bg: '#FFF1F2', ring: 'rgba(244,63,94,0.18)' }
  }
  const grade = (p) => (p >= 95 ? 'A+' : p >= 90 ? 'A' : p >= 80 ? 'B+' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : 'F')
  const c = palette(pct)

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(150deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEF2F7" strokeWidth={10} strokeLinecap="round" strokeDasharray={`${arcLength} ${circumference}`} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={c.stroke} strokeWidth={10} strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.05s linear, stroke 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pb-3">
          <span className="font-extrabold tabular-nums leading-none" style={{ fontSize: size * 0.24, color: c.text }}>
            {maxScore === 10 ? animated.toFixed(1) : Math.round(animated)}
          </span>
          <span className="text-[11px] text-blue-900/35 font-bold uppercase tracking-wider mt-0.5">/ {maxScore}</span>
          {showGrade && (
            <span className="mt-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-extrabold" style={{ background: c.bg, color: c.text }}>
              {grade(pct)}
            </span>
          )}
        </div>
      </div>
      {label && <p className="text-[11px] font-bold text-blue-900/40 uppercase tracking-wider">{label}</p>}
    </div>
  )
}