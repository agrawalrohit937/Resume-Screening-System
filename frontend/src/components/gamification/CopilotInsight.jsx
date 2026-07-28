import { Sparkles } from 'lucide-react'
import { nextBadgeHint } from './activityUtils'
import Button from './Button'
import Card from './Card'

function pickMessage(profile, catalog) {
  const hint = nextBadgeHint(profile, catalog)
  if (hint) return `You're at ${hint.progress} toward the "${hint.badge.name}" badge. One session gets you there.`

  const toNext = profile?.level_info?.points_to_next || 0
  const streak = profile?.current_streak || 0
  const avg = Math.round((profile?.average_score || 0) * 100)

  if (toNext > 0 && toNext <= 200) return `You're only ${toNext} XP away from your next level.`
  if (avg > 0 && avg < 75) return `One strong interview could push your average past 75%.`
  if (streak > 0) return `${streak}-day streak going. Practice today to keep it alive.`
  return `No streak yet — one short practice interview today gets you started.`
}

export default function CopilotInsight({ profile, catalog, onOpenCopilot }) {
  const message = pickMessage(profile, catalog)

  return (
    <Card className="p-4 flex items-center gap-4">
      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
        <Sparkles className="w-4.5 h-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500">Copilot Insight</p>
        <p className="text-sm font-medium text-slate-700 truncate sm:whitespace-normal">{message}</p>
      </div>
      <Button variant="ghost" onClick={onOpenCopilot} className="shrink-0 hidden sm:inline-flex">
        Open Copilot
      </Button>
    </Card>
  )
}
