/**
 * SuccessScreen — Animated success message after ticket submission
 * Shows ticket ID, estimated response time, and next steps
 */
import { motion } from 'framer-motion'
import { CheckCircle2, Clock, ArrowRight, ExternalLink } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { RESPONSE_TIMES } from '../../services/supportApi'

export default function SuccessScreen({ ticketData, onClose, onViewTickets }) {
  const { user } = useAuth()
  const plan = (user?.plan || 'free').toLowerCase()
  const responseTime = RESPONSE_TIMES[plan] || '24-48 Hours'
  const ticket = ticketData?.ticket || {}
  const ticketId = ticket.ticket_id || 'CS-2026-000000'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-center text-center py-6"
    >
      {/* Animated Checkmark */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6"
      >
        <motion.div
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <CheckCircle2 size={48} className="text-emerald-600" strokeWidth={1.5} />
        </motion.div>
      </motion.div>

      {/* Title */}
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-black text-slate-900 mb-2"
      >
        Ticket Created Successfully!
      </motion.h3>

      {/* Ticket ID */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-50 border border-slate-200 rounded-xl px-6 py-3 mb-4"
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Ticket ID</p>
        <p className="text-lg font-black text-slate-900 tracking-tight font-mono">{ticketId}</p>
      </motion.div>

      {/* Response Time */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 mb-6"
      >
        <Clock size={16} className="text-amber-600 shrink-0" strokeWidth={2} />
        <p className="text-xs font-semibold text-amber-800">
          Estimated response time: <span className="font-black">{responseTime}</span>
        </p>
      </motion.div>

      {/* Next Steps */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-xs font-medium text-slate-500 mb-6 max-w-sm"
      >
        Our team will review your request and get back to you at{' '}
        <span className="font-bold text-slate-700">{user?.email}</span>.
        You can also track the status of this ticket in your support dashboard.
      </motion.p>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex flex-col sm:flex-row gap-3 w-full"
      >
        {onViewTickets && (
          <button
            onClick={onViewTickets}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm"
          >
            View My Tickets
            <ArrowRight size={16} strokeWidth={2.5} />
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  )
}

