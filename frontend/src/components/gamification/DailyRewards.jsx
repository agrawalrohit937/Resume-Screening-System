import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Zap, Gift, Check, Loader, Sparkles, Lock, Trophy, Clock, 
  Flame, ShieldCheck 
} from 'lucide-react'
import { getDailyRewardStatus, claimDailyReward } from '../../services/interviewApi'
import Card from './Card'

function getTimeUntilMidnight() {
  const now = new Date()
  const midnight = new Date()
  midnight.setHours(24, 0, 0, 0)
  const diffMs = midnight - now
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${minutes}m`
}

export default function DailyRewards({ profile }) {
  const [rewardData, setRewardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState(null)
  const [countdown, setCountdown] = useState(getTimeUntilMidnight)

  useEffect(() => {
    loadRewardStatus()
    const timer = setInterval(() => setCountdown(getTimeUntilMidnight()), 60000)
    return () => clearInterval(timer)
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

      // Dispatch global notification to trigger Navbar Bell alert
      window.dispatchEvent(
        new CustomEvent('trigger-notification', {
          detail: {
            title: 'Daily Check-in Claimed! 🎉',
            message: 'You earned +50 XP from Daily Check-in & boosted your streak!',
            type: 'xp',
            created_at: new Date().toISOString(),
          },
        })
      )

      setTimeout(async () => {
        await loadRewardStatus()
        setClaiming(false)
      }, 600)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to claim reward.')
      setClaiming(false)
    }
  }

  const streak = rewardData?.reward_streak || profile?.current_streak || 0
  const cycleNumber = Math.floor(streak / 7) + 1
  const canClaimToday = rewardData?.can_claim_today ?? true

  const boosterCards = [
    {
      title: 'Daily Login Boost',
      reward: '+25 XP',
      desc: 'Claimed every 24 hours',
      icon: Zap,
      color: 'from-amber-400 to-orange-500',
      active: true,
    },
    {
      title: 'Streak Multiplier',
      reward: `${Math.min(1.5 + streak * 0.1, 2.5).toFixed(1)}x XP`,
      desc: `${streak}-day streak multiplier active`,
      icon: Flame,
      color: 'from-orange-500 to-red-500',
      active: streak > 0,
    },
    {
      title: 'Weekly Treasure Chest',
      reward: '+250 XP',
      desc: 'Unlocks on Day 7 check-in',
      icon: Gift,
      color: 'from-purple-500 to-indigo-600',
      active: streak >= 7,
    },
    {
      title: 'Interview Mastery',
      reward: '+100 XP',
      desc: 'Complete 1 AI mock session',
      icon: ShieldCheck,
      color: 'from-emerald-400 to-teal-600',
      active: (profile?.total_interviews || 0) > 0,
    },
  ]

  if (loading) {
    return (
      <Card className="p-6 sm:p-8 flex flex-col items-center justify-center min-h-[320px]">
        <Loader className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <p className="text-sm font-bold text-slate-400">Loading XP Boost Center...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6 sm:p-8 text-center min-h-[320px] flex flex-col items-center justify-center">
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

  return (
    <Card className="p-0 overflow-hidden relative border-indigo-100 shadow-sm">
      {/* Top Banner & Hero Claim Area */}
      <div className="p-6 sm:p-8 bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 text-white relative overflow-hidden">
        <Sparkles className="absolute -top-6 -right-6 w-32 h-32 text-white/10 rotate-12" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.25),transparent_60%)]" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                Daily Check-in & XP Center
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-[10px] font-bold">
                Cycle #{cycleNumber}
              </span>
            </div>
            <h3 className="font-black text-2xl tracking-tight text-white">
              Claim Your Daily XP Boost
            </h3>
            <p className="text-xs font-medium text-slate-300 mt-1">
              Keep your streak alive & unlock massive XP multipliers every 24 hours.
            </p>
          </div>

          {/* Hero Claim Button */}
          {canClaimToday ? (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              disabled={claiming}
              onClick={handleClaim}
              className="shrink-0 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(249,115,22,0.4)] border border-amber-300 transition-all cursor-pointer"
            >
              {claiming ? (
                <>
                  <Loader className="w-4 h-4 animate-spin text-white" />
                  <span>Claiming...</span>
                </>
              ) : (
                <>
                  <Gift className="w-5 h-5 text-amber-100 animate-bounce" />
                  <span>Claim Today's +50 XP ➔</span>
                </>
              )}
            </motion.button>
          ) : (
            <div className="shrink-0 px-4 py-3 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-extrabold flex items-center gap-2 backdrop-blur-md">
              <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
              <div className="flex flex-col text-left">
                <span>✔ Claimed Today</span>
                <span className="text-[10px] text-emerald-200/80 font-normal flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Next in {countdown}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Boosters Compact Grid */}
      <div className="p-6 sm:p-8 bg-white space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {boosterCards.map((b, idx) => {
            const Icon = b.icon
            return (
              <div
                key={idx}
                className={`p-4 rounded-2xl border transition-all duration-300 flex items-center gap-4 ${
                  b.active
                    ? 'bg-slate-50/80 border-slate-200/80 hover:border-indigo-200 shadow-xs'
                    : 'bg-slate-50/40 border-slate-100 opacity-60'
                }`}
              >
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${b.color} text-white flex items-center justify-center shrink-0 shadow-md`}>
                  <Icon className="w-5.5 h-5.5 drop-shadow-sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-black text-slate-800 truncate">{b.title}</p>
                    <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 shrink-0">
                      {b.reward}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5 truncate">{b.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Info Banner at Bottom */}
        <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between gap-4 text-xs font-bold text-indigo-900">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Streak Cycle #{cycleNumber} Active • Keep check-ins consistent!</span>
          </div>
          <span className="text-[11px] text-indigo-600 font-extrabold shrink-0 uppercase tracking-wider">
            {streak} Day Streak 🔥
          </span>
        </div>
      </div>
    </Card>
  )
}