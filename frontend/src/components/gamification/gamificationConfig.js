import { Target, Flame, BookOpen, Zap, Star, Crown, Trophy, Medal } from 'lucide-react'

export const LEVELS = [
  { level: 1, threshold: 0, name: 'Beginner', icon: '🌱' },
  { level: 2, threshold: 100, name: 'Junior', icon: '🔵' },
  { level: 3, threshold: 300, name: 'Developing', icon: '🟢' },
  { level: 4, threshold: 600, name: 'Competent', icon: '🟡' },
  { level: 5, threshold: 1000, name: 'Proficient', icon: '🟠' },
  { level: 6, threshold: 1500, name: 'Advanced', icon: '🔴' },
  { level: 7, threshold: 2500, name: 'Expert', icon: '💜' },
  { level: 8, threshold: 4000, name: 'Master', icon: '🏆' },
  { level: 9, threshold: 6000, name: 'Legend', icon: '👑' },
]

export function deriveCurrentLevelIndex(levels, totalPoints) {
  return levels.reduce((index, level, currentIndex) => (
    totalPoints >= level.threshold ? currentIndex : index
  ), 0)
}

export const BADGE_CATALOG_FALLBACK = [
  { id: 'first_interview', name: 'First Steps', description: 'Completed your first AI interview', icon: Target, points: 50, tier: 'bronze' },
  { id: 'streak_3', name: 'On Fire', description: '3-day practice streak', icon: Flame, points: 60, tier: 'bronze' },
  { id: 'consistent_learner', name: 'Consistent Learner', description: 'Completed 5 interviews', icon: BookOpen, points: 75, tier: 'silver' },
  { id: 'ai_ready', name: 'AI Ready', description: 'Scored 80%+ on a technical interview', icon: Zap, points: 100, tier: 'silver' },
  { id: 'streak_7', name: 'Week Warrior', description: '7-day practice streak', icon: Flame, points: 120, tier: 'silver' },
  { id: 'top_performer', name: 'Top Performer', description: 'Scored 90%+ on any interview', icon: Star, points: 150, tier: 'gold' },
  { id: 'perfect_score', name: 'Perfection', description: 'Scored 10/10 on a question', icon: Crown, points: 200, tier: 'gold' },
  { id: 'streak_30', name: 'Unstoppable', description: '30-day practice streak', icon: Trophy, points: 300, tier: 'platinum' },
  { id: 'interview_master', name: 'Interview Master', description: 'Completed 20 interviews', icon: Medal, points: 500, tier: 'legendary' },
]

export const STREAK_MILESTONES = [3, 7, 14, 30, 100]
