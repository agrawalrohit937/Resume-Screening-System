/**
 * TicketDetail Page — /support/:id
 * Full conversation timeline with replies, attachments, and status tracking
 * Looks similar to GitHub Issues / Zendesk
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
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
} from '../services/supportApi'

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
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
    return formatDate(dateStr)
  } catch {
    return ''
  }
}

function getFileIcon(filename) {
  const ext = filename?.split('.').pop()?.toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['zip', 'rar', '7z'].includes(ext)) return 'archive'
  return 'file'
}

export default function TicketDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const replyRef = useRef(null)
  const messagesEndRef = useRef(null)

  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replyFiles, setReplyFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)

  const fetchTicket = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getSupportTicket(id)
      setTicket(result)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load ticket.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchTicket()
  }, [fetchTicket])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ticket?.messages])

  const handleReply = async (e) => {
    e.preventDefault()
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
      toast.success('Reply sent successfully!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send reply.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (newStatus) => {
    setStatusMenuOpen(false)
    try {
      const updated = await updateTicketStatus(id, newStatus)
      setTicket(updated)
      toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update status.')
    }
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    setReplyFiles((prev) => [...prev, ...files].slice(0, 3))
    e.target.value = ''
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-12 w-48 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-4">
          <AlertCircle size={32} className="text-rose-500" />
        </div>
        <p className="text-lg font-black text-slate-900 mb-1">Ticket not found</p>
        <p className="text-sm font-medium text-slate-500 mb-6">{error || 'This ticket does not exist or you do not have access.'}</p>
        <button
          onClick={() => navigate('/support')}
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors"
        >
          Back to Tickets
        </button>
      </div>
    )
  }

  const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open
  const priorityConf = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.low
  const messages = ticket.messages || []
  const attachments = ticket.attachments || []
  const canResolve = ticket.status !== 'resolved' && ticket.status !== 'closed'

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Back button */}
      <button
        onClick={() => navigate('/support')}
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft size={16} strokeWidth={2.5} />
        Back to all tickets
      </button>

      {/* Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      >
        {/* Status bar */}
        <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-b border-slate-100">
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold ${statusConf.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
            {statusConf.label}
          </span>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${priorityConf.color}`}>
            {priorityConf.label} Priority
          </span>
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 ml-auto">
            <Clock size={12} />
            {formatDate(ticket.created_at)}
          </div>

          {/* Status Actions */}
          <div className="relative">
            <button
              onClick={() => setStatusMenuOpen(!statusMenuOpen)}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <MoreHorizontal size={14} strokeWidth={2.5} />
            </button>

            {statusMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-20">
                {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
                  <button
                    key={key}
                    onClick={() => handleStatusChange(key)}
                    disabled={key === ticket.status}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-left transition-colors
                      ${key === ticket.status ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'hover:bg-slate-50 text-slate-700'}
                    `}
                  >
                    <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                    {conf.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ticket Info */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              {ticket.ticket_id}
            </span>
            {ticket.category && (
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                {CATEGORY_LABELS[ticket.category] || ticket.category}
              </span>
            )}
          </div>
          <h1 className="text-xl font-black text-slate-900 mb-2">{ticket.subject}</h1>
          <p className="text-sm font-medium text-slate-600 whitespace-pre-wrap">{ticket.description}</p>
        </div>

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="px-6 pb-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Attachments</p>
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, idx) => (
                <a
                  key={idx}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all group"
                >
                  <Paperclip size={12} className="text-slate-400" />
                  <span className="max-w-[150px] truncate">{att.filename || 'Attachment'}</span>
                  <ExternalLink size={10} className="text-slate-300 group-hover:text-indigo-500" />
                </a>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Conversation Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user'
          const isSupport = msg.role === 'support'
          const msgAttachments = msg.attachments || []

          return (
            <div
              key={msg.id || idx}
              className={`flex gap-3 ${isSupport ? 'justify-start' : 'justify-end'}`}
            >
              {/* Avatar */}
              {isSupport && (
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-1 border border-indigo-100">
                  <Bot size={16} strokeWidth={2} />
                </div>
              )}

              <div className={`max-w-[80%] ${isUser ? 'order-1' : ''}`}>
                {/* Message Bubble */}
                <div
                  className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    isUser
                      ? 'bg-slate-900 text-white rounded-tr-sm'
                      : isSupport
                        ? 'bg-indigo-50 text-slate-700 border border-indigo-100 rounded-tl-sm'
                        : 'bg-slate-50 text-slate-500 border border-slate-100 rounded-tl-sm italic'
                  }`}
                >
                  {msg.body}
                </div>

                {/* Message Attachments */}
                {msgAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msgAttachments.map((att, ai) => (
                      <a
                        key={ai}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[10px] font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-600 transition-all"
                      >
                        <Paperclip size={10} />
                        {att.filename || 'Attachment'}
                      </a>
                    ))}
                  </div>
                )}

                {/* Message Meta */}
                <div className={`flex items-center gap-2 mt-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-[10px] font-medium text-slate-400">
                    {msg.author_name || (isUser ? 'You' : 'Support')}
                  </span>
                  <span className="text-[9px] font-medium text-slate-300">·</span>
                  <span className="text-[10px] font-medium text-slate-400">
                    {getRelativeTime(msg.created_at)}
                  </span>
                </div>
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 mt-1">
                  <User size={16} strokeWidth={2} />
                </div>
              )}
            </div>
          )
        })}

        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </motion.div>

      {/* Reply Box */}
      {canResolve && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
        >
          {/* File Preview */}
          {replyFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {replyFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-medium text-slate-600"
                >
                  <Paperclip size={10} />
                  <span className="max-w-[100px] truncate">{file.name}</span>
                  <button
                    onClick={() => setReplyFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-rose-500 ml-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleReply} className="flex items-end gap-2">
            <div className="flex-1">
              <textarea
                ref={replyRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply here..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all resize-none"
              />
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <label className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-600 transition-all cursor-pointer">
                <Paperclip size={16} strokeWidth={2} />
                <input type="file" multiple onChange={handleFileSelect} className="hidden" accept=".png,.jpg,.jpeg,.gif,.pdf,.zip" />
              </label>
              <button
                type="submit"
                disabled={submitting || (!replyText.trim() && replyFiles.length === 0)}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {submitting ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <Send size={16} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Resolved/Closed Banner */}
      {!canResolve && (
        <div className={`rounded-2xl border p-5 text-center ${
          ticket.status === 'resolved'
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${
            ticket.status === 'resolved' ? 'bg-emerald-100' : 'bg-slate-200'
          }`}>
            <CheckCircle2 size={24} className={
              ticket.status === 'resolved' ? 'text-emerald-600' : 'text-slate-400'
            } />
          </div>
          <p className="text-sm font-bold text-slate-900">
            This ticket is {ticket.status === 'resolved' ? 'Resolved' : 'Closed'}
          </p>
          <p className="text-xs font-medium text-slate-500 mt-1">
            {ticket.resolved_at
              ? `Resolved on ${formatDate(ticket.resolved_at)}`
              : ticket.closed_at
                ? `Closed on ${formatDate(ticket.closed_at)}`
                : 'No further replies can be added.'}
          </p>
        </div>
      )}
    </div>
  )
}

