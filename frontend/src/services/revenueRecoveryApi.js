/**
 * Revenue Recovery API Service
 * Interacts with AI Revenue Recovery agent backend endpoints
 */
import api from './api'

// ── Overview & Analytics ───────────────────────────────────────────────────
export const getRecoveryOverview = async () => {
  const { data } = await api.get('/admin/revenue-recovery/overview')
  return data
}

// ── Cases Queue ────────────────────────────────────────────────────────────
export const getRecoveryCases = async (params = {}) => {
  const { data } = await api.get('/admin/revenue-recovery/cases', { params })
  return data
}

export const getRecoveryCaseDetail = async (caseId) => {
  const { data } = await api.get(`/admin/revenue-recovery/cases/${caseId}`)
  return data
}

// ── Admin Actions ──────────────────────────────────────────────────────────
export const retryRecoveryCase = async (caseId) => {
  const { data } = await api.post(`/admin/revenue-recovery/cases/${caseId}/retry`)
  return data
}

export const approveRecoveryCase = async (caseId, payload = {}) => {
  const { data } = await api.post(`/admin/revenue-recovery/cases/${caseId}/approve`, payload)
  return data
}

export const rejectRecoveryCase = async (caseId) => {
  const { data } = await api.post(`/admin/revenue-recovery/cases/${caseId}/reject`)
  return data
}

export const closeRecoveryCase = async (caseId) => {
  const { data } = await api.post(`/admin/revenue-recovery/cases/${caseId}/close`)
  return data
}

export const triggerChannelOutreach = async (caseId, payload) => {
  const { data } = await api.post(`/admin/revenue-recovery/cases/${caseId}/trigger-channel`, payload)
  return data
}



// ── Voice & User Recovery ──────────────────────────────────────────────────
export const interactVoiceRecovery = async (payload) => {
  const { data } = await api.post('/revenue-recovery/voice/interact', payload)
  return data
}

export const payRecoveredCase = async (payload) => {
  const { data } = await api.post('/revenue-recovery/pay-recovered', payload)
  return data
}

export const getMyRecoveryBanner = async () => {
  const { data } = await api.get('/revenue-recovery/my-recovery-banner')
  return data
}

export const RECOVERY_STATUS_CONFIG = {
  AT_RISK: { label: 'At Risk', color: '#F59E0B', bg: '#FFFBEB' },
  PAYMENT_FAILED: { label: 'Payment Failed', color: '#EF4444', bg: '#FEF2F2' },
  RECOVERY_ACTIVE: { label: 'Recovery Active', color: '#6366F1', bg: '#EEF2FF' },
  CONTACTED: { label: 'Contacted', color: '#3B82F6', bg: '#EFF6FF' },
  RETRY_SCHEDULED: { label: 'Retry Scheduled', color: '#8B5CF6', bg: '#F5F3FF' },
  RECOVERED: { label: 'Recovered', color: '#10B981', bg: '#ECFDF5' },
  ESCALATED: { label: 'Escalated', color: '#EC4899', bg: '#FDF2F8' },
  STOPPED: { label: 'Stopped', color: '#64748B', bg: '#F8FAFC' },
  FAILED: { label: 'Failed', color: '#991B1B', bg: '#FEF2F2' },
}

export const RISK_LEVEL_CONFIG = {
  LOW: { label: 'Low Risk', color: '#10B981', bg: '#ECFDF5' },
  MEDIUM: { label: 'Medium Risk', color: '#F59E0B', bg: '#FFFBEB' },
  HIGH: { label: 'High Risk', color: '#EF4444', bg: '#FEF2F2' },
}

export const CHANNEL_CONFIG = {
  EMAIL: { label: 'Email', icon: 'Mail', color: '#2563EB' },
  IN_APP: { label: 'In-App', icon: 'Bell', color: '#7C3AED' },
  VOICE: { label: 'Voice (AI)', icon: 'Phone', color: '#059669' },
  NONE: { label: 'None', icon: 'Slash', color: '#64748B' },
}
