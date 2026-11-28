/**
 * TicketForm — Clean Support Ticket Creation Form
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  AlertTriangle,
  ArrowLeft,
  Flag,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { createSupportTicket } from '../../services/supportApi'

const PRIORITIES = [
  {
    value: 'low',
    label: 'Low',
    description: 'General inquiry / Feedback',
    dot: 'bg-emerald-500',
    activeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-300',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Minor issue / Non-blocking',
    dot: 'bg-blue-500',
    activeBg: 'bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-300',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Blocking work or recruitment',
    dot: 'bg-amber-500',
    activeBg: 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-300',
  },
  {
    value: 'critical',
    label: 'Critical',
    description: 'System down / Payment failure',
    dot: 'bg-rose-500',
    activeBg: 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-300',
    premiumOnly: true,
  },
]

export default function TicketForm({ category = 'other', onSuccess, onBack }) {
  const { user } = useAuth()

  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('low')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const userRoles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
  ].filter(Boolean).map((r) => String(r).toLowerCase().trim())

  const isPremium =
    user?.plan === 'premium' ||
    user?.plan === 'enterprise' ||
    userRoles.some((r) =>
      ['recruiter', 'admin', 'platform_admin', 'executive', 'exec'].includes(r)
    )

  const availablePriorities = PRIORITIES.filter((p) => !p.premiumOnly || isPremium)

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    setError(null)

    if (!subject.trim()) {
      setError('Please provide a subject / summary for your ticket.')
      return
    }
    if (!description.trim()) {
      setError('Please provide a detailed description of your issue.')
      return
    }

    setSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('category', category)
      formData.append('subject', subject.trim())
      formData.append('description', description.trim())
      formData.append('priority', priority)

      const result = await createSupportTicket(formData)
      onSuccess(result)
    } catch (err) {
      const msg =
        err.response?.data?.detail || err.message || 'Failed to create support ticket. Please try again.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (subject.trim() && description.trim()) {
        handleSubmit()
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4 text-left">
      {/* 1. Header with Back button and Category indicator */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer shrink-0"
            title="Change Category"
            aria-label="Back to categories"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </button>
          <div className="min-w-0 text-left">
            <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
              Describe Your Issue
            </h3>
            <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5 truncate">
              <span>Category:</span>
              <span className="font-bold text-indigo-600 capitalize bg-indigo-50 px-2 py-0.5 rounded-md">
                {category.replace(/_/g, ' ')}
              </span>
            </p>
          </div>
        </div>

        <span className="text-[11px] font-medium text-slate-400 hidden sm:inline-block">
          Avg. Response: <strong className="text-slate-800 font-bold">{isPremium ? '< 30 Mins' : '24-48 Hrs'}</strong>
        </span>
      </div>

      {/* 2. Hero Subject Input */}
      <div className="space-y-1.5 text-left">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1 text-left">
            <span>Subject / Summary</span>
            <span className="text-rose-500">*</span>
          </label>
          <span className="text-[10px] text-slate-400 font-medium">{subject.length}/200</span>
        </div>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief, clear summary of what happened..."
          className="w-full h-11 px-3.5 sm:px-4 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all text-left"
          maxLength={200}
          required
        />
      </div>

      {/* 3. Priority Segmented Pills */}
      <div className="space-y-1.5 text-left">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 text-left">
          <Flag size={13} className="text-slate-400" />
          <span>Priority Level</span>
        </label>
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/70">
          {availablePriorities.map((p) => {
            const isActive = priority === p.value
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? `${p.activeBg} shadow-2xs border`
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 border border-transparent'
                }`}
                title={p.description}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${p.dot} shrink-0`} />
                <span className="truncate">{p.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 4. Description */}
      <div className="space-y-1.5 text-left">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1 text-left">
            <span>Detailed Description</span>
            <span className="text-rose-500">*</span>
          </label>
          <span className="text-[10px] text-slate-400 font-medium">{description.length}/5000</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100 transition-all text-left">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Please describe your issue in detail..."
            rows={4}
            className="w-full p-3.5 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none resize-none leading-relaxed text-left block"
            maxLength={5000}
            required
          />
        </div>
      </div>

      {/* Error alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-left"
          >
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <p className="text-xs font-semibold break-words">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Modern Action Footer */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 text-left">
          <Sparkles size={13} className="text-indigo-500 shrink-0" />
          <span>Auto-attaches browser diagnostics for faster triage</span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={submitting || !subject.trim() || !description.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.98] cursor-pointer"
          >
            {submitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <span>Submit Ticket</span>
                <Send size={14} strokeWidth={2.5} />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
