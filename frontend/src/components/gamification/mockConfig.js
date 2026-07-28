// mockConfig.js
// ---------------------------------------------------------------------------
// CLEARLY ISOLATED FRONTEND MOCK / DERIVED CONFIG
// Nothing in this file should be treated as ground truth from the CareerShala
// backend. Where a value is *derived* from a real profile field, that is
// noted inline. Where it's pure placeholder config (no backend field exists
// yet), it's marked "NEEDS BACKEND" so it's easy to grep for later.
// ---------------------------------------------------------------------------

import { Target, Flame, BookOpen, Zap, Star, Crown, Shield, Trophy, Medal } from 'lucide-react'

// Same shape and same values as the FALLBACK_LEVEL_THRESHOLDS already in
// CareerQuest.jsx — used only when getLevelCatalog() fails or returns
// something that doesn't validate (every level needs a `name` and a numeric
// `threshold`).
export const FALLBACK_LEVEL_THRESHOLDS = [
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

// Same shape and same values as the BADGE_CATALOG already in CareerQuest.jsx —
// used only when getBadgeCatalog() fails or returns badges missing `id`/`tier`.
export const BADGE_CATALOG_FALLBACK = [
  { id: 'first_interview', name: 'First Steps', description: 'Completed your first AI interview', icon: Target, points: 50, tier: 'bronze' },
  { id: 'streak_3', name: 'On Fire', description: '3-day practice streak', icon: Flame, points: 60, tier: 'bronze' },
  { id: 'consistent_learner', name: 'Consistent Learner', description: 'Completed 5 interviews', icon: BookOpen, points: 75, tier: 'silver' },
  { id: 'ai_ready', name: 'AI Ready', description: 'Scored 80%+ on a technical interview', icon: Zap, points: 100, tier: 'silver' },
  { id: 'speed_demon', name: 'Speed Demon', description: 'Answered within 30 seconds with 8+ score', icon: Zap, points: 80, tier: 'silver' },
  { id: 'streak_7', name: 'Week Warrior', description: '7-day practice streak', icon: Flame, points: 120, tier: 'silver' },
  { id: 'top_performer', name: 'Top Performer', description: 'Scored 90%+ on any interview', icon: Star, points: 150, tier: 'gold' },
  { id: 'perfect_score', name: 'Perfection', description: 'Scored 10/10 on a question', icon: Crown, points: 200, tier: 'gold' },
  { id: 'integrity_pro', name: 'Integrity Pro', description: 'Passed 5 sessions with 0 cheating flags', icon: Shield, points: 100, tier: 'gold' },
  { id: 'streak_30', name: 'Unstoppable', description: '30-day practice streak', icon: Trophy, points: 300, tier: 'platinum' },
  { id: 'interview_master', name: 'Interview Master', description: 'Completed 20 interviews', icon: Medal, points: 500, tier: 'legendary' },
]

// Finds a level's index by name (case-insensitive). Used to anchor the
// Weekly Challenge / Reward markers to "Advanced" / "Expert" when those names
// exist in whatever level catalog came back (real or fallback). If a custom
// remote catalog doesn't use those names, callers fall back to a position.
export function findLevelIndexByName(levels, name) {
  return levels.findIndex((lvl) => (lvl.name || '').toLowerCase() === name.toLowerCase())
}

// Highest level index the user's current total_points has cleared. Mirrors
// the exact logic already used for the roadmap in CareerQuest.jsx — based on
// XP thresholds, not on matching level_info.name (which may be computed
// differently on the backend).
export function deriveCurrentLevelIndex(levels, totalPoints) {
  return levels.reduce((acc, lvl, i) => (totalPoints >= lvl.threshold ? i : acc), 0)
}

// NEEDS BACKEND: a real missions API (daily reset, weekly reset, per-user
// progress) doesn't exist yet. Definitions below are static config; progress
// is computed from real profile fields where a sensible mapping exists
// (see `progressFromProfile`), and defaults to 0 otherwise.
export const MISSION_DEFINITIONS = {
  daily: [
    {
      id: 'interview-warrior',
      title: 'Complete 1 mock interview',
      icon: 'Target',
      target: 1,
      xp: 50,
      progressFromProfile: null, // NEEDS BACKEND: no "today" counter yet
    },
    {
      id: 'ats-hunter',
      title: 'Reach a 75+ ATS score',
      icon: 'TrendingUp',
      target: 75,
      xp: 40,
      progressFromProfile: (p) => Math.round((p?.average_score || 0) * 100),
    },
    {
      id: 'brain-trainer',
      title: 'Answer 5 interview questions',
      icon: 'BookOpen',
      target: 5,
      xp: 30,
      progressFromProfile: null, // NEEDS BACKEND: no "today" counter yet
    },
  ],
  weekly: [
    {
      id: 'streak-guardian',
      title: 'Keep your streak alive for 7 days',
      icon: 'Flame',
      target: 7,
      xp: 150,
      progressFromProfile: (p) => p?.current_streak || 0,
    },
  ],
  special: [
    {
      id: 'flawless-run',
      title: 'Log 3 clean interview sessions',
      icon: 'ShieldCheck',
      target: 3,
      xp: 200,
      progressFromProfile: (p) => p?.clean_sessions || 0,
    },
  ],
}

export const WEEKLY_CHALLENGE = {
  title: 'Crack the AI Interview',
  difficulty: 'Hard',
  objective: 'Score 75%+ in a full AI interview',
  targetScorePct: 75,
  rewardXp: 500,
  badge: 'AI Ready',
}

// Derives 0-100 progress toward the weekly challenge from the real
// average_score field. Progress fills up as the user's average improves —
// simpler and clearer than an inverted "boss HP" framing.
export function deriveChallengeProgressPct(profile) {
  const currentPct = Math.round((profile?.average_score || 0) * 100)
  return Math.min(100, Math.round((currentPct / WEEKLY_CHALLENGE.targetScorePct) * 100))
}

// NEEDS BACKEND: league/division is derived from XP bands here, independent
// of the real leaderboard rank shown in the Leaderboard tab.
export function deriveLeagueName(profile) {
  const pts = profile?.total_points || 0
  if (pts >= 4000) return 'Diamond'
  if (pts >= 2500) return 'Platinum'
  if (pts >= 1000) return 'Gold'
  if (pts >= 300) return 'Silver'
  return 'Bronze'
}

export const STREAK_MILESTONES = [3, 7, 14, 30, 100]

// NOTE: Daily Rewards now use the backend API at /interview/ai/gamification/daily-reward/*
// The old DAILY_REWARD_DEMO static data has been removed as it's no longer needed.
// See DailyRewards.jsx component and gamification_service.py for the real implementation.
