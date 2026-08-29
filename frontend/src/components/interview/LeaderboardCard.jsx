import { useState } from 'react'
import { motion } from 'framer-motion'
import { resolveAvatarUrl } from '../../utils/avatarUtils'

// ── LeaderboardCard ─────────────────────────────────────────────────────────
export function LeaderboardCard({ entry, currentUserId, index }) {
  const [imgError, setImgError] = useState(false)
  const isMe = entry.user_id === currentUserId
  const RANK_STYLES = {
    1: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-400 text-white', icon: '🥇' },
    2: { bg: 'bg-slate-50 border-slate-200', badge: 'bg-slate-400 text-white', icon: '🥈' },
    3: { bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-400 text-white', icon: '🥉' },
  }
  const rankStyle = RANK_STYLES[entry.rank] || { bg: 'bg-white border-blue-100', badge: 'bg-blue-100 text-blue-900/60', icon: '' }

  const displayName = isMe ? 'You' : entry.full_name ? entry.full_name : `Top Player #${entry.rank}`
  const initials = entry.full_name ? entry.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() : entry.level_info?.icon || '🌱'
  const avatarUrl = resolveAvatarUrl(entry)

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}
      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 ${rankStyle.bg} ${isMe ? 'ring-2 ring-[#2E9BDA]/40 ring-offset-1' : 'hover:shadow-sm'}`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-[13px] shrink-0 ${rankStyle.badge}`}>
        {entry.rank <= 3 ? rankStyle.icon : `#${entry.rank}`}
      </div>

      <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-[#2E9BDA] to-[#1d6fa5] flex items-center justify-center text-white font-extrabold text-[13px] shrink-0 shadow-sm">
        {avatarUrl && !imgError ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : (
          initials
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-[13.5px] text-blue-950 truncate">{displayName}</p>
          {isMe && <span className="text-[10px] bg-[#2E9BDA]/10 text-[#1d6fa5] px-2 py-0.5 rounded-full font-mono font-bold">YOU</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[11.5px] text-blue-900/45 font-medium">{entry.level_info?.name}</span>
          {entry.current_streak > 0 && <span className="text-[11.5px] text-amber-600 font-mono font-semibold">🔥 {entry.current_streak}d</span>}
          <span className="text-[11.5px] text-blue-900/35 font-mono">{entry.total_interviews} interviews</span>
        </div>
        <div className="mt-1.5 h-1 bg-blue-50 rounded-full overflow-hidden w-24">
          <div className="h-full bg-[#2E9BDA] rounded-full" style={{ width: `${entry.level_info?.progress_pct || 0}%` }} />
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="font-extrabold text-[#1d6fa5] font-mono text-[15px] tabular-nums">{entry.total_points?.toLocaleString?.() ?? entry.total_points}</p>
        <p className="text-[10px] text-blue-900/35 font-mono font-semibold">points</p>
        {entry.top_badge && <span className="text-base">{entry.top_badge.icon}</span>}
      </div>
    </motion.div>
  )
}

// ── InterviewCard ───────────────────────────────────────────────────────────
export function InterviewCard({ interview, onStart, index }) {
  const diff = interview.difficulty || 'medium'
  const DIFF = {
    easy: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    medium: 'text-[#1d6fa5] bg-[#2E9BDA]/10 border-[#2E9BDA]/25',
    hard: 'text-rose-700 bg-rose-50 border-rose-200',
  }[diff]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white rounded-2xl border border-blue-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden group"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold text-blue-950 text-[15px] leading-snug">{interview.job_title}</h3>
            <p className="text-[11.5px] text-blue-900/40 font-mono mt-0.5">{interview.total_questions} questions · ~{interview.estimated_duration_minutes}min</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold font-mono capitalize ${DIFF}`}>{diff}</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {(interview.candidate_skills || []).slice(0, 4).map((sk) => (
            <span key={sk} className="px-2 py-0.5 rounded-lg bg-slate-50 border border-blue-100 text-blue-900/55 text-[11px] font-mono">{sk}</span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {['technical', 'behavioral', 'situational'].map((t) => {
            const count = (interview.questions || []).filter((q) => q.type === t).length
            if (!count) return null
            return (
              <span key={t} className="text-[11px] font-mono text-blue-900/45 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: t === 'technical' ? '#2E9BDA' : t === 'behavioral' ? '#10B981' : '#F59E0B' }} />
                {count} {t.slice(0, 4)}
              </span>
            )
          })}
        </div>
      </div>

      <div className="px-5 pb-5">
        <button
          onClick={() => onStart(interview)}
          className="w-full py-2.5 rounded-xl font-bold text-[13px] text-white transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] shadow-md shadow-[#2E9BDA]/25"
        >
          Start Interview →
        </button>
      </div>
    </motion.div>
  )
}

// ── BadgeCard ───────────────────────────────────────────────────────────────
export function BadgeCard({ badge, earned = false, earnedAt }) {
  const TIERS = {
    bronze: 'from-amber-700 to-amber-500',
    silver: 'from-slate-500 to-slate-400',
    gold: 'from-yellow-500 to-amber-400',
    platinum: 'from-cyan-500 to-sky-400',
    legendary: 'from-purple-600 to-indigo-500',
  }
  const gradient = TIERS[badge.tier] || TIERS.bronze

  return (
    <motion.div
      whileHover={{ scale: earned ? 1.04 : 1 }}
      className={`relative p-4 rounded-2xl border text-center transition-all duration-200 ${earned ? 'bg-white border-[#2E9BDA]/25 shadow-sm cursor-default' : 'bg-slate-50 border-blue-100 opacity-50'}`}
    >
      {earned && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
          <span className="text-white text-[10px]">✓</span>
        </div>
      )}
      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mx-auto mb-3 text-2xl shadow-sm ${!earned ? 'grayscale' : ''}`}>{badge.icon}</div>
      <p className="font-bold text-blue-950 text-[13.5px] leading-tight mb-1">{badge.name}</p>
      <p className="text-[11.5px] text-blue-900/45 leading-snug mb-2 font-medium">{badge.description}</p>
      <div className="flex items-center justify-center gap-1">
        <span className="text-[12px] font-mono font-extrabold text-[#1d6fa5]">+{badge.points}</span>
        <span className="text-[11px] text-blue-900/35 font-mono">pts</span>
      </div>
      {earned && earnedAt && <p className="text-[10px] text-blue-900/30 font-mono mt-1">{new Date(earnedAt).toLocaleDateString()}</p>}
    </motion.div>
  )
}