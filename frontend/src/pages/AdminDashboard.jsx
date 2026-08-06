import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Ticket, Briefcase, Users, TrendingUp,
  Search, Filter, ChevronDown, ChevronLeft, ChevronRight,
  X, ExternalLink, Clock, Mail, Globe, FileText, Eye,
  Shield, UserCircle, UserSearch, AlertCircle, CheckCircle2,
  RefreshCw, MoreHorizontal, MessageSquare, Download,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import {
  getAdminDashboardStats,
  getAdminTickets,
  getAdminTicketDetail,
  updateAdminTicketStatus,
  getAdminApplications,
  getAdminApplicationDetail,
  updateAdminApplicationStatus,
  TICKET_STATUSES,
  APP_STATUSES,
  PRIORITY_LEVELS,
} from '../services/adminApi'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const now = new Date()
  const d = new Date(dateStr)
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return formatDate(dateStr)
}

function StatusBadge({ value, type = 'ticket' }) {
  const list = type === 'ticket' ? TICKET_STATUSES : APP_STATUSES
  const cfg = list.find(s => s.value === value) || { label: value, color: '#64748B', bg: '#F8FAFC' }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border"
      style={{
        color: cfg.color,
        backgroundColor: cfg.bg,
        borderColor: cfg.color + '30',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function PriorityBadge({ value }) {
  const cfg = PRIORITY_LEVELS.find(p => p.value === value) || { label: value, color: '#64748B' }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
      style={{ color: cfg.color, backgroundColor: cfg.color + '15' }}
    >
      {cfg.label}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({ icon: Icon, label, value, color, trend }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-full" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
          <p className="text-3xl font-black text-slate-900 tracking-tight">{value ?? '—'}</p>
          {trend && (
            <p className="mt-1 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {trend}
            </p>
          )}
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: color + '15' }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </motion.div>
  )
}



// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function DetailModal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <h3 className="text-lg font-bold text-slate-900 truncate pr-4">{title}</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS UPDATE DROPDOWN
// ═══════════════════════════════════════════════════════════════════════════════

function StatusDropdown({ current, statuses, onUpdate, loading }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-[11.5px] font-bold text-slate-700 border border-slate-200 transition-all disabled:opacity-50"
      >
        {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <MoreHorizontal className="w-3.5 h-3.5" />}
        Update Status
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-slate-200 shadow-xl z-50 p-1.5"
            >
              {statuses.map(s => (
                <button
                  key={s.value}
                  disabled={s.value === current}
                  onClick={() => { onUpdate(s.value); setOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all ${
                    s.value === current
                      ? 'bg-slate-100 text-slate-400 cursor-default'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                  {s.value === current && <CheckCircle2 className="w-3 h-3 ml-auto text-slate-400" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'tickets', label: 'Support Tickets', icon: Ticket },
  { key: 'applications', label: 'Career Applications', icon: Briefcase },
]

export default function AdminDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // Tickets state
  const [tickets, setTickets] = useState([])
  const [ticketPagination, setTicketPagination] = useState({})
  const [ticketFilters, setTicketFilters] = useState({ status: '', priority: '', search: '', page: 1 })
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [ticketModalOpen, setTicketModalOpen] = useState(false)
  const [updatingTicketStatus, setUpdatingTicketStatus] = useState(false)

  // Applications state
  const [applications, setApplications] = useState([])
  const [appPagination, setAppPagination] = useState({})
  const [appFilters, setAppFilters] = useState({ status: '', search: '', page: 1 })
  const [loadingApps, setLoadingApps] = useState(false)
  const [selectedApp, setSelectedApp] = useState(null)
  const [appModalOpen, setAppModalOpen] = useState(false)
  const [updatingAppStatus, setUpdatingAppStatus] = useState(false)
  const [appNotes, setAppNotes] = useState('')

  // ── Load stats ────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      setLoadingStats(true)
      const data = await getAdminDashboardStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to load stats:', err)
      toast.error('Failed to load dashboard stats')
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  // ── Load tickets ──────────────────────────────────────────────────────────
  const loadTickets = useCallback(async () => {
    try {
      setLoadingTickets(true)
      const params = { page: ticketFilters.page, page_size: 15 }
      if (ticketFilters.status) params.status = ticketFilters.status
      if (ticketFilters.priority) params.priority = ticketFilters.priority
      if (ticketFilters.search) params.search = ticketFilters.search
      const data = await getAdminTickets(params)
      setTickets(data.tickets || [])
      setTicketPagination(data.pagination || {})
    } catch (err) {
      console.error('Failed to load tickets:', err)
      toast.error('Failed to load tickets')
    } finally {
      setLoadingTickets(false)
    }
  }, [ticketFilters])

  useEffect(() => {
    if (activeTab === 'tickets') loadTickets()
  }, [activeTab, loadTickets])

  // ── Load applications ─────────────────────────────────────────────────────
  const loadApplications = useCallback(async () => {
    try {
      setLoadingApps(true)
      const params = { page: appFilters.page, page_size: 15 }
      if (appFilters.status) params.status = appFilters.status
      if (appFilters.search) params.search = appFilters.search
      const data = await getAdminApplications(params)
      setApplications(data.applications || [])
      setAppPagination(data.pagination || {})
    } catch (err) {
      console.error('Failed to load applications:', err)
      toast.error('Failed to load applications')
    } finally {
      setLoadingApps(false)
    }
  }, [appFilters])

  useEffect(() => {
    if (activeTab === 'applications') loadApplications()
  }, [activeTab, loadApplications])

  // ── Ticket actions ────────────────────────────────────────────────────────
  const openTicketDetail = async (ticket) => {
    try {
      const detail = await getAdminTicketDetail(ticket._id)
      setSelectedTicket(detail)
      setTicketModalOpen(true)
    } catch {
      toast.error('Failed to load ticket details')
    }
  }

  const handleUpdateTicketStatus = async (newStatus) => {
    if (!selectedTicket) return
    try {
      setUpdatingTicketStatus(true)
      const updated = await updateAdminTicketStatus(selectedTicket._id, newStatus)
      setSelectedTicket(updated)
      toast.success(`Ticket status updated to "${newStatus.replace(/_/g, ' ')}"`)
      loadTickets()
    } catch (err) {
      toast.error('Failed to update ticket status')
    } finally {
      setUpdatingTicketStatus(false)
    }
  }

  // ── Application actions ───────────────────────────────────────────────────
  const openAppDetail = async (app) => {
    try {
      const detail = await getAdminApplicationDetail(app._id)
      setSelectedApp(detail)
      setAppNotes(detail.admin_notes || '')
      setAppModalOpen(true)
    } catch {
      toast.error('Failed to load application details')
    }
  }

  const handleUpdateAppStatus = async (newStatus) => {
    if (!selectedApp) return
    try {
      setUpdatingAppStatus(true)
      const updated = await updateAdminApplicationStatus(selectedApp._id, newStatus, appNotes || null)
      setSelectedApp(updated)
      toast.success(`Application status updated to "${newStatus}"`)
      loadApplications()
    } catch (err) {
      toast.error('Failed to update application status')
    } finally {
      setUpdatingAppStatus(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-[80vh] pb-8">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Panel</h1>
              <p className="text-[12px] font-semibold text-slate-400">
                Welcome back, {user?.full_name} · <span className="text-indigo-500">Administrator</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-slate-100/80 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12.5px] font-bold transition-all whitespace-nowrap ${
                active
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.key === 'tickets' && stats?.tickets?.total > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[9px] font-bold">{stats.tickets.by_status?.open || 0}</span>
              )}
              {tab.key === 'applications' && stats?.career_applications?.total > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-bold">{stats.career_applications.by_status?.applied || 0}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Overview Tab ────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {loadingStats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Users} label="Total Users" value={stats?.users?.total} color="#6366F1" />
              <StatCard icon={Ticket} label="Open Tickets" value={stats?.tickets?.by_status?.open} color="#3B82F6" />
              <StatCard icon={Briefcase} label="New Applications" value={stats?.career_applications?.by_status?.applied} color="#F59E0B" />
              <StatCard icon={CheckCircle2} label="Resolved Tickets" value={stats?.tickets?.by_status?.resolved} color="#10B981" />
            </div>
          )}

          {/* Quick summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ticket Summary */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-blue-500" /> Support Tickets
                </h3>
                <button
                  onClick={() => setActiveTab('tickets')}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  View All <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-2.5">
                {TICKET_STATUSES.map(s => (
                  <div key={s.value} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-[12.5px] font-semibold text-slate-600">{s.label}</span>
                    </div>
                    <span className="text-[13px] font-bold text-slate-900">
                      {stats?.tickets?.by_status?.[s.value] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Application Summary */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-amber-500" /> Career Applications
                </h3>
                <button
                  onClick={() => setActiveTab('applications')}
                  className="text-[11px] font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1"
                >
                  View All <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-2.5">
                {APP_STATUSES.map(s => (
                  <div key={s.value} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-[12.5px] font-semibold text-slate-600">{s.label}</span>
                    </div>
                    <span className="text-[13px] font-bold text-slate-900">
                      {stats?.career_applications?.by_status?.[s.value] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Support Tickets Tab ─────────────────────────────────────────────── */}
      {activeTab === 'tickets' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by subject, email, ticket ID..."
                value={ticketFilters.search}
                onChange={(e) => setTicketFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[12.5px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
              />
            </div>
            <select
              value={ticketFilters.status}
              onChange={e => setTicketFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer min-w-[130px]"
            >
              <option value="">All Statuses</option>
              {TICKET_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select
              value={ticketFilters.priority}
              onChange={e => setTicketFilters(f => ({ ...f, priority: e.target.value, page: 1 }))}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer min-w-[130px]"
            >
              <option value="">All Priorities</option>
              {PRIORITY_LEVELS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <button
              onClick={loadTickets}
              disabled={loadingTickets}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 transition-all disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loadingTickets ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="text-left px-5 py-3.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Ticket</th>
                    <th className="text-left px-5 py-3.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Subject</th>
                    <th className="text-left px-5 py-3.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="text-left px-5 py-3.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Priority</th>
                    <th className="text-left px-5 py-3.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
                    <th className="text-left px-5 py-3.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingTickets ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : tickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center">
                        <Ticket className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-slate-400">No tickets found</p>
                      </td>
                    </tr>
                  ) : (
                    tickets.map(ticket => (
                      <tr
                        key={ticket._id}
                        onClick={() => openTicketDetail(ticket)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <span className="text-[11.5px] font-bold text-indigo-600 font-mono">{ticket.ticket_id || ticket._id?.slice(-8)}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="text-[12.5px] font-semibold text-slate-900 line-clamp-1 max-w-[280px]">{ticket.subject}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{ticket.email}</p>
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge value={ticket.status} type="ticket" /></td>
                        <td className="px-5 py-3.5"><PriorityBadge value={ticket.priority} /></td>
                        <td className="px-5 py-3.5">
                          <span className="text-[11.5px] font-semibold text-slate-500 capitalize">{ticket.category?.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[11.5px] font-medium text-slate-400">{timeAgo(ticket.created_at)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {ticketPagination.total_pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <span className="text-[11px] font-semibold text-slate-400">
                  Page {ticketPagination.page} of {ticketPagination.total_pages} · {ticketPagination.total} total
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={!ticketPagination.has_prev}
                    onClick={() => setTicketFilters(f => ({ ...f, page: f.page - 1 }))}
                    className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={!ticketPagination.has_next}
                    onClick={() => setTicketFilters(f => ({ ...f, page: f.page + 1 }))}
                    className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Career Applications Tab ─────────────────────────────────────────── */}
      {activeTab === 'applications' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, role..."
                value={appFilters.search}
                onChange={(e) => setAppFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[12.5px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
              />
            </div>
            <select
              value={appFilters.status}
              onChange={e => setAppFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer min-w-[140px]"
            >
              <option value="">All Statuses</option>
              {APP_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button
              onClick={loadApplications}
              disabled={loadingApps}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 transition-all disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loadingApps ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="text-left px-5 py-3.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Applicant</th>
                    <th className="text-left px-5 py-3.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Position</th>
                    <th className="text-left px-5 py-3.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="text-left px-5 py-3.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Resume</th>
                    <th className="text-left px-5 py-3.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Applied</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingApps ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(5)].map((_, j) => (
                          <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : applications.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center">
                        <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-slate-400">No applications found</p>
                      </td>
                    </tr>
                  ) : (
                    applications.map(app => (
                      <tr
                        key={app._id}
                        onClick={() => openAppDetail(app)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <p className="text-[12.5px] font-bold text-slate-900">{app.applicant_name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{app.email}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[12.5px] font-semibold text-slate-700 line-clamp-1 max-w-[240px]">{app.role_title}</span>
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge value={app.status} type="application" /></td>
                        <td className="px-5 py-3.5">
                          {app.resume_url ? (
                            <a
                              href={app.resume_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                            >
                              <Download className="w-3 h-3" /> Download
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">None</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[11.5px] font-medium text-slate-400">{timeAgo(app.created_at)}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {appPagination.total_pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <span className="text-[11px] font-semibold text-slate-400">
                  Page {appPagination.page} of {appPagination.total_pages} · {appPagination.total} total
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={!appPagination.has_prev}
                    onClick={() => setAppFilters(f => ({ ...f, page: f.page - 1 }))}
                    className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={!appPagination.has_next}
                    onClick={() => setAppFilters(f => ({ ...f, page: f.page + 1 }))}
                    className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TICKET DETAIL MODAL                                                   */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <DetailModal
        isOpen={ticketModalOpen}
        onClose={() => { setTicketModalOpen(false); setSelectedTicket(null) }}
        title={`Ticket: ${selectedTicket?.ticket_id || selectedTicket?._id?.slice(-8) || ''}`}
      >
        {selectedTicket && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <StatusBadge value={selectedTicket.status} type="ticket" />
                <PriorityBadge value={selectedTicket.priority} />
              </div>
              <StatusDropdown
                current={selectedTicket.status}
                statuses={TICKET_STATUSES}
                onUpdate={handleUpdateTicketStatus}
                loading={updatingTicketStatus}
              />
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <h4 className="text-base font-bold text-slate-900">{selectedTicket.subject}</h4>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <span className="font-bold text-slate-400">Email</span>
                  <p className="font-semibold text-slate-700 mt-0.5">{selectedTicket.email}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-400">Category</span>
                  <p className="font-semibold text-slate-700 mt-0.5 capitalize">{selectedTicket.category?.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-400">Plan</span>
                  <p className="font-semibold text-slate-700 mt-0.5 capitalize">{selectedTicket.plan || 'Free'}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-400">Created</span>
                  <p className="font-semibold text-slate-700 mt-0.5">{formatDateTime(selectedTicket.created_at)}</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
              <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap bg-white border border-slate-100 rounded-xl p-4">{selectedTicket.description}</p>
            </div>

            {(selectedTicket.browser || selectedTicket.os) && (
              <div>
                <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2">Debug Info</h4>
                <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                  {selectedTicket.browser && (
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <span className="font-bold text-slate-400">Browser</span>
                      <p className="font-medium text-slate-600 mt-0.5 break-all">{selectedTicket.browser}</p>
                    </div>
                  )}
                  {selectedTicket.os && (
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <span className="font-bold text-slate-400">OS</span>
                      <p className="font-medium text-slate-600 mt-0.5">{selectedTicket.os}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Conversation timeline */}
            {selectedTicket.messages?.length > 0 && (
              <div>
                <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" /> Conversation ({selectedTicket.messages.length})
                </h4>
                <div className="space-y-3">
                  {selectedTicket.messages.map((msg, i) => (
                    <div key={msg.id || i} className={`rounded-xl p-3 text-[12.5px] ${msg.role === 'support' ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50 border border-slate-100'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-slate-700 capitalize">{msg.role === 'support' ? '🛡️ Support' : '👤 User'}</span>
                        <span className="text-[10px] text-slate-400">{formatDateTime(msg.created_at)}</span>
                      </div>
                      <p className="text-slate-600 whitespace-pre-wrap">{msg.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DetailModal>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* APPLICATION DETAIL MODAL                                              */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <DetailModal
        isOpen={appModalOpen}
        onClose={() => { setAppModalOpen(false); setSelectedApp(null) }}
        title={`Application: ${selectedApp?.applicant_name || ''}`}
      >
        {selectedApp && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <StatusBadge value={selectedApp.status} type="application" />
              <StatusDropdown
                current={selectedApp.status}
                statuses={APP_STATUSES}
                onUpdate={handleUpdateAppStatus}
                loading={updatingAppStatus}
              />
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <span className="font-bold text-slate-400">Full Name</span>
                  <p className="font-bold text-slate-900 mt-0.5 text-sm">{selectedApp.applicant_name}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-400">Email</span>
                  <p className="font-semibold text-blue-600 mt-0.5">
                    <a href={`mailto:${selectedApp.email}`}>{selectedApp.email}</a>
                  </p>
                </div>
                <div>
                  <span className="font-bold text-slate-400">Position</span>
                  <p className="font-semibold text-slate-700 mt-0.5">{selectedApp.role_title}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-400">Applied On</span>
                  <p className="font-semibold text-slate-700 mt-0.5">{formatDateTime(selectedApp.created_at)}</p>
                </div>
              </div>

              {selectedApp.portfolio_url && (
                <div>
                  <span className="text-[12px] font-bold text-slate-400">Portfolio</span>
                  <a
                    href={selectedApp.portfolio_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[12.5px] font-semibold text-blue-600 hover:text-blue-800 mt-0.5"
                  >
                    <Globe className="w-3.5 h-3.5" /> {selectedApp.portfolio_url}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {selectedApp.resume_url && (
                <div>
                  <span className="text-[12px] font-bold text-slate-400">Resume</span>
                  <a
                    href={selectedApp.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[12.5px] font-bold text-blue-600 hover:text-blue-800 mt-0.5"
                  >
                    <FileText className="w-3.5 h-3.5" /> {selectedApp.resume_filename || 'Download Resume'}
                    <Download className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2">Cover Letter</h4>
              <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap bg-white border border-slate-100 rounded-xl p-4">{selectedApp.cover_letter}</p>
            </div>

            <div>
              <h4 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2">Admin Notes</h4>
              <textarea
                value={appNotes}
                onChange={e => setAppNotes(e.target.value)}
                placeholder="Add notes about this candidate..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-[12.5px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all resize-none"
              />
              <button
                onClick={() => handleUpdateAppStatus(selectedApp.status)}
                disabled={updatingAppStatus || appNotes === (selectedApp.admin_notes || '')}
                className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-[11.5px] font-bold hover:bg-indigo-700 disabled:opacity-40 transition-all"
              >
                Save Notes
              </button>
            </div>
          </div>
        )}
      </DetailModal>
    </div>
  )
}
