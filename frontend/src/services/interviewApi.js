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
let _gamiProfileInFlight = null
export const getGamificationProfile = (config) => {
  if (_gamiProfileInFlight) return _gamiProfileInFlight
  _gamiProfileInFlight = api.get('/interview/ai/gamification/profile', config)
    .finally(() => {
      setTimeout(() => { _gamiProfileInFlight = null }, 2000)
    })
  return _gamiProfileInFlight
}

export const claimDailyVisitReward = () =>
  api.post('/interview/ai/gamification/daily-visit')



let _leaderboardInFlight = null
export const getLeaderboard = (limit = 20) => {
  if (_leaderboardInFlight) return _leaderboardInFlight
  _leaderboardInFlight = api.get(`/interview/ai/gamification/leaderboard?limit=${limit}`)
    .finally(() => {
      setTimeout(() => { _leaderboardInFlight = null }, 3000)
    })
  return _leaderboardInFlight
}

export const getBadgeCatalog = () =>
  api.get('/interview/ai/badges/catalog')

// ── WebSocket helper ──────────────────────────────────────────────────────────
export const createInterviewWebSocket = (sessionId) => {
  const wsBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1')
    .replace('http://', 'ws://')
    .replace('https://', 'wss://')
  return new WebSocket(`${wsBase}/interview/ai/ws/${sessionId}`)
}

// ── Resume Fetch ─────────────────────────────────────────────
export const getResumes = () =>
  api.get('/resume')
