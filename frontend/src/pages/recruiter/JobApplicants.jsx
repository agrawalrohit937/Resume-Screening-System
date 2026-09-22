import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Briefcase,
  Building2,
  MapPin,
  Clock,
  DollarSign,
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Sparkles,
  Calendar,
  ChevronRight,
  ExternalLink,
  Download,
  Linkedin,
  Github,
  Mail,
  Phone,
  FileText,
  SlidersHorizontal,
  RotateCcw,
  MoveRight,
  ChevronDown,
  X,
  Eye,
  GraduationCap,
  Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getJobApplications, updateApplicationStage } from '../../services/api'
import CustomDropdown from '../../components/common/CustomDropdown'
import CandidateHoverCard from '../../components/recruiter/CandidateHoverCard'
import GithubHoverCard from '../../components/recruiter/GithubHoverCard'
import { resolveAvatarUrl, getInitials } from '../../utils/avatarUtils'

// Helper to extract clean GitHub username from applicant object
const getApplicantGithubUser = (applicant) => {
  if (!applicant) return ''
  const direct = applicant.github_username || applicant.candidate?.github_username
  if (direct && typeof direct === 'string') {
    return direct.trim().replace(/^@/, '')
  }
  const rawUrl = applicant.candidate?.github || applicant.candidate?.github_url || applicant.github_url
  if (rawUrl && typeof rawUrl === 'string') {
    const trimmed = rawUrl.trim().replace(/^@/, '')
    const match = trimmed.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_\-]+)/i)
    if (match && match[1]) return match[1]
    if (!trimmed.includes('/') && !trimmed.includes(' ')) return trimmed
  }
  return ''
}

// Helper to resolve applicant profile photo or avatar
const getApplicantAvatar = (applicant) => {
  if (!applicant) return null
  const direct =
    resolveAvatarUrl(applicant.candidate, 140) ||
    resolveAvatarUrl(applicant.user, 140) ||
    resolveAvatarUrl(applicant, 140)
  if (direct) return direct

  const ghUser = getApplicantGithubUser(applicant)
  if (ghUser) {
    return `https://github.com/${ghUser}.png?size=140`
  }

  return null
}

// Pipeline sorting options
const SORT_OPTIONS = [
  { value: 'match_score', label: 'Highest Match %' },
  { value: 'newest', label: 'Newest Submission' },
  { value: 'experience', label: 'Experience (Years)' },
]

// Active pipeline stages (main Kanban board)
const ACTIVE_STAGES = [
  {
    id: 'Applied',
    title: 'Applied',
    dotColor: 'bg-blue-500',
    headerBg: 'bg-blue-50/70 text-blue-900 border-blue-200/80',
    badgeClass: 'bg-blue-100 text-blue-800',
    icon: Clock,
  },
  {
    id: 'Under Review',
    title: 'Under Review',
    dotColor: 'bg-amber-500',
    headerBg: 'bg-amber-50/70 text-amber-900 border-amber-200/80',
    badgeClass: 'bg-amber-100 text-amber-800',
    icon: AlertCircle,
  },
  {
    id: 'Shortlisted',
    title: 'Shortlisted',
    dotColor: 'bg-emerald-500',
    headerBg: 'bg-emerald-50/70 text-emerald-900 border-emerald-200/80',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    icon: CheckCircle2,
  },
  {
    id: 'Interview',
    title: 'Interview',
    dotColor: 'bg-purple-500',
    headerBg: 'bg-purple-50/70 text-purple-900 border-purple-200/80',
    badgeClass: 'bg-purple-100 text-purple-800',
    icon: Sparkles,
  },
]

// Terminal / decided stages (Completed Decisions view)
const TERMINAL_STAGES = [
  {
    id: 'Hired',
    title: 'Hired',
    dotColor: 'bg-emerald-600',
    headerBg: 'bg-emerald-50/80 text-emerald-900 border-emerald-300/80',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    icon: CheckCircle2,
  },
  {
    id: 'Rejected',
    title: 'Rejected',
    dotColor: 'bg-rose-500',
    headerBg: 'bg-rose-50/70 text-rose-900 border-rose-200/80',
    badgeClass: 'bg-rose-100 text-rose-800',
    icon: XCircle,
  },
]

// All stages combined (for grouping logic)
const KANBAN_STAGES = [...ACTIVE_STAGES, ...TERMINAL_STAGES]

// Helper for score badge styling
const getScoreBadge = (score) => {
  if (score == null) return { bg: 'bg-slate-100 text-slate-700 border-slate-200', text: 'N/A' }
  const s = Math.round(score)
  if (s >= 80) return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: `${s}%` }
  if (s >= 60) return { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', text: `${s}%` }
  if (s >= 40) return { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: `${s}%` }
  return { bg: 'bg-rose-50 text-rose-700 border-rose-200', text: `${s}%` }
}

/**
 * CompactCandidateCard:
 * Unified, compact card design for both Active Pipeline and Completed Decisions.
 * Displays Candidate Name & Avatar (with light-themed hover tooltip), Match Score (%),
 * Experience Level, Top 3 Skills chips, and a smaller, less prominent "View Profile" link.
 */
function CompactCandidateCard({
  app,
  isTerminal = false,
  isDragging = false,
  isUpdating = false,
  onDragStart,
  onDragEnd,
  onOpenDrawer,
  onAdvanceStage,
  onReject,
  canAdvance = false,
}) {
  const displayScore = app.recruiter_score != null ? app.recruiter_score : (app.match_score || 0)
  const scoreTheme = getScoreBadge(displayScore)
  const expYears = app.candidate?.experience_years
  const skills = (app.candidate?.skills || []).slice(0, 3)
  const remainingSkills = (app.candidate?.skills || []).length - 3
  const avatarUrl = getApplicantAvatar(app)

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, app.id)}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-xl border border-slate-200/90 p-3 shadow-2xs hover:shadow-sm hover:border-indigo-200 transition-all cursor-grab active:cursor-grabbing relative group select-none ${
        isDragging ? 'opacity-40 border-dashed border-indigo-400 scale-95' : ''
      } ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* Main Content: Strict Avatar on the left, Name + Match Score + Skills on the right */}
      <div className="flex items-start gap-3">
        {/* Strict Avatar Dimensions (48x48px / w-12 h-12) */}
        <CandidateHoverCard candidate={app.candidate} app={app} className="shrink-0">
          <div
            className="w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] rounded-full overflow-hidden shrink-0 border border-slate-200/90 shadow-2xs bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 text-white flex items-center justify-center font-bold text-sm cursor-pointer"
            style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px', maxWidth: '48px', maxHeight: '48px' }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={app.candidate_name || 'Candidate'}
                className="w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] rounded-full object-cover shrink-0 block"
                style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px', maxWidth: '48px', maxHeight: '48px', objectFit: 'cover' }}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            ) : null}
            <span className={avatarUrl ? 'hidden' : 'block'}>
              {getInitials(app.candidate_name || 'Candidate')}
            </span>
          </div>
        </CandidateHoverCard>

        {/* Right Info Section */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Candidate Name & Match Score */}
          <div className="flex items-center justify-between gap-1.5">
            <CandidateHoverCard candidate={app.candidate} app={app} className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 truncate hover:text-indigo-600 transition-colors leading-tight cursor-pointer">
                {app.candidate_name || 'Candidate'}
              </h4>
            </CandidateHoverCard>

            {/* ATS Score Pill */}
            <div className={`px-1.5 py-0.5 rounded-md border text-[11px] font-black font-mono shadow-2xs shrink-0 ${scoreTheme.bg}`}>
              {scoreTheme.text}
            </div>
          </div>

          {/* Row 2: Experience Level & Knockout Warning */}
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-medium">
            {expYears != null && (
              <span className="inline-flex items-center gap-1 shrink-0">
                <Briefcase size={11} className="text-slate-400 shrink-0" />
                <span>{expYears === 0 ? 'Fresher' : `${expYears}y exp`}</span>
              </span>
            )}

            {app.knockout_status && app.knockout_status.passed === false && (
              <span
                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200/70 px-1 py-0.2 rounded shrink-0 ml-auto"
                title={(app.knockout_status.reasons || []).join(' • ')}
              >
                <AlertCircle size={10} className="text-rose-500 shrink-0" />
                Knockout
              </span>
            )}
          </div>

          {/* Row 3: Small chips for skills below */}
          <div className="flex items-center gap-1 flex-wrap mt-1.5">
            {skills.map((sk, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 rounded bg-slate-100/90 text-slate-600 text-[10px] font-medium border border-slate-200/50 truncate max-w-[80px]"
              >
                {sk}
              </span>
            ))}
            {remainingSkills > 0 && (
              <span className="text-[9.5px] font-medium text-slate-400 self-center">
                +{remainingSkills}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: View Profile Link and Status/Actions (Clean separation, no overlap) */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpenDrawer(app)}
          className="text-[11px] font-medium text-slate-500 hover:text-indigo-600 transition-colors inline-flex items-center gap-1 cursor-pointer shrink-0"
        >
          <span>View Profile</span>
          <ChevronRight size={11} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
        </button>

        {!isTerminal ? (
          <div className="flex items-center gap-1 shrink-0">
            {canAdvance && (
              <button
                type="button"
                title="Advance to next stage"
                onClick={(e) => {
                  e.stopPropagation()
                  onAdvanceStage && onAdvanceStage(app)
                }}
                className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
              >
                <ChevronRight size={13} />
              </button>
            )}
            <button
              type="button"
              title="Reject candidate"
              onClick={(e) => {
                e.stopPropagation()
                onReject && onReject(app.id)
              }}
              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${
              (app.stage || '').toLowerCase() === 'hired'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            {app.stage || (app.status === 'hired' ? 'Hired' : 'Rejected')}
          </span>
        )}
      </div>
    </div>
  )
}

export default function JobApplicants() {
  const { jobId } = useParams()
  const navigate = useNavigate()

  // State
  const [job, setJob] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('match_score') // 'match_score' | 'newest' | 'experience'
  const [selectedApplicant, setSelectedApplicant] = useState(null)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const [draggingAppId, setDraggingAppId] = useState(null)
  const [dragOverStage, setDragOverStage] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [pipelineView, setPipelineView] = useState('active') // 'active' | 'completed'
  const undoTimerRef = useRef(null)

  // Cleanup undo timer on unmount
  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current) }, [])

  // Fetch job applications
  const fetchApplications = async () => {
    if (!jobId) return
    setLoading(true)
    try {
      const res = await getJobApplications(jobId)
      setJob(res.data?.job || null)
      setApplications(res.data?.applications || [])
    } catch (err) {
      console.error('Failed to load applications:', err)
      const msg = err.response?.data?.detail || 'Failed to load applicant pipeline.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApplications()
  }, [jobId])

  // Move candidate to a stage (API call with optimistic UI update)
  const handleStageChange = async (appId, newStage) => {
    const targetApp = applications.find(a => a.id === appId)
    if (!targetApp || targetApp.stage === newStage) return

    const oldStage = targetApp.stage

    // Optimistic update
    setApplications(prev =>
      prev.map(a => (a.id === appId ? { ...a, stage: newStage } : a))
    )
    if (selectedApplicant?.id === appId) {
      setSelectedApplicant(prev => ({ ...prev, stage: newStage }))
    }

    setUpdatingId(appId)
    try {
      await updateApplicationStage(appId, newStage)
      toast.success(`Moved ${targetApp.candidate_name || 'candidate'} to "${newStage}"`, {
        icon: newStage === 'Shortlisted' ? '🌟' : newStage === 'Interview' ? '🎯' : '✓',
      })
    } catch (err) {
      console.error('Stage change failed:', err)
      // Rollback on error
      setApplications(prev =>
        prev.map(a => (a.id === appId ? { ...a, stage: oldStage } : a))
      )
      if (selectedApplicant?.id === appId) {
        setSelectedApplicant(prev => ({ ...prev, stage: oldStage }))
      }
      toast.error(err.response?.data?.detail || 'Failed to update candidate stage.')
    } finally {
      setUpdatingId(null)
    }
  }

  // Reject a candidate with 5-second undo window
  const handleReject = useCallback((appId) => {
    const targetApp = applications.find(a => a.id === appId)
    if (!targetApp || targetApp.stage === 'Rejected') return

    const prevStage = targetApp.stage
    // Optimistic: move to Rejected immediately
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, stage: 'Rejected' } : a))

    // Clear any pending undo timer
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)

    // Show undo toast — custom content with Undo button
    const toastId = toast(
      (t) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#374151' }}>
            <strong>{targetApp.candidate_name || 'Candidate'}</strong> rejected.
          </span>
          <button
            onClick={() => {
              clearTimeout(undoTimerRef.current)
              toast.dismiss(t.id)
              setApplications(prev => prev.map(a => a.id === appId ? { ...a, stage: prevStage } : a))
              toast.success(`Restored to "${prevStage}"`, { duration: 2000 })
            }}
            style={{
              padding: '3px 10px',
              borderRadius: 8,
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              color: '#1f2937',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Undo
          </button>
        </div>
      ),
      { duration: 5000, icon: '🚫', id: `reject-${appId}` }
    )

    // Commit after 5 s if not undone
    undoTimerRef.current = setTimeout(async () => {
      toast.dismiss(toastId)
      try {
        await updateApplicationStage(appId, 'Rejected')
      } catch (err) {
        // Rollback if API fails
        setApplications(prev => prev.map(a => a.id === appId ? { ...a, stage: prevStage } : a))
        toast.error(err.response?.data?.detail || 'Failed to reject candidate.')
      }
    }, 5000)
  }, [applications])

  // HTML5 Drag & Drop handlers
  const onDragStart = (e, appId) => {
    setDraggingAppId(appId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', appId)
  }

  const onDragEnd = () => {
    setDraggingAppId(null)
    setDragOverStage(null)
  }

  const onDragOver = (e, stageId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverStage !== stageId) {
      setDragOverStage(stageId)
    }
  }

  const onDragLeave = (e, stageId) => {
    if (dragOverStage === stageId) {
      setDragOverStage(null)
    }
  }

  const onDrop = (e, stageId) => {
    e.preventDefault()
    setDragOverStage(null)
    const appId = e.dataTransfer.getData('text/plain') || draggingAppId
    if (appId) {
      handleStageChange(appId, stageId)
    }
    setDraggingAppId(null)
  }

  // Filter & Sort Applicants
  const filteredApplicants = useMemo(() => {
    return applications
      .filter(app => {
        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase()
        const name = (app.candidate_name || '').toLowerCase()
        const email = (app.candidate_email || '').toLowerCase()
        const skills = (app.candidate?.skills || []).map(s => s.toLowerCase()).join(' ')
        return name.includes(q) || email.includes(q) || skills.includes(q)
      })
      .sort((a, b) => {
        if (sortBy === 'match_score') {
          const scoreA = a.recruiter_score != null ? a.recruiter_score : (a.match_score || 0)
          const scoreB = b.recruiter_score != null ? b.recruiter_score : (b.match_score || 0)
          return scoreB - scoreA
        }
        if (sortBy === 'newest') {
          return new Date(b.created_at || 0) - new Date(a.created_at || 0)
        }
        if (sortBy === 'experience') {
          return (b.candidate?.experience_years || 0) - (a.candidate?.experience_years || 0)
        }
        return 0
      })
  }, [applications, searchQuery, sortBy])

  // Group applicants by stage
  const stageGroups = useMemo(() => {
    const groups = {}
    KANBAN_STAGES.forEach(st => {
      groups[st.id] = filteredApplicants.filter(a => (a.stage || 'Applied') === st.id)
    })
    return groups
  }, [filteredApplicants])

  // Average match %
  const avgMatch = useMemo(() => {
    if (!applications.length) return 0
    const total = applications.reduce((acc, a) => acc + (a.recruiter_score != null ? a.recruiter_score : (a.match_score || 0)), 0)
    return Math.round(total / applications.length)
  }, [applications])

  // Dragged candidate info for dynamic dropzone
  const draggedCandidate = useMemo(() => {
    if (!draggingAppId) return null
    return applications.find(a => a.id === draggingAppId)
  }, [draggingAppId, applications])

  const isDraggedDecisionCompleted = Boolean(
    draggedCandidate && (
      (draggedCandidate.stage || '').toLowerCase() === 'rejected' ||
      (draggedCandidate.stage || '').toLowerCase() === 'hired' ||
      (draggedCandidate.status || '').toLowerCase() === 'rejected' ||
      (draggedCandidate.status || '').toLowerCase() === 'hired'
    )
  )

  // Open applicant detail drawer
  const openApplicantDrawer = (app) => {
    setSelectedApplicant(app)
    setIsDetailDrawerOpen(true)
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-screen bg-slate-50/70 font-sans text-slate-800 antialiased pb-20">
      
      {/* ── 1. Top Navigation & Job Header Banner ──────────────────────────── */}
      <div className="w-full bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-2xs">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          
          {/* Back breadcrumb */}
          <div className="flex items-center justify-between gap-4 mb-2">
            <button
              type="button"
              onClick={() => navigate('/recruiter')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition cursor-pointer group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Job Postings</span>
            </button>

            {job && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                job.status === 'open'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${job.status === 'open' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {job.status === 'open' ? 'Active Listing' : 'Closed Role'}
              </span>
            )}
          </div>

          {/* Job Details Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-poppins tracking-tight">
                  {job?.title || 'Job Applicants Pipeline'}
                </h1>
                {job?.department && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">
                    {job.department}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Building2 size={13} className="text-slate-400" />
                  {job?.company_name}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin size={13} className="text-slate-400" />
                  {job?.location} ({job?.work_mode})
                </span>
                {job?.salary_range && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <DollarSign size={13} />
                      {job.salary_range}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Quick Metrics & Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200/80">
                <div className="text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Applicants</span>
                  <span className="text-lg font-black text-indigo-700 font-poppins">{applications.length}</span>
                </div>
                <div className="w-[1px] h-6 bg-slate-200" />
                <div className="text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Match</span>
                  <span className="text-lg font-black text-emerald-700 font-poppins">{avgMatch}%</span>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchApplications}
                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
                title="Refresh Pipeline"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Filters & Pipeline Controls ─────────────────────────────────── */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
          
          {/* Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search candidate by name or skill..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort By & Stats CustomDropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2 text-xs text-slate-500 w-full sm:w-auto">
              <span className="font-semibold text-slate-500 shrink-0 hidden sm:inline">Sort:</span>
              <CustomDropdown
                options={SORT_OPTIONS}
                value={sortBy}
                onChange={setSortBy}
                icon={<SlidersHorizontal size={13} className="text-slate-400" />}
                className="w-full sm:w-56"
                buttonClassName="py-2 px-3.5 text-xs font-bold rounded-xl"
                menuClassName="right-0 sm:left-auto"
              />
            </div>
          </div>
        </div>

        {/* ── 3. View Toggle + Kanban Board ─────────────────────────────────── */}

        {/* View Toggle */}
        <div className="flex items-center gap-1 mb-5 bg-slate-100/80 rounded-xl p-1 w-fit border border-slate-200/60 shadow-inner">
          <button
            type="button"
            onClick={() => setPipelineView('active')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              pipelineView === 'active'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Active Pipeline
          </button>
          <button
            type="button"
            onClick={() => setPipelineView('completed')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              pipelineView === 'completed'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Completed Decisions
            {(stageGroups['Hired']?.length || 0) + (stageGroups['Rejected']?.length || 0) > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
                {(stageGroups['Hired']?.length || 0) + (stageGroups['Rejected']?.length || 0)}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="flex gap-4">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 animate-pulse min-w-[240px]">
                <div className="h-6 bg-slate-200 rounded-lg w-1/2" />
                <div className="h-28 bg-slate-100 rounded-xl" />
                <div className="h-28 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : pipelineView === 'active' ? (
          /* ── Active Pipeline: horizontal scroll, never wraps ────── */
          <div className="w-full max-w-full flex flex-nowrap gap-4 overflow-x-auto pb-4 items-start"
               style={{ WebkitOverflowScrolling: 'touch' }}>
            {ACTIVE_STAGES.map(stage => {
              const stageApps = stageGroups[stage.id] || []
              const isOver = dragOverStage === stage.id
              const StageIcon = stage.icon

              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => onDragOver(e, stage.id)}
                  onDragLeave={(e) => onDragLeave(e, stage.id)}
                  onDrop={(e) => onDrop(e, stage.id)}
                  className={`bg-slate-50/70 rounded-2xl transition-all duration-200 flex flex-col min-h-[520px] min-w-[240px] w-[280px] shrink-0 ${
                    isOver
                      ? 'bg-indigo-50/60 ring-2 ring-indigo-500/30'
                      : 'hover:bg-slate-100/50'
                  }`}
                >
                  {/* Stage Header */}
                  <div className={`p-3.5 rounded-t-2xl border-b border-slate-100/80 flex items-center justify-between ${stage.headerBg}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${stage.dotColor}`} />
                      <h3 className="text-xs font-bold uppercase tracking-wider font-poppins text-slate-700">
                        {stage.title}
                      </h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold shadow-2xs ${stage.badgeClass}`}>
                      {stageApps.length}
                    </span>
                  </div>

                  {/* Stage Body / Cards List */}
                  <div className="p-2.5 space-y-2.5 flex-1">
                    {stageApps.length > 0 ? (
                      stageApps.map((app) => {
                        const isDragging = draggingAppId === app.id
                        const isUpdating = updatingId === app.id
                        const canAdvance = ACTIVE_STAGES.findIndex(s => s.id === app.stage) < ACTIVE_STAGES.length - 1

                        return (
                          <CompactCandidateCard
                            key={app.id}
                            app={app}
                            isTerminal={false}
                            isDragging={isDragging}
                            isUpdating={isUpdating}
                            canAdvance={canAdvance}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onOpenDrawer={openApplicantDrawer}
                            onAdvanceStage={(targetApp) => {
                              const nextIdx = ACTIVE_STAGES.findIndex(s => s.id === targetApp.stage) + 1
                              if (nextIdx < ACTIVE_STAGES.length) {
                                handleStageChange(targetApp.id, ACTIVE_STAGES[nextIdx].id)
                              }
                            }}
                            onReject={handleReject}
                          />
                        )
                      })
                    ) : (
                      /* Empty Column State */
                      <div className="py-12 text-center border border-dashed border-slate-200/80 rounded-2xl p-4 bg-transparent">
                        <StageIcon size={18} className="text-slate-300 mx-auto mb-1.5 opacity-70" />
                        <p className="text-xs font-medium text-slate-400">
                          {isOver ? 'Drop candidate here' : 'No candidates'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── Completed Decisions: 2-column grid ──────────────── */
          <div className="w-full max-w-full grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {TERMINAL_STAGES.map(stage => {
              const stageApps = stageGroups[stage.id] || []
              const isOver = dragOverStage === stage.id
              const StageIcon = stage.icon
              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => onDragOver(e, stage.id)}
                  onDragLeave={(e) => onDragLeave(e, stage.id)}
                  onDrop={(e) => onDrop(e, stage.id)}
                  className={`bg-slate-50/70 rounded-2xl transition-all duration-200 flex flex-col min-h-[300px] ${
                    isOver ? 'bg-indigo-50/60 ring-2 ring-indigo-500/30' : 'hover:bg-slate-100/50'
                  }`}
                >
                  {/* Stage Header */}
                  <div className={`p-3.5 rounded-t-2xl border-b border-slate-100/80 flex items-center justify-between ${stage.headerBg}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${stage.dotColor}`} />
                      <h3 className="text-xs font-bold uppercase tracking-wider font-poppins text-slate-700">
                        {stage.id === 'Hired' ? '🎉 ' : ''}{stage.title}
                      </h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold shadow-2xs ${stage.badgeClass}`}>
                      {stageApps.length}
                    </span>
                  </div>
                  {/* Cards */}
                  <div className="p-2.5 space-y-2.5 flex-1">
                    {stageApps.length > 0 ? (
                      stageApps.map((app) => {
                        const isDragging = draggingAppId === app.id
                        const isUpdating = updatingId === app.id
                        return (
                          <CompactCandidateCard
                            key={app.id}
                            app={app}
                            isTerminal={true}
                            isDragging={isDragging}
                            isUpdating={isUpdating}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onOpenDrawer={openApplicantDrawer}
                          />
                        )
                      })
                    ) : (
                      <div className="py-12 text-center border border-dashed border-slate-200/80 rounded-2xl p-4">
                        <StageIcon size={18} className="text-slate-300 mx-auto mb-1.5 opacity-70" />
                        <p className="text-xs font-medium text-slate-400">No candidates</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Global Action Dropzone (portal) — slides up from bottom while dragging ── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {draggingAppId && (
            <motion.div
              key="pipeline-action-dropzone"
              initial={{ y: 120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 120, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverStage(isDraggedDecisionCompleted ? '__restore__' : '__reject__')
              }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/plain') || draggingAppId
                setDraggingAppId(null)
                setDragOverStage(null)
                if (id) {
                  if (isDraggedDecisionCompleted) {
                    handleStageChange(id, 'Applied')
                  } else {
                    handleReject(id)
                  }
                }
              }}
              className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9997] flex items-center gap-3 px-8 py-4 rounded-2xl border-2 shadow-2xl select-none transition-all duration-150 ${
                isDraggedDecisionCompleted
                  ? dragOverStage === '__restore__'
                    ? 'bg-indigo-600 border-indigo-700 text-white scale-105'
                    : 'bg-white border-indigo-300 text-indigo-600 shadow-indigo-100'
                  : dragOverStage === '__reject__'
                    ? 'bg-rose-600 border-rose-700 text-white scale-105'
                    : 'bg-white border-rose-300 text-rose-500 shadow-rose-100'
              }`}
              style={{ minWidth: 280 }}
            >
              {isDraggedDecisionCompleted ? (
                <>
                  <RotateCcw size={20} className="shrink-0" />
                  <span className="text-sm font-bold tracking-tight">
                    {dragOverStage === '__restore__' ? 'Release to Move to Pipeline' : 'Move back to Pipeline'}
                  </span>
                </>
              ) : (
                <>
                  <Trash2 size={20} className="shrink-0" />
                  <span className="text-sm font-bold tracking-tight">
                    {dragOverStage === '__reject__' ? 'Release to Reject' : 'Drop here to Reject'}
                  </span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── 4. Candidate Full Detail Slide-Over Drawer (Rendered via React Portal directly into document.body) ── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isDetailDrawerOpen && selectedApplicant && (
            <>
              {/* Backdrop Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsDetailDrawerOpen(false)}
                className="fixed inset-0 z-[9998] bg-slate-900/40 backdrop-blur-sm cursor-pointer"
              />

              {/* Main Drawer Container */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className="fixed inset-y-0 right-0 z-[9999] flex flex-col h-screen w-full max-w-lg bg-white shadow-2xl border-l border-slate-200 overflow-hidden"
              >
                {/* 1. Fixed Sticky Header */}
                <div className="flex flex-col p-6 pt-8 border-b border-slate-100 bg-white shrink-0">
                  {/* Top Row: Candidate Avatar + Full Name + Circular Close Button */}
                  <div className="flex items-center justify-between gap-3.5">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Applicant Profile Photo / Avatar */}
                      <div className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 text-white font-bold flex items-center justify-center text-lg shadow-sm border border-slate-200/80 shrink-0">
                        {getApplicantAvatar(selectedApplicant) ? (
                          <img
                            src={getApplicantAvatar(selectedApplicant)}
                            alt={selectedApplicant.candidate_name || 'Candidate'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : null}
                        <span className={getApplicantAvatar(selectedApplicant) ? 'hidden' : 'block'}>
                          {getInitials(selectedApplicant.candidate_name || 'Candidate')}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                          {selectedApplicant.candidate_name || 'Anonymous Candidate'}
                        </h2>
                        {selectedApplicant.candidate?.location ? (
                          <p className="text-xs font-semibold text-slate-400 truncate flex items-center gap-1 mt-0.5">
                            <MapPin size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate">{selectedApplicant.candidate.location}</span>
                          </p>
                        ) : (
                          <p className="text-xs font-medium text-slate-400 truncate mt-0.5">
                            Applicant Profile
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDetailDrawerOpen(false)}
                      className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-800 transition cursor-pointer shrink-0"
                      title="Close drawer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Bottom Row: Contact Info */}
                  <div className="flex items-center flex-wrap text-sm font-medium text-slate-500 gap-4 mt-2">
                    {selectedApplicant.candidate_email && (
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <Mail size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">{selectedApplicant.candidate_email}</span>
                      </span>
                    )}
                    {selectedApplicant.candidate?.phone && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone size={14} className="text-slate-400 shrink-0" />
                        <span>{selectedApplicant.candidate.phone}</span>
                      </span>
                    )}
                  </div>

                  {/* Action Row: Download Resume PDF, GitHub Profile & LinkedIn Profile */}
                  <div className="mt-4 flex items-center gap-2.5 w-full flex-wrap sm:flex-nowrap">
                    {/* Download Resume Button */}
                    {selectedApplicant.candidate?.file_url || selectedApplicant.resume_id ? (
                      <a
                        href={selectedApplicant.candidate?.file_url || `/api/v1/jobs/resume/${selectedApplicant.resume_id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-[120px] flex justify-center items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.99] text-slate-700 text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer truncate"
                      >
                        <Download size={15} className="text-slate-500 shrink-0" />
                        <span className="truncate">Download Resume</span>
                      </a>
                    ) : (
                      <button
                        disabled
                        type="button"
                        className="flex-1 min-w-[120px] flex justify-center items-center gap-1.5 px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-400 text-xs sm:text-sm font-semibold rounded-xl cursor-not-allowed truncate"
                      >
                        <Download size={15} className="text-slate-400 shrink-0" />
                        <span className="truncate">No Resume PDF</span>
                      </button>
                    )}

                    {/* GitHub Profile Button with compact GithubHoverCard */}
                    {getApplicantGithubUser(selectedApplicant) && (
                      <GithubHoverCard username={getApplicantGithubUser(selectedApplicant)} className="flex-1 min-w-[100px]">
                        <a
                          href={
                            selectedApplicant.candidate?.github?.startsWith('http')
                              ? selectedApplicant.candidate.github
                              : `https://github.com/${getApplicantGithubUser(selectedApplicant)}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex justify-center items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer truncate group"
                        >
                          <Github size={15} className="text-slate-300 group-hover:text-white shrink-0" />
                          <span className="truncate">GitHub Profile</span>
                        </a>
                      </GithubHoverCard>
                    )}

                    {/* LinkedIn Profile Button */}
                    {selectedApplicant.candidate?.linkedin && (
                      <a
                        href={selectedApplicant.candidate.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-[100px] flex justify-center items-center gap-1.5 px-3.5 py-2.5 bg-[#0A66C2] hover:bg-[#084e96] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer truncate"
                      >
                        <Linkedin size={15} className="text-white shrink-0" />
                        <span className="truncate">LinkedIn</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* 2. Scrollable Content Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  
                  {/* Hiring Stage & ATS Score Card */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/60 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        CURRENT HIRING STAGE
                      </span>
                      <CustomDropdown
                        options={KANBAN_STAGES.map(s => ({ value: s.id, label: s.title, icon: s.icon }))}
                        value={selectedApplicant.stage}
                        onChange={(val) => handleStageChange(selectedApplicant.id, val)}
                        className="w-48"
                        buttonClassName="py-1.5 px-3 text-xs font-bold rounded-xl"
                        menuClassName="left-0"
                      />
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        RECRUITER ATS MATCH
                      </span>
                      <span className={`text-3xl font-black font-poppins ${
                        Math.round(selectedApplicant.recruiter_score != null ? selectedApplicant.recruiter_score : (selectedApplicant.match_score || 0)) >= 80 
                          ? 'text-emerald-600' 
                          : Math.round(selectedApplicant.recruiter_score != null ? selectedApplicant.recruiter_score : (selectedApplicant.match_score || 0)) >= 60 
                          ? 'text-indigo-600' 
                          : Math.round(selectedApplicant.recruiter_score != null ? selectedApplicant.recruiter_score : (selectedApplicant.match_score || 0)) >= 40 
                          ? 'text-amber-600' 
                          : 'text-rose-600'
                      }`}>
                        {Math.round(selectedApplicant.recruiter_score != null ? selectedApplicant.recruiter_score : (selectedApplicant.match_score || 0))}%
                      </span>
                    </div>
                  </div>

                  {/* Knockout Status Banner */}
                  {selectedApplicant.knockout_status && selectedApplicant.knockout_status.passed === false && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
                      <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-rose-700 mb-1.5">
                        <AlertCircle size={15} className="text-rose-600 shrink-0" />
                        <span>Hard Knockout Warning</span>
                      </div>
                      <p className="text-xs text-rose-600 mb-2">
                        Candidate does not satisfy mandatory job criteria:
                      </p>
                      <ul className="list-disc list-inside text-xs space-y-1 text-rose-700 font-medium">
                        {(selectedApplicant.knockout_status.reasons || ['Minimum job requirements not satisfied']).map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Professional Summary */}
                  {selectedApplicant.candidate?.summary && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Professional Summary</h4>
                      <div className="text-sm text-slate-600 leading-relaxed bg-white border border-slate-100 shadow-sm p-4 rounded-xl">
                        {selectedApplicant.candidate.summary}
                      </div>
                    </div>
                  )}

                  {/* Cover Notes from Application */}
                  {selectedApplicant.notes && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Candidate Application Note</h4>
                      <div className="text-sm text-indigo-900 leading-relaxed bg-indigo-50/50 border border-indigo-100/80 p-4 rounded-xl">
                        "{selectedApplicant.notes}"
                      </div>
                    </div>
                  )}

                  {/* Skills & Keywords */}
                  {selectedApplicant.candidate?.skills && selectedApplicant.candidate.skills.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Skills & Keywords</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedApplicant.candidate.skills.map((sk, idx) => (
                          <span key={idx} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-medium">
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Work Experience */}
                  {selectedApplicant.candidate?.work_experience && selectedApplicant.candidate.work_experience.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Work History</h4>
                      <div className="space-y-3">
                        {selectedApplicant.candidate.work_experience.map((w, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-xs text-slate-900">{w.title || 'Role'}</span>
                              <span className="text-[10px] font-semibold text-slate-400">
                                {w.start_date || 'Past'} — {w.end_date || 'Present'}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-600">{w.company}</p>
                            {w.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-3 mt-1 leading-relaxed">
                                {w.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {selectedApplicant.candidate?.education && selectedApplicant.candidate.education.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Education</h4>
                      <div className="space-y-2">
                        {selectedApplicant.candidate.education.map((edu, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-800 block">{edu.degree || edu.field_of_study || 'Degree'}</span>
                              <span className="text-slate-500 text-[11px]">{edu.institution}</span>
                            </div>
                            {edu.end_year && (
                              <span className="text-slate-400 font-mono text-[11px]">{edu.end_year}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                {/* 3. Fixed Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-between text-xs text-slate-400 font-medium">
                  <span>
                    Applied: {selectedApplicant.created_at ? new Date(selectedApplicant.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDetailDrawerOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition cursor-pointer"
                  >
                    Close Panel
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

    </div>
  )
}
