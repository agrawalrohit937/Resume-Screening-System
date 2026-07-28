/**
 * Support Ticket API Service
 * Handles all support-related API calls
 */
import api from './api'

/**
 * Create a new support ticket
 */
export const createSupportTicket = async (formData) => {
  const { data } = await api.post('/support/tickets', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // 2 min for large attachments
  })
  return data
}

/**
 * Get all tickets for the current user
 */
export const getSupportTickets = async (params = {}) => {
  const { data } = await api.get('/support/tickets', { params })
  return data
}

/**
 * Get a single ticket by ID
 */
export const getSupportTicket = async (ticketId) => {
  const { data } = await api.get(`/support/tickets/${ticketId}`)
  return data
}

/**
 * Reply to a support ticket
 */
export const replyToSupportTicket = async (ticketId, formData) => {
  const { data } = await api.post(`/support/tickets/${ticketId}/reply`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
  return data
}

/**
 * Update ticket status
 */
export const updateTicketStatus = async (ticketId, status) => {
  const formData = new FormData()
  formData.append('status', status)
  const { data } = await api.patch(`/support/tickets/${ticketId}/status`, formData)
  return data
}

/**
 * Get all support categories
 */
export const getSupportCategories = async () => {
  const { data } = await api.get('/support/categories')
  return data
}

/**
 * Get ticket statistics (admin)
 */
export const getSupportStats = async () => {
  const { data } = await api.get('/support/stats')
  return data
}

/**
 * Auto-collect system metadata for support tickets
 */
export function collectSystemMetadata() {
  return {
    browser: navigator.userAgent,
    os: navigator.platform,
    route: window.location.pathname,
    current_url: window.location.href,
    app_version: '3.0.0',
    login_provider: localStorage.getItem('last_login_method') || 'email',
    device: navigator.maxTouchPoints > 0 ? 'mobile' : 'desktop',
    resolution: `${window.screen.width}x${window.screen.height}`,
    console_errors: JSON.stringify([]), // Can't access actual console errors
    frontend_version: '3.0.0',
    backend_version: '2.0.0',
  }
}

/**
 * Format ticket status for display
 */
export const STATUS_CONFIG = {
  open: {
    label: 'Open',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  waiting_for_customer: {
    label: 'Waiting for Customer',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
  },
  resolved: {
    label: 'Resolved',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  closed: {
    label: 'Closed',
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
}

export const PRIORITY_CONFIG = {
  low: {
    label: 'Low',
    color: 'bg-slate-100 text-slate-600',
  },
  medium: {
    label: 'Medium',
    color: 'bg-blue-100 text-blue-700',
  },
  high: {
    label: 'High',
    color: 'bg-amber-100 text-amber-700',
  },
  critical: {
    label: 'Critical',
    color: 'bg-rose-100 text-rose-700',
  },
}

export const CATEGORY_ICONS = {
  billing: 'CreditCard',
  account: 'UserCircle',
  resume: 'FileText',
  ai_features: 'Sparkles',
  bug: 'Bug',
  feature_request: 'Lightbulb',
  other: 'HelpCircle',
}

export const CATEGORY_LABELS = {
  billing: 'Billing & Payments',
  account: 'Account & Login',
  resume: 'Resume & ATS',
  ai_features: 'AI Features',
  bug: 'Report a Bug',
  feature_request: 'Feature Request',
  other: 'Other',
}

export const SUBCATEGORY_LABELS = {
  upgrade_plan: 'Upgrade Plan',
  cancel_subscription: 'Cancel Subscription',
  refund_request: 'Refund Request',
  failed_payment: 'Failed Payment',
  gst_invoice: 'GST Invoice',
  password_reset: 'Password Reset',
  email_verification: 'Email Verification',
  google_login: 'Google Login',
  github_login: 'GitHub Login',
  linkedin_login: 'LinkedIn Login',
  delete_account: 'Delete Account',
  resume_upload: 'Resume Upload',
  ats_score: 'ATS Score',
  resume_parsing: 'Resume Parsing',
  pdf_generation: 'PDF Generation',
  ai_copilot: 'AI Copilot',
  mock_interview: 'Mock Interview',
  resume_enhancer: 'Resume Enhancer',
  career_recommendations: 'Career Recommendations',
}

export const RESPONSE_TIMES = {
  free: '24-48 Hours',
  pro: '8 Hours',
  premium: '2 Hours',
}

