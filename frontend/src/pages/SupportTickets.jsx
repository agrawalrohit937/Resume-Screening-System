/**
 * SupportTickets Page — /support
 * Shows all user's support tickets in a table with status, priority, and actions
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LifeBuoy,
  MessageCircle,
  ChevronRight,
  Search,
  Clock,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  CreditCard,
  UserCircle,
  FileText,
  Sparkles,
  Bug,
  Lightbulb,
  HelpCircle,
  Reply,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import {
  getSupportTickets,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  CATEGORY_LABELS,
  RESPONSE_TIMES,
} from '../services/supportApi'
import SupportButton from '../components/support/SupportButton'

const STATUS_FILTERS = [
  { value: '', label: 'All Tickets' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_for_customer', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const CATEGORY_COLORS = {
  billing: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  account: 'text-blue-600 bg-blue-50 border-blue-200',
  resume: 'text-purple-600 bg-purple-50 border-purple-200',
  ai_features: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  bug: 'text-rose-600 bg-rose-50 border-rose-200',
  feature_request: 'text-amber-600 bg-amber-50 border-amber-200',
  other: 'text-slate-600 bg-slate-50 border-slate-200',
}

const CATEGORY_ICONS = {
  billing: CreditCard,
  account: UserCircle,
  resume: FileText,
  ai_features: Sparkles,
  bug: Bug,
  feature_request: Lightbulb,
  other: HelpCircle,
}

function getRelativeTime(dateStr) {
  if (!dateStr) return ''
  try {
    const now = new Date()
    const d = new Date(dateStr)
    const diffMs = now - d
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
  } catch {
    return ''
  }
}

function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
  )
}

export default function SupportTickets() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const plan = (user?.plan || 'free').toLowerCase()
  const responseTime = RESPONSE_TIMES[plan] || '24-48 Hours'

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [pagination, setPagination] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const fetchTickets = useCallback(async (status = statusFilter) => {
    setLoading(true)
    setError(null)
    try {
      const params = { page: 1, page_size: 50 }
      if (status) params.status = status
      const result = await getSupportTickets(params)
      setTickets(result.tickets || [])
      setPagination(result.pagination || null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load support tickets.')
      setTickets([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchTickets()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (newStatus) => {
    setStatusFilter(newStatus)
    fetchTickets(newStatus)
  }

  const handleCopyId = (ticketId) => {
    navigator.clipboard.writeText(ticketId)
    setCopiedId(ticketId)
    toast.success('Ticket ID copied!')
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Filter tickets by search query
  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return tickets
    const q = searchQuery.toLowerCase()
    return tickets.filter(t => 
      t.ticket_id?.toLowerCase().includes(q) ||
      t.subject?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q) ||
      CATEGORY_LABELS[t.category]?.toLowerCase().includes(q)
    )
  }, [tickets, searchQuery])

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 px-3 sm:px-0 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <LifeBuoy size={18} className="sm:w-5 sm:h-5" strokeWidth={2} />
              </div>
              <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">My Support Tickets</h1>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Track and manage your support requests — avg. response time:{' '}
              <span className="font-bold text-slate-700">{responseTime}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={() => fetchTickets()}
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all shrink-0"
              title="Refresh tickets"
              aria-label="Refresh tickets"
            >
              <RefreshCw size={16} strokeWidth={2.5} />
            </button>
            <div className="flex-1 sm:flex-none">
              <SupportButton variant="primary" label="New Ticket" className="w-full sm:w-auto" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Status Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 sm:pb-2 no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0"
      >
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`shrink-0 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all ${
              statusFilter === f.value
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </motion.div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
      >
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" strokeWidth={2.5} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Ticket ID, subject, or category..."
            className="w-full h-10 sm:h-11 pl-10 pr-10 rounded-xl bg-white border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-base font-bold transition-all"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </motion.div>

      {/* Tickets List */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 sm:h-24 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mb-3 sm:mb-4">
              <AlertCircle size={24} className="text-rose-500 sm:w-7 sm:h-7" />
            </div>
            <p className="text-base font-bold text-slate-900 mb-1">Failed to load tickets</p>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mb-4 max-w-md">{error}</p>
            <button
              onClick={() => fetchTickets()}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm"
            >
              Try Again
            </button>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3 sm:mb-4">
              {searchQuery ? (
                <Search size={28} className="text-slate-300 sm:w-8 sm:h-8" strokeWidth={1.5} />
              ) : (
                <MessageCircle size={28} className="text-slate-300 sm:w-8 sm:h-8" strokeWidth={1.5} />
              )}
            </div>
            <p className="text-base sm:text-lg font-black text-slate-900 mb-1">
              {searchQuery ? 'No matching tickets' : 'No tickets yet'}
            </p>
            <p className="text-xs sm:text-sm font-medium text-slate-500 max-w-sm mb-5">
              {searchQuery
                ? `No results for "${searchQuery}". Try a different search term.`
                : statusFilter
                  ? `No ${STATUS_FILTERS.find((f) => f.value === statusFilter)?.label?.toLowerCase()} tickets found.`
                  : "You haven't created any support tickets. We're here to help!"}
            </p>
            {!searchQuery && <SupportButton variant="primary" label="Create Your First Ticket" />}
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {filteredTickets.map((ticket, idx) => {
              const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open
              const priorityConf = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.low
              const categoryLabel = CATEGORY_LABELS[ticket.category] || ticket.category
              const relativeTime = getRelativeTime(ticket.created_at)

              return (
                <motion.button
                  key={ticket.id || ticket.ticket_id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => navigate(`/support/${ticket.ticket_id}`)}
                  className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 p-3.5 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-all text-left group overflow-hidden"
                >
                  {/* Mobile Top Row / Desktop Left Section */}
                  <div className="flex items-center justify-between sm:hidden w-full">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${statusConf.dot}`} />
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${statusConf.color}`}>
                        {statusConf.label}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${priorityConf.color}`}>
                        {priorityConf.label}
                      </span>
                    </div>
                    {relativeTime && (
                      <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                        <Clock size={10} />
                        {relativeTime}
                      </span>
                    )}
                  </div>

                  {/* Desktop Status Badge */}
                  <div className="hidden sm:flex items-center gap-2 w-32 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${statusConf.dot}`} />
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${statusConf.color}`}>
                      {statusConf.label}
                    </span>
                  </div>

                  {/* Ticket Main Info */}
                  <div className="flex-1 min-w-0 w-full">
                    <div className="hidden sm:flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono font-bold text-slate-400">{ticket.ticket_id}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${priorityConf.color}`}>
                        {priorityConf.label}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 sm:truncate group-hover:text-indigo-700 transition-colors break-words">
                      {ticket.subject}
                    </p>
                    <div className="flex items-center gap-2 mt-1 sm:mt-0.5 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-slate-400 sm:hidden">
                        {ticket.ticket_id}
                      </span>
                      <span className="text-[10px] sm:text-xs font-medium text-slate-500 truncate">
                        {categoryLabel}
                        {ticket.subcategory && ` · ${ticket.subcategory.replace(/_/g, ' ')}`}
                      </span>
                    </div>
                  </div>

                  {/* Date & Arrow (Desktop) / Arrow (Mobile) */}
                  <div className="flex items-center justify-end sm:justify-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="hidden sm:block text-right">
                      <p className="text-[10px] font-bold text-slate-500">{relativeTime}</p>
                    </div>
                    <div className="w-6 h-6 rounded-lg bg-slate-50 sm:bg-transparent flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                      <ChevronRight
                        size={15}
                        className="group-hover:translate-x-0.5 transition-transform"
                        strokeWidth={2.5}
                      />
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <span className="text-xs font-medium text-slate-500">
              Page {pagination.page} of {pagination.total_pages} ({pagination.total} total)
            </span>
          </div>
        )}
      </motion.div>
    </div>
  )
}

