import { createElement } from 'react'
import { motion } from 'framer-motion'
import { Award, Lock } from 'lucide-react'
import Card from '../Card'

const TIER_STYLES = {
  legendary: { medal: 'bg-slate-700', border: 'border-slate-300', text: 'text-slate-700', line: 'bg-slate-300' },
  platinum: { medal: 'bg-slate-600', border: 'border-slate-300', text: 'text-slate-700', line: 'bg-slate-300' },
  gold: { medal: 'bg-amber-500', border: 'border-amber-200', text: 'text-amber-700', line: 'bg-amber-200' },
  silver: { medal: 'bg-slate-700', border: 'border-slate-300', text: 'text-slate-700', line: 'bg-slate-300' },
  bronze: { medal: 'bg-orange-500', border: 'border-orange-200', text: 'text-orange-800', line: 'bg-orange-200' },
}

const TIER_ORDER = ['legendary', 'platinum', 'gold', 'silver', 'bronze']

function BadgeIcon({ badge, earned }) {
  if (!earned) return <Lock className="w-6 h-6 text-slate-400" />
  if (typeof badge.icon === 'function' || (typeof badge.icon === 'object' && badge.icon !== null)) {
    return createElement(badge.icon, { className: 'w-8 h-8 text-white drop-shadow-md' })
  }
  if (typeof badge.icon === 'string' && badge.icon.length > 0) return <span className="text-2xl">{badge.icon}</span>
  return <Award className="w-8 h-8 text-white" />
}

function earnedDate(value) {
  if (!value || typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function Medal({ badge, earnedAt }) {
  const earned = Boolean(earnedAt)
  const style = TIER_STYLES[badge.tier] || TIER_STYLES.bronze
  const date = earnedDate(earnedAt)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -3 }}
      className={`flex flex-col items-center text-center rounded-2xl p-3 sm:p-4 ${
        earned ? 'bg-white border border-slate-200 hover:shadow-md' : 'bg-slate-50/70 border border-slate-200'
      }`}
    >
      <div className="relative mb-3">
        <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center border-4 ${
          earned
            ? `${style.medal} ${style.border} shadow-md`
            : 'bg-slate-100 border-white shadow-inner grayscale opacity-75'
        }`}>
          <BadgeIcon badge={badge} earned={earned} />
        </div>
        {earned && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
            <span className="text-white text-[10px] font-black">✓</span>
          </span>
        )}
      </div>

      <p className={`text-xs sm:text-[13px] font-black leading-tight ${earned ? 'text-slate-800' : 'text-slate-400'}`}>
        {badge.name}
      </p>
      <p className="text-[10px] sm:text-[11px] text-slate-500 leading-relaxed mt-1.5 min-h-8 line-clamp-2">
        {badge.description}
      </p>
      {earned ? (
        date && <span className="mt-2 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">{date}</span>
      ) : (
        <span className="mt-2 text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">+{badge.points || 0} XP</span>
      )}
    </motion.div>
  )
}

export default function AchievementVault({ catalog = [], earnedBadges = [] }) {
  const earnedMap = new Map(earnedBadges.map((badge) => [badge.id, badge.earned_at || true]))
  const earnedCount = catalog.filter((badge) => earnedMap.has(badge.id)).length
  const percentage = catalog.length ? Math.round((earnedCount / catalog.length) * 100) : 0

  return (
    <Card className="p-0 overflow-hidden border-0 shadow-sm rounded-3xl bg-white">
      <div className="p-5 sm:p-8 border-b border-slate-100 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-xl sm:text-2xl font-extrabold text-slate-800">
              <Award className="w-6 h-6 text-blue-600" /> Achievement Vault
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">Your milestones from interview practice.</p>
          </div>
          <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-3 py-2">
            <div>
              <p className="text-xl font-black text-slate-800">{earnedCount}<span className="text-sm text-slate-400">/{catalog.length}</span></p>
              <p className="text-[9px] font-black uppercase tracking-wider text-blue-600">Unlocked</p>
            </div>
            <div className="relative w-10 h-10">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${percentage}, 100`} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-slate-700">{percentage}%</span>
            </div>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mt-5">
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${percentage}%` }} />
        </div>
      </div>

      <div className="p-4 sm:p-8">
        {catalog.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">No achievements available yet.</div>
        ) : (
          <div className="space-y-8">
            {TIER_ORDER.map((tier) => {
              const badges = catalog.filter((badge) => badge.tier === tier)
              if (!badges.length) return null
              const style = TIER_STYLES[tier]
              return (
                <section key={tier}>
                  <div className="flex items-center gap-3 mb-4">
                    <h4 className={`text-xs font-black uppercase tracking-[0.18em] ${style.text}`}>{tier} Tier</h4>
                    <div className={`h-px flex-1 ${style.line}`} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {badges.map((badge) => <Medal key={badge.id} badge={badge} earnedAt={earnedMap.get(badge.id)} />)}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}
