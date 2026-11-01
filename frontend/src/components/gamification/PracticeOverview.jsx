import { Award, BookOpen, Flame, MessageCircle, Star, Trophy } from 'lucide-react'
import Card from '../Card'
import DailyRewardCard from './DailyRewardCard'

export default function PracticeOverview({ profile, catalog = [], onRewardClaimed }) {
  const streak = profile?.current_streak || 0
  const badgePoints = catalog.map((badge) => Number(badge.points) || 0).filter(Boolean)
  const minBadgePoints = badgePoints.length ? Math.min(...badgePoints) : 50
  const maxBadgePoints = badgePoints.length ? Math.max(...badgePoints) : 500
  const levelInfo = profile?.level_info || {}
  const nextLevel = levelInfo.points_to_next > 0
    ? `+${levelInfo.points_to_next.toLocaleString()} XP to next level`
    : 'Highest level reached'

  return (
    <Card className="h-full p-5 sm:p-7 border border-slate-200/80 shadow-sm rounded-2xl flex flex-col">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-800">How to earn XP</h3>
            <p className="text-xs text-slate-500 mt-0.5">Build your score through consistent practice.</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-blue-600">
          XP Guide
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white text-blue-600 flex items-center justify-center shrink-0 shadow-sm">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-800">Complete an interview</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Your base reward for finishing a session</p>
            </div>
          </div>
          <span className="text-sm font-black text-blue-700 whitespace-nowrap">+50 XP</span>
          </div>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-1">
          <DailyRewardCard profile={profile} onClaimed={onRewardClaimed} />
        </div>
      </div>

      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">More ways to earn</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <RewardRow icon={MessageCircle} title="Answer each question" value="+2 XP" tone="slate" />
        <RewardRow icon={Star} title="Score bonus" value="+5 / +10 / +20 XP" detail="50% / 70% / 90%+" tone="amber" />
        <RewardRow
          icon={Flame}
          title="Continue your streak"
          value={`+${streak * 10} XP`}
          detail={`10 XP × ${streak || 0} day streak`}
          tone="orange"
        />
        <RewardRow
          icon={Award}
          title="Unlock a badge"
          value={`+${minBadgePoints}-${maxBadgePoints} XP`}
          detail="One-time reward"
          tone="purple"
        />
        <RewardRow icon={Trophy} title="Reach a new level" value={levelInfo.points_to_next > 0 ? 'Keep earning' : 'Completed'} detail={nextLevel} tone="blue" />
      </div>

      <div className="pt-2">
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <Trophy className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-[10px] leading-relaxed text-slate-500">
            Score and streak bonuses apply when an interview is completed. Badge XP is awarded only once per badge.
          </p>
        </div>
      </div>
    </Card>
  )
}

function RewardRow({ icon: Icon, title, value, detail, tone }) {
  const styles = {
    blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-violet-50 text-violet-600',
  }

  return (
    <div className="grid grid-cols-[2.25rem,minmax(0,1fr),auto] items-center gap-3 min-h-[72px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${styles[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-slate-700 leading-snug">{title}</p>
          {detail && <p className="text-[10px] text-slate-400 mt-0.5">{detail}</p>}
        </div>
        <span className="text-[11px] font-black text-slate-700 text-right whitespace-nowrap">{value}</span>
    </div>
  )
}
