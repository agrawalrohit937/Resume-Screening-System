import { useEffect, useMemo, useState } from 'react'
import { Check, Clock, Gift, Loader } from 'lucide-react'
import { claimDailyVisitReward } from '../../services/interviewApi'
import toast from 'react-hot-toast'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export default function DailyRewardCard({ profile, onClaimed }) {
  const [claiming, setClaiming] = useState(false)
  const claimedFromProfile = String(profile?.last_daily_reward_date || '').slice(0, 10) === todayKey()
  const [claimed, setClaimed] = useState(claimedFromProfile)

  useEffect(() => {
    setClaimed(claimedFromProfile)
  }, [claimedFromProfile])

  const nextReset = useMemo(() => {
    const tomorrow = new Date()
    tomorrow.setUTCHours(24, 0, 0, 0)
    const hours = Math.max(1, Math.ceil((tomorrow - new Date()) / 3600000))
    return `${hours}h`
  }, [claimed])

  const handleClaim = async () => {
    if (claiming || claimed) return
    setClaiming(true)
    try {
      const response = await claimDailyVisitReward()
      if (response.data?.awarded > 0) {
        setClaimed(true)
        toast.success('Daily reward claimed: +50 XP')
        onClaimed?.()
      } else {
        setClaimed(true)
        toast('Daily reward already claimed today.')
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not claim daily reward.')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl">
    <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-blue-50 via-indigo-50 to-violet-50 px-3 py-3 sm:px-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
          <Gift className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-800">Daily Reward</p>
          <p className="text-[10px] text-slate-500">Claim once every day</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleClaim}
        disabled={claiming || claimed}
        className={`shrink-0 rounded-xl px-3 py-2 text-[10px] font-black flex items-center gap-1 ${
          claimed ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
        }`}
      >
        {claiming ? <Loader className="w-3.5 h-3.5 animate-spin" /> : claimed ? <Check className="w-3.5 h-3.5" /> : <Gift className="w-3.5 h-3.5" />}
        {claiming ? 'Claiming' : claimed ? 'Claimed' : '+50 XP'}
      </button>
    </div>
    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white">
      <span className="text-[10px] font-bold text-slate-500">Next check-in</span>
      <span className="text-[10px] font-extrabold text-slate-700 flex items-center gap-1">
        <Clock className="w-3 h-3" /> {claimed ? nextReset : 'Available now'}
      </span>
    </div>
    </div>
  )
}
