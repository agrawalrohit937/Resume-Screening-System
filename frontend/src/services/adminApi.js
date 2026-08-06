/**
 * Admin API Service
 * Handles all admin dashboard API calls — support tickets, career applications, stats
 */
import api from './api'

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export const getAdminDashboardStats = async () => {
  const { data } = await api.get('/admin/dashboard/stats')
  return data
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPORT TICKETS
// ═══════════════════════════════════════════════════════════════════════════════

export const getAdminTickets = async (params = {}) => {
  const { data } = await api.get('/admin/support/tickets', { params })
  return data
}

export const getAdminTicketDetail = async (ticketId) => {
  const { data } = await api.get(`/admin/support/tickets/${ticketId}`)
  return data
}

export const updateAdminTicketStatus = async (ticketId, status) => {
  const { data } = await api.patch(`/admin/support/tickets/${ticketId}/status`, { status })
  return data
}

export const getAdminTicketStats = async () => {
  const { data } = await api.get('/admin/support/stats')
  return data
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAREER APPLICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const getAdminApplications = async (params = {}) => {
  const { data } = await api.get('/admin/careers/applications', { params })
  return data
}

export const getAdminApplicationDetail = async (appId) => {
  const { data } = await api.get(`/admin/careers/applications/${appId}`)
  return data
}

export const updateAdminApplicationStatus = async (appId, status, adminNotes = null) => {
  const payload = { status }
  if (adminNotes !== null) payload.admin_notes = adminNotes
  const { data } = await api.patch(`/admin/careers/applications/${appId}/status`, payload)
  return data
}

export const getAdminCareerStats = async () => {
  const { data } = await api.get('/admin/careers/stats')
  return data
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const TICKET_STATUSES = [
  { value: 'open', label: 'Open', color: '#3B82F6', bg: '#EFF6FF' },
  { value: 'in_progress', label: 'In Progress', color: '#F59E0B', bg: '#FFFBEB' },
  { value: 'waiting_for_customer', label: 'Waiting', color: '#8B5CF6', bg: '#F5F3FF' },
  { value: 'resolved', label: 'Resolved', color: '#10B981', bg: '#ECFDF5' },
  { value: 'closed', label: 'Closed', color: '#64748B', bg: '#F8FAFC' },
]

export const APP_STATUSES = [
  { value: 'applied', label: 'Applied', color: '#3B82F6', bg: '#EFF6FF' },
  { value: 'shortlisted', label: 'Shortlisted', color: '#F59E0B', bg: '#FFFBEB' },
  { value: 'interviewed', label: 'Interviewed', color: '#8B5CF6', bg: '#F5F3FF' },
  { value: 'rejected', label: 'Rejected', color: '#EF4444', bg: '#FEF2F2' },
  { value: 'hired', label: 'Hired', color: '#10B981', bg: '#ECFDF5' },
]

export const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low', color: '#64748B' },
  { value: 'medium', label: 'Medium', color: '#3B82F6' },
  { value: 'high', label: 'High', color: '#F59E0B' },
  { value: 'critical', label: 'Critical', color: '#EF4444' },
]
