import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Gift, Check, Loader, Flame, Sparkles, Star } from 'lucide-react'
import { getDailyRewardStatus, claimDailyReward } from '../../services/interviewApi'
import Card from './Card'

const ICONS = { xp: Zap, bonus: Gift, special: Star }

export default function DailyRewards() {
  const [rewardData, setRewardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadRewardStatus()
  }, [])

  async function loadRewardStatus() {
    setLoading(true)
    setError(null)
    try {
      const res = await getDailyRewardStatus()
      setRewardData(res.data)
    } catch (err) {
      setError('Failed to load daily rewards.')
    } finally {
      setLoading(false)
    }
  }

  async function handleClaim() {
    if (claiming) return
    setClaiming(true)
    try {
      await claimDailyReward()
      // Reload status after a short delay to allow animations to play
      setTimeout(async () => {
        await loadRewardStatus()
        setClaiming(false)
      }, 600)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to claim reward.')
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-6 sm:p-8 flex flex-col items-center justify-center min-h-[200px]">
        <Loader className="w-8 h-8 text-blue-500 animate-spin mb-3" />
        <p className="text-sm font-bold text-slate-400">Loading Rewards...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6 sm:p-8 text-center min-h-[200px] flex flex-col items-center justify-center">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3">
          <Zap className="w-6 h-6 text-red-400" />
        </div>
        <p className="text-sm font-bold text-slate-700">{error}</p>
        <button 
          onClick={loadRewardStatus} 
          className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs hover:bg-blue-100 transition-colors"
        >
          Try Again
        </button>
      </Card>
    )
  }

  const days = rewardData?.days || []
  const canClaimToday = rewardData?.can_claim_today || false
  const streak = rewardData?.reward_streak || 0
  
  // Calculate how many days are claimed for the progress bar
  const claimedCount = days.filter(d => d.claimed).length
  const progressPct = days.length > 0 ? (claimedCount / days.length) * 100 : 0

  return (
    <Card className="p-0 overflow-hidden relative">
      {/* Premium Header */}
      <div className="p-6 sm:p-8 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100 relative overflow-hidden">
        <Sparkles className="absolute -top-6 -right-6 w-32 h-32 text-slate-100 rotate-12" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-2xl text-slate-800 tracking-tight flex items-center gap-2">
              Daily Rewards
            </h3>
            <p className="text-sm font-medium text-slate-500 mt-1">Check in every day to build your streak</p>
          </div>
          
          {streak > 0 && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 px-4 py-2 rounded-2xl shadow-sm"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-inner">
                <Flame className="w-4 h-4 text-white drop-shadow-md" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-orange-500">Current Streak</p>
                <p className="text-lg font-extrabold text-orange-700 leading-none">{streak} <span className="text-xs">Days</span></p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Reward Track */}
      <div className="p-6 sm:p-8 relative">
        
        {/* Background Progress Line */}
        <div className="absolute top-[68px] left-10 right-10 h-2 bg-slate-100 rounded-full hidden sm:block shadow-inner" />
        <div 
          className="absolute top-[68px] left-10 h-2 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full hidden sm:block transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(52,211,153,0.5)]" 
          style={{ width: `calc(${progressPct}% - 40px)` }} 
        />

        {/* Days Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 sm:gap-4 relative z-10">
          {days.map((day, index) => {
            const isDay7 = day.day === 7
            const Icon = isDay7 ? Gift : (ICONS[day.type] || Zap)
            const isClaimed = day.claimed
            const isCurrent = day.isToday
            const isFuture = !isClaimed && !isCurrent

            return (
              <motion.div
                key={day.day}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, type: 'spring' }}
                className="relative flex flex-col items-center"
              >
                {/* Reward Node */}
                <motion.button
                  disabled={!isCurrent || claiming || isClaimed}
                  onClick={handleClaim}
                  whileHover={isCurrent && !isClaimed ? { y: -4, scale: 1.05 } : {}}
                  whileTap={isCurrent && !isClaimed ? { scale: 0.95 } : {}}
                  className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all duration-300 focus:outline-none ${
                    isClaimed 
                      ? 'bg-emerald-50 border-2 border-emerald-200 cursor-default'
                      : isCurrent 
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-white cursor-pointer shadow-[0_8px_15px_rgba(59,130,246,0.3)] shadow-[inset_0_-4px_4px_rgba(0,0,0,0.15)] z-20'
                      : isDay7
                      ? 'bg-gradient-to-br from-amber-100 to-orange-100 border-2 border-orange-200 opacity-80 grayscale-[20%]'
                      : 'bg-slate-50 border-2 border-slate-100 opacity-70 cursor-not-allowed shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]'
                  }`}
                >
                  {/* Floating animation for today */}
                  {isCurrent && !isClaimed && (
                    <motion.div
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="absolute -inset-2 rounded-2xl bg-blue-400 opacity-20 animate-ping" />
                    </motion.div>
                  )}

                  {/* Icon */}
                  <div className="relative z-10 mb-1">
                    {isClaimed ? (
                      <Check className="w-6 h-6 text-emerald-500 stroke-[3]" />
                    ) : claiming && isCurrent ? (
                      <Loader className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Icon className={`w-6 h-6 ${isCurrent ? 'text-white drop-shadow-md' : isDay7 ? 'text-orange-500' : 'text-slate-400'}`} />
                    )}
                  </div>

                  {/* Value */}
                  <span className={`text-[10px] font-extrabold relative z-10 ${
                    isClaimed ? 'text-emerald-600' : isCurrent ? 'text-blue-50' : isDay7 ? 'text-orange-600' : 'text-slate-400'
                  }`}>
                    {isClaimed ? 'Claimed' : claiming && isCurrent ? 'Wait...' : day.type === 'xp' ? `+${day.amount}` : day.label || day.type}
                  </span>
                </motion.button>

                {/* Day Label */}
                <p className={`mt-2 text-[11px] font-black uppercase tracking-wider ${
                  isCurrent ? 'text-blue-600' : isClaimed ? 'text-emerald-600' : 'text-slate-400'
                }`}>
                  Day {day.day}
                </p>
              </motion.div>
            )
          })}
        </div>

        {/* Cycle Completion Message */}
        <AnimatePresence>
          {rewardData?.cycle_completed && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="mt-6 text-center bg-emerald-50 border border-emerald-200 rounded-xl py-3"
            >
              <span className="text-sm font-extrabold text-emerald-600 flex items-center justify-center gap-2">
                <Star className="w-4 h-4 fill-emerald-500 text-emerald-500" />
                7-Day Cycle Completed! Incredible work!
                <Star className="w-4 h-4 fill-emerald-500 text-emerald-500" />
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  )
}