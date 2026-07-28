/**
 * TicketForm — Full support ticket creation form with priority, attachments, metadata
 */
import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Paperclip,
  X,
  AlertTriangle,
  Upload,
  File,
  Image,
  FileText,
  Archive,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { createSupportTicket, collectSystemMetadata, SUBCATEGORY_LABELS } from '../../services/supportApi'

const PRIORITIES = [
  { value: 'low', label: 'Low', description: 'General inquiry', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'medium', label: 'Medium', description: 'Minor issue', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'high', label: 'High', description: 'Blocking work', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'critical', label: 'Critical (Premium only)', description: 'System down', color: 'bg-rose-100 text-rose-700 border-rose-200', premiumOnly: true },
]

const SUBCATEGORIES = {
  billing: ['upgrade_plan', 'cancel_subscription', 'refund_request', 'failed_payment', 'gst_invoice'],
  account: ['password_reset', 'email_verification', 'google_login', 'github_login', 'linkedin_login', 'delete_account'],
  resume: ['resume_upload', 'ats_score', 'resume_parsing', 'pdf_generation'],
  ai_features: ['ai_copilot', 'mock_interview', 'resume_enhancer', 'career_recommendations'],
  bug: [],
  feature_request: [],
  other: [],
}

const ACCEPTED_FILE_TYPES = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.zip,.doc,.docx'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export default function TicketForm({ category, subcategory, onSuccess, onBack }) {
  const { user } = useAuth()
  const fileInputRef = useRef(null)

  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('low')
  const [selectedSubcategory, setSelectedSubcategory] = useState(subcategory || '')
  const [files, setFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false)

  const isPremium = user?.plan === 'premium'
  const availablePriorities = PRIORITIES.filter(p => !p.premiumOnly || isPremium)
  const currentPriority = PRIORITIES.find(p => p.value === priority) || PRIORITIES[0]
  const availableSubcategories = SUBCATEGORIES[category] || []

  const handleFileSelect = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files || [])
    const validFiles = selectedFiles.filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        return false
      }
      return true
    })
    setFiles((prev) => [...prev, ...validFiles].slice(0, 5)) // Max 5 files
    e.target.value = ''
  }, [])

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return Image
    if (type.includes('pdf')) return FileText
    if (type.includes('zip') || type.includes('rar')) return Archive
    return File
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!subject.trim()) {
      setError('Please enter a subject for your ticket.')
      return
    }
    if (!description.trim()) {
      setError('Please describe your issue in detail.')
      return
    }

    setSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('category', category)
      formData.append('subject', subject.trim())
      formData.append('description', description.trim())
      formData.append('priority', priority)
      if (selectedSubcategory) {
        formData.append('subcategory', selectedSubcategory)
      }

      // Append auto-collected metadata
      const metadata = collectSystemMetadata()
      Object.entries(metadata).forEach(([key, value]) => {
        formData.append(key, value)
      })

      // Append files
      files.forEach((file) => {
        formData.append('attachments', file)
      })

      const result = await createSupportTicket(formData)
      onSuccess(result)
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to create support ticket. Please try again.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header with back */}
      <div className="flex items-center gap-2 mb-1">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h3 className="text-base font-black text-slate-900">Describe your issue</h3>
          <p className="text-xs font-medium text-slate-500 mt-0.5 capitalize">{category.replace('_', ' ')}</p>
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief summary of your issue"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
          maxLength={200}
        />
      </div>

      {/* Subcategory (if available) */}
      {availableSubcategories.length > 0 && (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Subcategory
          </label>
          <select
            value={selectedSubcategory}
            onChange={(e) => setSelectedSubcategory(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all appearance-none"
          >
            <option value="">General {category}</option>
            {availableSubcategories.map((sc) => (
              <option key={sc} value={sc}>
                {SUBCATEGORY_LABELS[sc] || sc.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Please describe your issue in detail. Include steps to reproduce if reporting a bug."
          rows={5}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all resize-none"
          maxLength={5000}
        />
        <p className="text-[10px] font-medium text-slate-400 mt-1 text-right">{description.length}/5000</p>
      </div>

      {/* Priority */}
      <div className="relative">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
          Priority
        </label>
        <button
          type="button"
          onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all"
        >
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${currentPriority.color.split(' ')[0]}`} />
            <span>{currentPriority.label}</span>
          </div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${showPriorityDropdown ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showPriorityDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden"
            >
              {availablePriorities.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    setPriority(p.value)
                    setShowPriorityDropdown(false)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors
                    ${priority === p.value ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}
                  `}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${p.color.split(' ')[0]}`} />
                  <div>
                    <p className="text-sm font-bold">{p.label}</p>
                    <p className="text-[10px] font-medium text-slate-400">{p.description}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* File Attachments */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
          Attachments {files.length > 0 && `(${files.length})`}
        </label>

        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((file, idx) => {
            const FileIcon = getFileIcon(file.type)
            return (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700"
              >
                <FileIcon size={14} className="text-slate-500" />
                <span className="max-w-[120px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={files.length >= 5}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 text-xs font-bold text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload size={14} />
          Upload Screenshot, PDF, ZIP, or Image
        </button>
        <p className="text-[10px] font-medium text-slate-400 mt-1">Max 5 files, 10MB each</p>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700"
          >
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p className="text-xs font-semibold">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || !subject.trim() || !description.trim()}
        className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.98]"
      >
        {submitting ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Submitting Ticket...
          </>
        ) : (
          <>
            <Send size={16} strokeWidth={2.5} />
            Submit Ticket
          </>
        )}
      </button>
    </form>
  )
}

