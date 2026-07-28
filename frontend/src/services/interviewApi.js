/**
 * Interview API Service — AI interview, feedback, cheating, gamification
 * Extends existing api.js without modifying it
 */
import api from './api'
// ── AI Interview Generation ──────────────────────────────────────────────────
// ── AI Interview Generation ─────────────────────────────────
export const generateAIInterview = (payload) =>
  api.post('/interview/ai/generate', payload)


// ── Answer Evaluation ───────────────────────────────────────
export const evaluateAnswer = (payload) =>
  api.post('/interview/ai/feedback', payload)


// ── Session Completion ──────────────────────────────────────
export const completeInterviewSession = (payload) =>
  api.post('/interview/ai/complete', payload)


// ── Cheating Report ─────────────────────────────────────────
export const submitCheatingReport = (payload) =>
  api.post('/interview/ai/cheating/report', payload)


// ── Gamification ────────────────────────────────────────────
export const getGamificationProfile = (config) =>
  api.get('/interview/ai/gamification/profile', config)


export const getLeaderboard = (limit = 20) =>
  api.get(`/interview/ai/gamification/leaderboard?limit=${limit}`)

export const getBadgeCatalog = () =>
  api.get('/interview/ai/badges/catalog')

// NEW: full ordered level list ({ level, name, icon, threshold }) — lets the
// frontend render the level roadmap from the server instead of hardcoding
// LEVEL_THRESHOLDS. Requires the /gamification/levels route added to
// interview_ai.py.
export const getLevelCatalog = () =>
  api.get('/interview/ai/gamification/levels')

// ── WebSocket helper ──────────────────────────────────────────────────────────
export const createInterviewWebSocket = (sessionId) => {
  const wsBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1')
    .replace('http://', 'ws://')
    .replace('https://', 'wss://')
  return new WebSocket(`${wsBase}/interview/ws/${sessionId}`)
}

// ── Daily Activity (first visit bonus) ───────────────────────
export const markDailyActivity = () =>
  api.post('/interview/ai/gamification/daily-activity')

// ── Daily Reward (7-Day Claim Track) ─────────────────────────
export const getDailyRewardStatus = () =>
  api.get('/interview/ai/gamification/daily-reward/status')

export const claimDailyReward = () =>
  api.post('/interview/ai/gamification/daily-reward/claim')

// ── Daily Missions ────────────────────────────────────────────
export const getDailyMissions = () =>
  api.get('/interview/ai/gamification/daily-missions')

// ── Weekly Challenge ──────────────────────────────────────────
export const getWeeklyChallenge = () =>
  api.get('/interview/ai/gamification/weekly-challenge')

export const claimWeeklyChallenge = () =>
  api.post('/interview/ai/gamification/weekly-challenge/claim')

// ── Reward Chests ─────────────────────────────────────────────
export const getRewardChests = () =>
  api.get('/interview/ai/gamification/reward-chests')

export const claimRewardChest = (chestId) =>
  api.post('/interview/ai/gamification/reward-chest/claim', { chest_id: chestId })

// ── Resume Fetch ─────────────────────────────────────────────
export const getResumes = () =>
  api.get('/resume')
