import React from 'react'
import { motion } from 'framer-motion'
import { Lock, Award, Sparkles, Star } from 'lucide-react'
import Card from './Card'

// ─── Premium Tier Styles ────────────────────────────────────────────────────
const TIER_STYLES = {
  legendary: { 
    gradient: 'from-fuchsia-600 via-purple-600 to-indigo-700',
    innerGradient: 'from-fuchsia-400 to-indigo-500', 
    border: 'border-fuchsia-300',
    ring: 'ring-4 ring-fuchsia-500/30',
    shadow: 'shadow-[0_10px_40px_-10px_rgba(168,85,247,0.8)] shadow-[inset_0_-4px_8px_rgba(0,0,0,0.4)]', 
    text: 'text-purple-700',
    bgLight: 'bg-fuchsia-50/50',
  },
  platinum: { 
    gradient: 'from-cyan-300 via-blue-500 to-blue-700',
    innerGradient: 'from-cyan-200 to-blue-400', 
    border: 'border-cyan-100',
    ring: 'ring-4 ring-cyan-500/30',
    shadow: 'shadow-[0_10px_30px_-10px_rgba(6,182,212,0.8)] shadow-[inset_0_-4px_8px_rgba(0,0,0,0.3)]', 
    text: 'text-blue-700',
    bgLight: 'bg-cyan-50/50',
  },
  gold: { 
    gradient: 'from-yellow-300 via-amber-500 to-orange-600',
    innerGradient: 'from-yellow-200 to-amber-400', 
    border: 'border-yellow-100',
    ring: 'ring-4 ring-amber-500/30',
    shadow: 'shadow-[0_10px_30px_-10px_rgba(245,158,11,0.7)] shadow-[inset_0_-4px_8px_rgba(0,0,0,0.3)]', 
    text: 'text-amber-700',
    bgLight: 'bg-amber-50/50',
  },
  silver: { 
    gradient: 'from-slate-200 via-slate-400 to-slate-500',
    innerGradient: 'from-slate-100 to-slate-300', 
    border: 'border-white',
    ring: 'ring-4 ring-slate-400/20',
    shadow: 'shadow-[0_8px_20px_-10px_rgba(148,163,184,0.6)] shadow-[inset_0_-4px_6px_rgba(0,0,0,0.2)]', 
    text: 'text-slate-700',
    bgLight: 'bg-slate-50/50',
  },
  bronze: { 
    gradient: 'from-orange-200 via-orange-400 to-red-500',
    innerGradient: 'from-orange-100 to-orange-300', 
    border: 'border-orange-100',
    ring: 'ring-4 ring-orange-500/20',
    shadow: 'shadow-[0_8px_20px_-10px_rgba(234,88,12,0.6)] shadow-[inset_0_-4px_6px_rgba(0,0,0,0.2)]', 
    text: 'text-orange-800',
    bgLight: 'bg-orange-50/50',
  },
}

const TIER_ORDER = ['legendary', 'platinum', 'gold', 'silver', 'bronze']

// ─── Animated Icon Component ─────────────────────────────────────────────────
function BadgeIcon({ icon, className, tier, earned }) {
  // Define unique idle animations for different tiers
  const animations = {
    legendary: { y: [-2, 2, -2], rotate: [-5, 5, -5], scale: [1, 1.1, 1] },
    platinum: { y: [-2, 2, -2], scale: [1, 1.05, 1] },
    gold: { rotate: [-5, 5, -5] },
    silver: { scale: [1, 1.02, 1] },
    bronze: {},
  }

  const animationProps = earned 
    ? {
        animate: animations[tier] || {},
        transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
      }
    : {}

  return (
    <motion.div {...animationProps} className="relative z-20">
      {typeof icon === 'function' ? (
        React.createElement(icon, { className })
      ) : typeof icon === 'string' && icon.length > 0 ? (
        <span className="text-2xl leading-none drop-shadow-md">{icon}</span>
      ) : (
        <Award className={className} />
      )}
    </motion.div>
  )
}

// ─── Enhanced Medal Component ────────────────────────────────────────────────
function Medal({ badge, earnedAt, index }) {
  const earned = Boolean(earnedAt)
  const style = TIER_STYLES[badge.tier] || TIER_STYLES.bronze

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.8 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', bounce: 0.6, duration: 0.8 } }
      }}
      className={`group flex flex-col items-center text-center p-4 rounded-3xl transition-colors duration-500 ${earned ? `hover:${style.bgLight}` : 'hover:bg-slate-50'}`}
    >
      {/* 3D Medal Container with Hover Tilt */}
      <motion.div 
        className="relative mb-4 cursor-pointer"
        whileHover={{ scale: 1.15, rotateY: 15, rotateX: -10, y: -5 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
        style={{ perspective: 1000 }}
      >
        {/* Legendary Sparkles */}
        {earned && badge.tier === 'legendary' && (
           <>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} className="absolute -inset-4 z-0">
              <Star className="absolute top-0 right-0 w-4 h-4 text-yellow-300 fill-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,1)]" />
              <Star className="absolute bottom-0 left-0 w-3 h-3 text-purple-300 fill-purple-300 drop-shadow-[0_0_8px_rgba(216,180,254,1)]" />
            </motion.div>
            <Sparkles className="absolute -top-3 -right-3 w-7 h-7 text-yellow-300 animate-pulse z-30 drop-shadow-lg" />
           </>
        )}

        {/* Medal Base */}
        <div
          className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center border-3 sm:border-4 overflow-hidden z-10 transition-all duration-500 ${
            earned 
              ? `bg-gradient-to-br ${style.gradient} ${style.border} ${style.shadow} ${style.ring}` 
              : 'bg-gradient-to-br from-slate-100 to-slate-200 border-white shadow-[inset_0_4px_8px_rgba(0,0,0,0.1)] shadow-md grayscale opacity-70'
          }`}
        >
          {/* Inner metallic highlight */}
          {earned && (
            <div className={`absolute inset-1 rounded-full bg-gradient-to-tr ${style.innerGradient} opacity-60 mix-blend-overlay`} />
          )}

          {/* Sweeping Shine Effect on Hover */}
          {earned && (
            <motion.div
              initial={{ x: '-150%' }}
              whileHover={{ x: '150%' }}
              transition={{ duration: 1, ease: "easeInOut" }}
              className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-12 z-20 pointer-events-none"
            />
          )}

          {/* Icon */}
          {earned ? (
            <BadgeIcon icon={badge.icon} tier={badge.tier} earned={true} className="w-8 h-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" />
          ) : (
            <Lock className="w-6 h-6 text-slate-400 drop-shadow-sm" />
          )}
        </div>
        
        {/* Floor Shadow */}
        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-2 rounded-full blur-md transition-opacity ${earned ? 'bg-black/30' : 'bg-black/10'}`} />
      </motion.div>

      {/* Badge Info */}
      <div className="w-full flex flex-col items-center z-10">
        <p className={`text-[13px] font-black leading-tight tracking-wide ${earned ? 'text-slate-800' : 'text-slate-400'}`}>
          {badge.name}
        </p>
        <p className="text-[11px] font-medium text-slate-500 leading-relaxed mt-1.5 line-clamp-2 h-8">
          {badge.description}
        </p>
        
        {earned ? (
          typeof earnedAt === 'string' && (
            <motion.span 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-200/50 shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {new Date(earnedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </motion.span>
          )
        ) : (
          <span className="mt-3 inline-flex text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200/50">
            +{badge.points} XP
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main Vault Component ────────────────────────────────────────────────────
export default function AchievementVault({ catalog = [], earnedBadges = [] }) {
  const earnedMap = new Map(earnedBadges.map((b) => [b.id, b.earned_at || true]))
  const total = catalog.length
  const pct = total ? Math.round((earnedMap.size / total) * 100) : 0

  return (
    <Card className="p-0 overflow-hidden border-0 shadow-[0_20px_50px_rgb(0,0,0,0.08)] rounded-[2rem] bg-white relative">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-200/20 rounded-full blur-3xl pointer-events-none" />

      {/* Premium Header */}
      <div className="relative p-5 sm:p-8 lg:p-10 border-b border-slate-100/50 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6">
          <div>
            <motion.h3 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-extrabold text-2xl sm:text-3xl text-slate-800 tracking-tight flex items-center gap-2.5 sm:gap-3"
            >
              <Award className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 shrink-0" />
              Achievement Vault
            </motion.h3>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-xs sm:text-base font-medium text-slate-500 mt-1 sm:mt-2"
            >
              Your legacy of accomplishments and milestones.
            </motion.p>
          </div>
          
          {/* Enhanced Progress Stats */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-between sm:justify-start gap-4 sm:gap-5 bg-white/80 backdrop-blur-md px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border border-white shadow-xl shadow-slate-200/40"
          >
            <div className="text-left sm:text-right">
              <p className="font-extrabold text-2xl sm:text-3xl text-transparent bg-clip-text bg-gradient-to-br from-slate-800 to-slate-500 leading-none">
                {earnedMap.size} <span className="text-xs sm:text-sm text-slate-400 font-bold">/ {total}</span>
              </p>
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-blue-500 mt-1">Unlocked</p>
            </div>
            
            {/* Animated Circular Progress */}
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90 drop-shadow-sm" viewBox="0 0 36 36">
                <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                <motion.path 
                  initial={{ strokeDasharray: "0, 100" }}
                  whileInView={{ strokeDasharray: `${pct}, 100` }}
                  transition={{ type: "spring", bounce: 0.4, duration: 2 }}
                  className="text-blue-600" 
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="3"
                  strokeLinecap="round" 
                />
              </svg>
              <span className="absolute text-[10px] sm:text-[11px] font-extrabold text-slate-700">{pct}%</span>
            </div>
          </motion.div>
        </div>

        {/* Glowing Animated Progress Bar */}
        <div className="h-3 sm:h-4 rounded-full bg-slate-100/80 overflow-hidden mt-6 sm:mt-8 shadow-inner relative border border-slate-200/50">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${pct}%` }}
            viewport={{ once: true }}
            transition={{ type: "spring", bounce: 0.2, duration: 2, delay: 0.2 }}
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 relative"
          >
            {/* Continuous shimmer sweep */}
            <motion.div 
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12" 
            />
          </motion.div>
        </div>
      </div>

      {/* Vault Content */}
      <div className="p-4 sm:p-8 lg:p-10 relative z-10">
        {total === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
             <div className="w-24 h-24 mx-auto bg-slate-50/80 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-xl shadow-slate-200/50">
               <Award className="w-12 h-12 text-slate-300" />
             </div>
             <p className="text-xl font-extrabold text-slate-800">Vault is Empty</p>
             <p className="text-sm font-medium text-slate-500 mt-2">More challenges are being forged. Check back soon.</p>
          </motion.div>
        ) : (
          <div className="space-y-14">
            {TIER_ORDER.map((tier) => {
              const tierBadges = catalog.filter((b) => b.tier === tier)
              if (!tierBadges.length) return null
              
              const tierStyle = TIER_STYLES[tier]

              return (
                <div key={tier} className="relative">
                  {/* Glowing Tier Divider */}
                  <div className="flex items-center gap-5 mb-8">
                    <h4 className={`text-sm font-black uppercase tracking-[0.2em] ${tierStyle.text} bg-white pr-4 relative z-10 flex items-center gap-2`}>
                      {tier} Tier
                    </h4>
                    <div className={`h-px flex-1 bg-gradient-to-r ${tierStyle.gradient} opacity-20`} />
                  </div>
                  
                  {/* Staggered Grid */}
                  <motion.div 
                    initial="hidden" 
                    whileInView="visible" 
                    viewport={{ once: true, margin: "-100px" }}
                    variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-y-10 gap-x-4"
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