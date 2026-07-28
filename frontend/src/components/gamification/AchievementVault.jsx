import { motion } from 'framer-motion'
import { Lock, Award, Sparkles } from 'lucide-react'
import Card from './Card'

// ─── Premium Tier Styles ────────────────────────────────────────────────────
const TIER_STYLES = {
  legendary: { 
    gradient: 'from-fuchsia-500 via-purple-600 to-indigo-600', 
    border: 'border-purple-300',
    shadow: 'shadow-purple-400/50 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.2)]', 
    text: 'text-purple-700',
    bgLight: 'bg-purple-50',
    glow: 'shadow-[0_0_15px_rgba(168,85,247,0.4)]'
  },
  platinum: { 
    gradient: 'from-cyan-400 to-blue-500', 
    border: 'border-blue-200',
    shadow: 'shadow-blue-400/50 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.2)]', 
    text: 'text-blue-700',
    bgLight: 'bg-blue-50',
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.4)]'
  },
  gold: { 
    gradient: 'from-amber-300 to-orange-500', 
    border: 'border-yellow-200',
    shadow: 'shadow-orange-300/50 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.2)]', 
    text: 'text-orange-700',
    bgLight: 'bg-orange-50',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]'
  },
  silver: { 
    gradient: 'from-slate-300 to-slate-400', 
    border: 'border-slate-200',
    shadow: 'shadow-slate-300/50 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.2)]', 
    text: 'text-slate-600',
    bgLight: 'bg-slate-50',
    glow: 'shadow-md'
  },
  bronze: { 
    gradient: 'from-orange-300 to-red-400', 
    border: 'border-orange-200',
    shadow: 'shadow-red-300/50 shadow-[inset_0_-4px_6px_rgba(0,0,0,0.2)]', 
    text: 'text-red-700',
    bgLight: 'bg-red-50',
    glow: 'shadow-md'
  },
}

const TIER_ORDER = ['legendary', 'platinum', 'gold', 'silver', 'bronze']

function BadgeIcon({ icon, className }) {
  if (typeof icon === 'function') {
    const Icon = icon
    return <Icon className={className} />
  }
  if (typeof icon === 'string' && icon.length > 0) {
    return <span className="text-xl leading-none drop-shadow-sm">{icon}</span>
  }
  return <Award className={className} />
}

function Medal({ badge, earnedAt, index }) {
  const earned = Boolean(earnedAt)
  const style = TIER_STYLES[badge.tier] || TIER_STYLES.bronze

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.8 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', bounce: 0.5 } }
      }}
      whileHover={{ y: -6, scale: 1.05 }}
      className={`flex flex-col items-center text-center p-3 rounded-2xl transition-colors duration-300 ${earned ? `hover:${style.bgLight}` : 'hover:bg-slate-50'}`}
    >
      {/* 3D Medal Container */}
      <div className="relative mb-3">
        {earned && badge.tier === 'legendary' && (
           <Sparkles className="absolute -top-3 -right-3 w-6 h-6 text-yellow-400 animate-pulse z-20" />
        )}
        <div
          className={`relative w-16 h-16 rounded-full flex items-center justify-center border-4 z-10 transition-all duration-300 ${
            earned 
              ? `bg-gradient-to-br ${style.gradient} ${style.border} ${style.shadow} ${style.glow}` 
              : 'bg-slate-100 border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] shadow-sm grayscale opacity-80'
          }`}
        >
          {earned ? (
            <BadgeIcon icon={badge.icon} className="w-7 h-7 text-white drop-shadow-md" />
          ) : (
            <Lock className="w-5 h-5 text-slate-300" />
          )}
        </div>
      </div>

      {/* Badge Info */}
      <div className="max-w-[100px] w-full flex flex-col items-center">
        <p className={`text-[12px] font-extrabold leading-tight ${earned ? 'text-slate-800' : 'text-slate-400'}`}>
          {badge.name}
        </p>
        <p className="text-[10px] font-medium text-slate-400 leading-snug mt-1 line-clamp-2 h-7">
          {badge.description}
        </p>
        
        {earned ? (
          typeof earnedAt === 'string' && (
            <span className="mt-1.5 inline-block text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              {new Date(earnedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )
        ) : (
          <span className="mt-1.5 inline-block text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
            +{badge.points} XP
          </span>
        )}
      </div>
    </motion.div>
  )
}

export default function AchievementVault({ catalog = [], earnedBadges = [] }) {
  const earnedMap = new Map(earnedBadges.map((b) => [b.id, b.earned_at || true]))
  const total = catalog.length
  const pct = total ? Math.round((earnedMap.size / total) * 100) : 0

  return (
    <Card className="p-0 overflow-hidden border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl bg-white">
      
      {/* Premium Header */}
      <div className="p-6 sm:p-8 border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-2xl text-slate-800 tracking-tight flex items-center gap-2">
              Achievement Vault
            </h3>
            <p className="text-sm font-medium text-slate-500 mt-1">Badges you've earned across your journey</p>
          </div>
          <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
            <div className="text-right">
              <p className="font-extrabold text-2xl text-slate-800 leading-none">
                {earnedMap.size} <span className="text-sm text-slate-400">/ {total}</span>
              </p>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">Collected</p>
            </div>
            {/* Circular Progress Indicator */}
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                <motion.path 
                  initial={{ strokeDasharray: "0, 100" }}
                  whileInView={{ strokeDasharray: `${pct}, 100` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="text-blue-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" 
                />
              </svg>
              <span className="absolute text-[10px] font-extrabold text-slate-700">{pct}%</span>
            </div>
          </div>
        </div>

        {/* Thick Glowing Progress Bar */}
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden mt-6 shadow-inner relative">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] relative"
          >
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
          </motion.div>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {total === 0 ? (
          <div className="text-center py-12">
             <div className="w-20 h-20 mx-auto bg-slate-50 rounded-full flex items-center justify-center mb-4 border-2 border-slate-100 shadow-inner">
               <Award className="w-10 h-10 text-slate-300" />
             </div>
             <p className="text-base font-extrabold text-slate-700">Vault is Empty</p>
             <p className="text-sm font-medium text-slate-500 mt-1">Badges aren't available yet. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {TIER_ORDER.map((tier) => {
              const tierBadges = catalog.filter((b) => b.tier === tier)
              if (!tierBadges.length) return null
              
              const tierStyle = TIER_STYLES[tier]

              return (
                <div key={tier} className="relative">
                  {/* Tier Divider / Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <h4 className={`text-xs font-black uppercase tracking-widest ${tierStyle.text} bg-white px-1 relative z-10`}>
                      {tier} Tier
                    </h4>
                    <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
                  </div>
                  
                  {/* Staggered Grid */}
                  <motion.div 
                    initial="hidden" 
                    whileInView="visible" 
                    viewport={{ once: true, margin: "-50px" }}
                    variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-8 gap-x-4"
                  >
                    {tierBadges.map((badge, i) => (
                      <Medal key={badge.id} badge={badge} earnedAt={earnedMap.get(badge.id)} index={i} />
                    ))}
                  </motion.div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}