import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Zap, Gift, Check, Loader, Sparkles, Trophy, Clock,
  Flame, ShieldCheck, Star
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
      color: 'from-amber-400 to-amber-500',
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
      color: 'from-teal-400 to-emerald-500',
      active: (profile?.total_interviews || 0) > 0,
    },
  ]

  if (loading) {
    return (
      <Card className="p-6 sm:p-8 flex flex-col items-center justify-center min-h-[320px] border-slate-100 shadow-sm bg-white">
        <Loader className="w-8 h-8 text-[#2E9BDA] animate-spin mb-3" />
        <p className="text-[13px] font-bold text-slate-400">Loading XP Boost Center...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6 sm:p-8 text-center min-h-[320px] flex flex-col items-center justify-center border-slate-100 shadow-sm bg-white">
        <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
          <Zap className="w-6 h-6 text-rose-500" />
        </div>
        <p className="text-[13px] font-bold text-blue-950 mb-4">{error}</p>
        <button
          onClick={loadRewardStatus}
          className="px-6 py-2.5 bg-blue-50 text-[#1d6fa5] rounded-xl font-bold text-[13px] hover:bg-blue-100 transition-colors"
        >
          Try Again
        </button>
      </Card>
    )
  }

  return (
    <Card className="p-0 overflow-hidden relative border border-slate-200/80 shadow-sm bg-white rounded-3xl">

      {/* Sleek Professional Navy Header */}
      <div className="p-6 sm:p-7 bg-[#0f172a] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="px-3 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                <Star className="w-3 h-3 text-amber-400" /> Daily Check-in
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                Cycle #{cycleNumber}
              </span>
            </div>
            <h3 className="font-extrabold text-[22px] sm:text-[26px] tracking-tight text-white leading-tight">
              Claim Your Daily XP Boost
            </h3>
            <p className="text-[12.5px] font-medium text-slate-300 mt-1 max-w-sm">
              Check in every 24 hours to earn XP and maintain your activity streak.
            </p>
          </div>

          {/* Action Button */}
          {canClaimToday ? (
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              disabled={claiming}
              onClick={handleClaim}
              className="shrink-0 px-7 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[13.5px] flex items-center justify-center gap-2 shadow-md border border-amber-400 transition-all cursor-pointer w-full sm:w-auto"
            >
              {claiming ? (
                <>
                  <Loader className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Claiming...</span>
                </>
              ) : (
                <>
                  <Gift className="w-4.5 h-4.5 text-slate-950" />
                  <span>Claim +50 XP</span>
                </>
              )}
            </motion.button>
          ) : (
            <div className="shrink-0 px-5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-[12.5px] font-bold flex items-center gap-3 w-full sm:w-auto shadow-sm">
              <div className="bg-emerald-500/20 text-emerald-400 p-1 rounded-full border border-emerald-500/30">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-white font-extrabold">Claimed Today</span>
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-slate-400" /> Next in {countdown}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 sm:p-7 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {boosterCards.map((b, idx) => {
            const Icon = b.icon
            return (
              <div
                key={idx}
                className={`p-3.5 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 ${b.active
                    ? 'bg-white border-slate-200/80 shadow-sm'
                    : 'bg-slate-50 border-slate-200/40 opacity-55'
                  }`}
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-[13px] font-extrabold text-slate-800 truncate">{b.title}</p>
                    <span className="text-[10.5px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 shrink-0">
                      {b.reward}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 truncate">{b.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[12px] font-bold text-slate-600">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Streak Cycle #{cycleNumber} Active • Keep check-ins consistent</span>
          </div>
          <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg font-extrabold shrink-0 uppercase tracking-wider flex items-center gap-1 shadow-sm">
            {streak} Day Streak <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          </span>
        </div>
      </div>
    </Card>
  )
}

