// Carried over verbatim (in spirit) from the current CareerQuest.jsx so the
// real `recent_points` event log and the "next badge" nudge keep working
// exactly as they did before the redesign.

export const EVENT_LABELS = {
  interview_completed: 'Completed an interview',
  daily_practice: 'Daily practice bonus',
  streak_bonus: 'Streak bonus',
  score_5_plus: 'Scored 5+ on an interview',
  score_7_plus: 'Scored 7+ on an interview',
  score_9_plus: 'Scored 9+ on an interview',
  questions_answered: 'Answered questions',
}

export function describeEvent(event, catalog) {
  if (event?.startsWith('badge_earned:')) {
    const id = event.split(':')[1]
    const badge = catalog?.find((b) => b.id === id)
    return badge ? `Badge unlocked: ${badge.name}` : 'Badge unlocked'
  }
  return EVENT_LABELS[event] || event?.replace(/_/g, ' ')
}

// Returns the nearest not-yet-earned badge and a human progress string,
// used by Nova's message and previously by the "Copilot Insight" banner.
export function nextBadgeHint(profile, catalog) {
  if (!profile) return null
  const earned = new Set((profile.badges || []).map((b) => b.id))
  const interviews = profile.total_interviews || 0
  const streak = profile.current_streak || 0

  const candidates = [
    !earned.has('first_interview') && { id: 'first_interview', progress: `${Math.min(interviews, 1)}/1 interviews` },
    !earned.has('streak_3') && { id: 'streak_3', progress: `${Math.min(streak, 3)}/3 day streak` },
    !earned.has('consistent_learner') && { id: 'consistent_learner', progress: `${Math.min(interviews, 5)}/5 interviews` },
    !earned.has('streak_7') && { id: 'streak_7', progress: `${Math.min(streak, 7)}/7 day streak` },
  ].filter(Boolean)

  if (!candidates.length) return null
  const badge = catalog?.find((b) => b.id === candidates[0].id)
  if (!badge) return null
  return { badge, progress: candidates[0].progress }
}
