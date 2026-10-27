/**
 * TicketDetail Page — /support/:id
 * Premium SaaS Support Ticket View (Linear / GitHub Issues / Zendesk aesthetic)
 * 2-Column layout with opening issue card, live activity timeline, reply composer, and metadata SLA sidebar
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  LifeBuoy,
  Clock,
  Paperclip,
  Send,
  Download,
  CheckCircle2,
  AlertCircle,
  User,
  Bot,
  ExternalLink,
  MoreHorizontal,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  Shield,
  HelpCircle,
  FileText,
  CornerDownLeft,
  MessageCircle,
  Bug,
  CreditCard,
  Lightbulb,
  ShieldCheck,
  ChevronDown,
  Info,
  Calendar,
  Share2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import {
  getSupportTicket,
  replyToSupportTicket,
  updateTicketStatus,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  CATEGORY_LABELS,
  RESPONSE_TIMES,
} from '../services/supportApi'
import { formatDate, formatDateTime } from '../utils/formatters'

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
    return formatDate(dateStr)
  } catch {
    return ''
  }
}

const CATEGORY_ICONS = {
  billing: CreditCard,
  account: User,
  resume: FileText,
  ai_features: Sparkles,
  bug: Bug,
  feature_request: Lightbulb,
  other: HelpCircle,
}

export default function TicketDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const replyRef = useRef(null)
  const messagesEndRef = useRef(null)

  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replyFiles, setReplyFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const userRoles = useMemo(() => {
    return [
      ...(Array.isArray(user?.roles) ? user.roles : []),
      user?.role,
    ].filter(Boolean).map((r) => String(r).toLowerCase().trim())
  }, [user])

  const isAdmin = userRoles.includes('admin') || userRoles.includes('platform_admin')
  const isEnterprise =
    user?.plan === 'enterprise' ||
    userRoles.some((r) =>
      ['recruiter', 'admin', 'platform_admin', 'executive', 'exec', 'hiring_manager'].includes(r)
    )

  const fetchTicket = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setIsRefreshing(true)
    setError(null)
    try {
      const result = await getSupportTicket(id)
      setTicket(result)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load ticket.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [id])

  useEffect(() => {
    fetchTicket()
  }, [fetchTicket])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (ticket?.messages?.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [ticket?.messages?.length])

  const handleReply = async (e) => {
    if (e) e.preventDefault()
    if (!replyText.trim() && replyFiles.length === 0) return

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('body', replyText.trim())
      replyFiles.forEach((f) => formData.append('attachments', f))

      const updated = await replyToSupportTicket(id, formData)
      setTicket(updated)
      setReplyText('')
      setReplyFiles([])
      toast.success('Reply posted successfully!')

      // Dispatch global ticket created event so ticket lists refresh if needed
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('careershala:ticket-created', { detail: updated }))
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send reply.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (replyText.trim() || replyFiles.length > 0) {
        handleReply()
      }
    }
  }

  const handleStatusChange = async (newStatus) => {
    setStatusMenuOpen(false)
    try {
      const updated = await updateTicketStatus(id, newStatus)
      setTicket(updated)
      toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('careershala:ticket-created', { detail: updated }))
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update status.')
    }
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    setReplyFiles((prev) => [...prev, ...files].slice(0, 5))
    e.target.value = ''
  }

  const copyTicketId = () => {
    if (!ticket?.ticket_id) return
    navigator.clipboard.writeText(ticket.ticket_id)
    setCopiedId(true)
    toast.success('Ticket ID copied to clipboard!')
    setTimeout(() => setCopiedId(false), 2000)
  }

  const copyTicketLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    toast.success('Ticket link copied to clipboard!')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 animate-pulse py-4">
        <div className="h-10 w-40 bg-slate-200/70 rounded-xl" />
        <div className="h-28 bg-white border border-slate-200 rounded-3xl p-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-60 bg-white border border-slate-200 rounded-3xl" />
            <div className="h-44 bg-white border border-slate-200 rounded-3xl" />
          </div>
          <div className="space-y-4">
            <div className="h-64 bg-white border border-slate-200 rounded-3xl" />
            <div className="h-40 bg-white border border-slate-200 rounded-3xl" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-4 shadow-sm text-rose-500">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-1.5">Ticket Not Found</h2>
        <p className="text-sm font-medium text-slate-500 mb-6 max-w-md">
          {error || 'This ticket could not be found or you may not have permission to access it.'}
        </p>
        <button
          onClick={() => navigate('/support')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all shadow-sm"
        >
          <ArrowLeft size={16} />
          Back to Support Tickets
        </button>
      </div>
    )
  }

  const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open
  const priorityConf = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.low
  const CategoryIcon = CATEGORY_ICONS[ticket.category] || HelpCircle
  const categoryLabel = CATEGORY_LABELS[ticket.category] || ticket.category
  const messages = ticket.messages || []
  const attachments = ticket.attachments || []
  const canResolve = ticket.status !== 'resolved' && ticket.status !== 'closed'
  const canReopen = ticket.status === 'resolved' || ticket.status === 'closed'
  const slaResponseTime = isEnterprise ? '< 30 Minutes' : (RESPONSE_TIMES[ticket.plan] || '24-48 Hours')

  // Creator details
  const creatorName = ticket.author_name || user?.full_name || 'Requester'
  const creatorInitials = (creatorName.trim()[0] || 'U').toUpperCase()

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* 1. Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <button
          onClick={() => navigate('/support')}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5 rounded-xl hover:bg-slate-100/80 w-fit select-none"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          <span>All Support Tickets</span>
        </button>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <button
            onClick={() => fetchTicket(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-xs"
            title="Refresh ticket"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-indigo-600' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={copyTicketLink}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-xs"
            title="Share ticket link"
          >
            {copiedLink ? <Check size={14} className="text-emerald-600" /> : <Share2 size={14} />}
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* Quick Mark as Resolved */}
          {canResolve && (
            <button
              onClick={() => handleStatusChange('resolved')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-all shadow-xs"
            >
              <CheckCircle2 size={14} strokeWidth={2.5} />
              <span>Mark Resolved</span>
            </button>
          )}

          {/* Internal workflow status controls are only for support administrators. */}
          {isAdmin && (
            <div className="relative">
              <button
                onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
              >
                <span className={`w-2 h-2 rounded-full ${statusConf.dot}`} />
                <span>{statusConf.label}</span>
                <ChevronDown size={14} className={`transition-transform ${statusMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {statusMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setStatusMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-40 p-1.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Change Status
                    </div>
                    {Object.entries(STATUS_CONFIG).map(([key, conf]) => {
                      const isCurrent = key === ticket.status
                      const isDisabled = !isAdmin && (ticket.status === 'resolved' || ticket.status === 'closed') && (key === 'open' || key === 'in_progress')
                      return (
                        <button
                          key={key}
                          onClick={() => !isDisabled && handleStatusChange(key)}
                          disabled={isCurrent || isDisabled}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-left transition-colors ${
                            isCurrent
                              ? 'bg-slate-50 text-slate-400 cursor-default'
                              : isDisabled
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                            <span>{conf.label}</span>
                          </div>
                          {isCurrent && <Check size={14} className="text-slate-400" />}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Primary Ticket Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs relative overflow-hidden"
      >
        <div className="flex flex-col gap-3">
          {/* Metadata Badges Strip */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Ticket ID chip with 1-click copy */}
            <button
              onClick={copyTicketId}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] font-bold transition-all border border-slate-200/80 cursor-pointer group"
              title="Click to copy ticket ID"
            >
              <span>{ticket.ticket_id}</span>
              {copiedId ? (
                <Check size={12} className="text-emerald-600" />
              ) : (
                <Copy size={12} className="text-slate-400 group-hover:text-slate-700" />
              )}
            </button>

            {/* Status Pill */}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${statusConf.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot} animate-pulse`} />
              {statusConf.label}
            </span>

            {/* Priority Pill */}
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${priorityConf.color}`}>
              {priorityConf.label} Priority
            </span>

            {/* Category Pill */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold">
              <CategoryIcon size={12} />
              <span>{categoryLabel}</span>
            </span>

            {ticket.subcategory && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 text-[11px] font-medium border border-slate-200/60">
                {ticket.subcategory.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {/* Ticket Subject (Clean typography, avoids single letter void) */}
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-snug break-words">
            {ticket.subject || 'Support Request'}
          </h1>

          {/* Subtitle with Creator & Time */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 flex-wrap">
            <span>Opened by</span>
            <span className="font-bold text-slate-800">{creatorName}</span>
            <span>·</span>
            <span>{getRelativeTime(ticket.created_at)}</span>
            <span>({formatDateTime(ticket.created_at)})</span>
            {messages.length > 0 && (
              <>
                <span>·</span>
                <span className="font-bold text-indigo-600">
                  {messages.length} {messages.length === 1 ? 'reply' : 'replies'}
                </span>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* 3. Two-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Conversation Timeline & Reply Composer */}
        <div className="flex-1 w-full min-w-0 space-y-6">
          {/* Card 1: Original Post (Opening Ticket Issue) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden"
          >
            {/* Header of Opening Post */}
            <div className="px-5 sm:px-6 py-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-slate-900 to-indigo-900 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                  {creatorInitials}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs sm:text-sm font-black text-slate-900 truncate">
                      {creatorName}
                    </p>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-md">
                      Author
                    </span>
                    {isEnterprise && (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">
                        Enterprise
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-slate-400">
                    Submitted {getRelativeTime(ticket.created_at)} via Web Portal
                  </p>
                </div>
              </div>

              {ticket.os && (
                <span className="hidden sm:inline-block text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                  {ticket.os}
                </span>
              )}
            </div>

            {/* Body of Opening Post */}
            <div className="p-5 sm:p-6 space-y-4">
              <div className="text-sm sm:text-base font-normal text-slate-800 leading-relaxed whitespace-pre-wrap break-words min-h-[48px]">
                {ticket.description || 'No description provided.'}
              </div>

              {/* Attachments (if any) */}
              {attachments.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                    Attached Files ({attachments.length})
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-all group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                            <Paperclip size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                              {att.filename || 'Attachment'}
                            </p>
                            <p className="text-[10px] font-medium text-slate-400">
                              {att.size_bytes ? `${Math.round(att.size_bytes / 1024)} KB` : 'File'}
                            </p>
                          </div>
                        </div>
                        <ExternalLink size={14} className="text-slate-400 group-hover:text-indigo-600 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Activity / Discussion Timeline Divider */}
          <div className="relative flex items-center justify-center py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200/80" />
            </div>
            <div className="relative bg-slate-50 px-4 py-1 rounded-full border border-slate-200 text-xs font-bold text-slate-500 flex items-center gap-1.5 shadow-2xs">
              <MessageCircle size={13} className="text-indigo-600" />
              <span>Conversation & Updates</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <span>{messages.length}</span>
            </div>
          </div>

          {/* 0 Messages State: Friendly Queue Guarantee Banner */}
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/30 p-5 sm:p-6 shadow-xs"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Sparkles size={20} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Ticket in Support Queue
                  </h3>
                  <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
                    Our technical support engineering team has received your ticket and is actively reviewing the details.
                    You will receive instant notifications here and at <span className="font-bold text-slate-800">{ticket.email}</span> when an engineer responds.
                  </p>
                  <div className="pt-2 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                      <Clock size={12} strokeWidth={2.5} />
                      Target First Response: {slaResponseTime}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                      <ShieldCheck size={12} strokeWidth={2.5} />
                      Dedicated Ticket Handler Active
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Messages Thread */}
          {messages.length > 0 && (
            <div className="space-y-4">
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user'
                const isSupport = msg.role === 'support'
                const isSystem = msg.role === 'system'
                const msgAttachments = msg.attachments || []

                if (isSystem) {
                  return (
                    <div key={msg.id || idx} className="flex justify-center my-2">
                      <div className="px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-semibold flex items-center gap-1.5">
                        <Info size={12} className="text-slate-400" />
                        <span>{msg.body}</span>
                        <span className="text-slate-400">· {getRelativeTime(msg.created_at)}</span>
                      </div>
                    </div>
                  )
                }

                return (
                  <motion.div
                    key={msg.id || idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`rounded-3xl border shadow-xs overflow-hidden ${
                      isSupport
                        ? 'bg-gradient-to-b from-indigo-50/40 to-white border-indigo-200/90'
                        : 'bg-white border-slate-200/90'
                    }`}
                  >
                    {/* Message Header */}
                    <div className={`px-5 sm:px-6 py-3.5 border-b flex items-center justify-between gap-3 ${
                      isSupport ? 'bg-indigo-50/70 border-indigo-100' : 'bg-slate-50/60 border-slate-100'
                    }`}>
                      <div className="flex items-center gap-3 min-w-0">
                        {isSupport ? (
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                            <Bot size={15} />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {msg.author_name?.[0]?.toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs sm:text-sm font-black text-slate-900 truncate">
                              {msg.author_name || (isSupport ? 'CareerShala Support Specialist' : 'User')}
                            </p>
                            {isSupport ? (
                              <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1">
                                <ShieldCheck size={10} />
                                Staff
                              </span>
                            ) : (
                              <span className="text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-medium text-slate-400">
                            {getRelativeTime(msg.created_at)} ({formatDateTime(msg.created_at)})
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Message Content */}
                    <div className="p-5 sm:p-6 space-y-3">
                      <div className="text-sm sm:text-base font-normal text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                        {msg.body}
                      </div>

                      {/* Attachments */}
                      {msgAttachments.length > 0 && (
                        <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                          {msgAttachments.map((att, ai) => (
                            <a
                              key={ai}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all"
                            >
                              <Paperclip size={12} className="text-slate-400" />
                              <span className="max-w-[160px] truncate">{att.filename || 'Attachment'}</span>
                              <ExternalLink size={11} className="text-slate-400" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Integrated Reply Composer */}
          {canResolve ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                    {creatorInitials}
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900">
                      Add a Reply
                    </h4>
                    <p className="text-[11px] font-medium text-slate-400">
                      Replying as {creatorName}
                    </p>
                  </div>
                </div>

                <span className="hidden sm:inline-block text-[11px] font-medium text-slate-400">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">Enter</kbd> to send
                </span>
              </div>

              {/* File preview chips */}
              {replyFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {replyFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs font-bold text-indigo-700"
                    >
                      <Paperclip size={12} />
                      <span className="max-w-[140px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setReplyFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="ml-1 text-indigo-400 hover:text-rose-500 transition-colors cursor-pointer"
                        title="Remove file"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleReply} className="space-y-3">
                <textarea
                  ref={replyRef}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Provide additional details, answer follow-up questions, or upload screenshots..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-sm font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all resize-none leading-relaxed"
                />

                <div className="flex items-center justify-between gap-3 pt-1">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer">
                    <Paperclip size={15} strokeWidth={2.2} />
                    <span>Attach Files</span>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.zip"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={submitting || (!replyText.trim() && replyFiles.length === 0)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Reply</span>
                        <Send size={14} strokeWidth={2.5} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-3xl border p-6 text-center space-y-3 ${
                ticket.status === 'resolved'
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${
                  ticket.status === 'resolved' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'
                }`}
              >
                <CheckCircle2 size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">
                  This Ticket is Marked as {statusConf.label}
                </h4>
                <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1 max-w-md mx-auto">
                  {ticket.resolved_at
                    ? `Resolved on ${formatDateTime(ticket.resolved_at)}. We hope your issue was completely addressed!`
                    : ticket.closed_at
                      ? `Closed on ${formatDateTime(ticket.closed_at)}.`
                      : 'This ticket has been concluded.'}
                </p>
              </div>

              {/* If user needs more help, allow sending a follow up or reopening */}
              <div className="pt-2">
                <button
                  onClick={() => canReopen && handleStatusChange('open')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs"
                >
                  <RefreshCw size={14} />
                  <span>Reopen This Ticket</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column: Metadata & SLA Sidebar */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          {/* Card A: Ticket Information */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <FileText size={16} className="text-indigo-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Ticket Details
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Ticket Status
                </p>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold border ${statusConf.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
                    {statusConf.label}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => setStatusMenuOpen(true)}
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Priority
                </p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-bold border ${priorityConf.color}`}>
                    {priorityConf.label} Priority
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Category
                </p>
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <CategoryIcon size={13} className="text-indigo-600" />
                  <span>{categoryLabel}</span>
                </p>
                {ticket.subcategory && (
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                    Sub: {ticket.subcategory.replace(/_/g, ' ')}
                  </p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Requester
                </p>
                <p className="font-bold text-slate-800 truncate">{creatorName}</p>
                <p className="text-[11px] font-medium text-slate-500 truncate">{ticket.email}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Created Date
                </p>
                <p className="font-bold text-slate-800 flex items-center gap-1">
                  <Calendar size={13} className="text-slate-400" />
                  <span>{formatDate(ticket.created_at)}</span>
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  {formatDateTime(ticket.created_at)}
                </p>
              </div>

              {ticket.updated_at && ticket.updated_at !== ticket.created_at && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Last Activity
                  </p>
                  <p className="font-bold text-slate-800">{getRelativeTime(ticket.updated_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Card B: SLA & Priority Support Guarantee */}
          <div className="bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/40 rounded-3xl border border-indigo-100 p-5 shadow-xs space-y-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-indigo-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                SLA Guarantee
              </h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Service Plan</span>
                <span className="font-black text-slate-900 uppercase">
                  {isEnterprise ? 'Enterprise' : (ticket.plan || 'Standard')}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Response SLA</span>
                <span className="font-black text-indigo-600">{slaResponseTime}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Support Queue</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>
            </div>

            <p className="text-[11px] font-medium text-slate-500 leading-relaxed pt-2 border-t border-indigo-100/80">
              {isEnterprise
                ? 'Your request is prioritized with dedicated 24/7 senior technical escalation.'
                : 'Need immediate response? Upgrade to Enterprise for guaranteed sub-30 minute SLA.'}
            </p>
          </div>

          {/* Card C: Helpful Links */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Need More Assistance?
            </h3>
            <div className="space-y-2 text-xs">
              <button
                onClick={() => navigate('/support')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 font-bold transition-colors text-left"
              >
                <span>View All Tickets</span>
                <ArrowLeft size={13} className="rotate-180 text-slate-400" />
              </button>
              <button
                onClick={copyTicketId}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 font-bold transition-colors text-left"
              >
                <span>Copy Reference ID</span>
                <Copy size={13} className="text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
