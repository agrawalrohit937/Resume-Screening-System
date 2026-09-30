import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Clock,
  CheckCircle2,
  Send,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  ShieldCheck,
  Building2,
  Check,
  Loader2,
  Inbox,
  Pencil,
  Search,
  Filter,
  FileCheck,
  Eye,
  FileText,
  Star,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Award,
  Layers,
  X,
  Download,
  ShieldAlert,
  Bot,
  UserCheck,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  Copy
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getAssignedInterviews,
  submitScorecard,
  getEmployerLiveSessions,
  exportEmployerEvaluationsExcel
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import ScheduleLiveInterviewModal from '../../components/recruiter/ScheduleLiveInterviewModal'

const RECOMMENDATIONS = [
  { 
    value: 'strong_no', 
    label: 'Strong No', 
    description: 'Significant competency gaps', 
    color: 'border-rose-200 text-rose-700 bg-rose-50/70 hover:bg-rose-100 ring-rose-400' 
  },
  { 
    value: 'no', 
    label: 'No', 
    description: 'Does not meet role expectations', 
    color: 'border-orange-200 text-orange-700 bg-orange-50/70 hover:bg-orange-100 ring-orange-400' 
  },
  { 
    value: 'mixed', 
    label: 'Mixed / Neutral', 
    description: 'Borderline or conflicting evidence', 
    color: 'border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 ring-slate-400' 
  },
  { 
    value: 'yes', 
    label: 'Yes', 
    description: 'Solid performance meets high bar', 
    color: 'border-emerald-200 text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100 ring-emerald-400' 
  },
  { 
    value: 'strong_yes', 
    label: 'Strong Yes', 
    description: 'Exemplary mastery / Raises the team bar', 
    color: 'border-blue-200 text-blue-700 bg-blue-50/70 hover:bg-blue-100 ring-blue-400' 
  },
]

export default function InterviewerDashboard() {
  const { user } = useAuth()
  const { tenantId } = useTenant()

  // Top level active tab: 'ai_interviews' | 'manual_scorecards'
  const [activeMainTab, setActiveMainTab] = useState('ai_interviews')

  // ── AI Sessions State ──
  const [liveSessions, setLiveSessions] = useState([])
  const [loadingAi, setLoadingAi] = useState(true)
  const [aiSearch, setAiSearch] = useState('')
  const [aiFilterStatus, setAiFilterStatus] = useState('all') // 'all' | 'completed' | 'active' | 'expired'
  const [selectedAiScorecard, setSelectedAiScorecard] = useState(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)

  // ── Manual Interviews State ──
  const [interviews, setInterviews] = useState([])
  const [loadingManual, setLoadingManual] = useState(true)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [selectedInterview, setSelectedInterview] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState('all') // 'all' | 'pending' | 'submitted'

  // Scorecard Form state
  const [ratings, setRatings] = useState({})
  const [recommendation, setRecommendation] = useState('yes')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedInterviews, setSubmittedInterviews] = useState([])

  // Fetch Live AI Sessions
  const fetchAiSessions = useCallback(async () => {
    setLoadingAi(true)
    try {
      const res = await getEmployerLiveSessions()
      const data = Array.isArray(res.data) ? res.data : []
      setLiveSessions(data)
    } catch (err) {
      console.error('[InterviewerDashboard] AI Sessions error:', err)
      // gracefully handle if endpoint returns empty
      setLiveSessions([])
    } finally {
      setLoadingAi(false)
    }
  }, [])

  // Fetch Manual Assigned Interviews
  const fetchInterviews = useCallback(async () => {
    setLoadingManual(true)
    try {
      const res = await getAssignedInterviews()
      const data = Array.isArray(res.data) ? res.data : []
      setInterviews(data)

      const submittedIds = data
        .filter((item) => item.is_submitted || item.scorecard)
        .map((item) => item.id)
      setSubmittedInterviews(submittedIds)
    } catch (err) {
      console.error('[InterviewerDashboard] Manual Fetch error:', err)
      setInterviews([])
    } finally {
      setLoadingManual(false)
    }
  }, [])

  useEffect(() => {
    fetchAiSessions()
    fetchInterviews()
  }, [tenantId, fetchAiSessions, fetchInterviews])

  // Handle Excel Export
  const handleExportExcel = async () => {
    setExportingExcel(true)
    try {
      const res = await exportEmployerEvaluationsExcel()
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `AI_Interview_Evaluations_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Evaluation Excel report exported successfully! 📊')
    } catch (err) {
      console.error('Excel export error:', err)
      toast.error('Failed to export evaluations to Excel.')
    } finally {
      setExportingExcel(false)
    }
  }

  // ── AI Sessions Filtered List ──
  const filteredAiSessions = useMemo(() => {
    return liveSessions.filter((s) => {
      if (aiFilterStatus === 'completed' && s.status !== 'completed') return false
      if (aiFilterStatus === 'active' && (s.status === 'completed' || s.is_expired)) return false
      if (aiFilterStatus === 'expired' && !s.is_expired) return false

      if (aiSearch.trim()) {
        const q = aiSearch.toLowerCase().trim()
        const cand = (s.candidate_name || '').toLowerCase()
        const email = (s.candidate_email || '').toLowerCase()
        const role = (s.role || '').toLowerCase()
        return cand.includes(q) || email.includes(q) || role.includes(q)
      }
      return true
    })
  }, [liveSessions, aiFilterStatus, aiSearch])

  // AI Session Metrics
  const totalAi = liveSessions.length
  const completedAi = liveSessions.filter((s) => s.status === 'completed').length
  const activeAi = liveSessions.filter((s) => s.status !== 'completed' && !s.is_expired).length
  const flaggedAi = liveSessions.filter((s) => (s.proctoring_warnings_count || 0) > 0).length
  const avgScore = completedAi > 0
    ? Math.round(
        liveSessions
          .filter((s) => s.status === 'completed' && s.evaluation_score != null)
          .reduce((acc, s) => acc + (s.evaluation_score || 0), 0) / Math.max(1, completedAi)
      )
    : null

  // ── Manual Interviews Metrics & Filter ──
  const totalAssigned = interviews.length
  const submittedCount = interviews.filter(
    (item) => item.is_submitted || item.scorecard || submittedInterviews.includes(item.id)
  ).length
  const pendingCount = Math.max(0, totalAssigned - submittedCount)

  const filteredInterviews = useMemo(() => {
    return interviews.filter((item) => {
      const isDone = item.is_submitted || item.scorecard || submittedInterviews.includes(item.id)
      if (filterTab === 'pending' && isDone) return false
      if (filterTab === 'submitted' && !isDone) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const candName = (item.candidate_name || '').toLowerCase()
        const role = (item.role_title || '').toLowerCase()
        const dept = (item.department || '').toLowerCase()
        const stage = (item.stage || '').toLowerCase()
        return candName.includes(q) || role.includes(q) || dept.includes(q) || stage.includes(q)
      }
      return true
    })
  }, [interviews, filterTab, searchQuery, submittedInterviews])

  const handleSelectInterview = (interview, startEvaluating = true) => {
    setSelectedInterview(interview)
    const isDone = Boolean(
      interview.is_submitted ||
      interview.scorecard ||
      submittedInterviews.includes(interview.id) ||
      submittedInterviews.includes(interview.application_id)
    )

    if (interview.scorecard) {
      setRatings(interview.scorecard.ratings || {})
      setRecommendation(interview.scorecard.recommendation || 'yes')
      setNotes(interview.scorecard.notes || '')
      setIsEditing(false)
    } else if (isDone) {
      setIsEditing(false)
    } else {
      const initialRatings = {}
      interview.competencies?.forEach((c) => {
        initialRatings[c.name] = 3
      })
      setRatings(initialRatings)
      setRecommendation('yes')
      setNotes('')
      setIsEditing(true)
    }

    if (startEvaluating) {
      setIsEvaluating(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const currentIndex = selectedInterview
    ? filteredInterviews.findIndex((i) => i.id === selectedInterview.id)
    : -1

  const handlePrevCandidate = () => {
    if (currentIndex > 0) {
      handleSelectInterview(filteredInterviews[currentIndex - 1], true)
    }
  }

  const handleNextCandidate = () => {
    if (currentIndex < filteredInterviews.length - 1) {
      handleSelectInterview(filteredInterviews[currentIndex + 1], true)
    }
  }

  const handleRatingChange = (compName, score) => {
    setRatings((prev) => ({ ...prev, [compName]: score }))
  }

  const handleSubmitScorecard = async (e) => {
    e.preventDefault()
    if (!selectedInterview) return
    if (!recommendation) {
      toast.error('Please select an overall recommendation.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        application_id: selectedInterview.application_id,
        candidate_id: selectedInterview.candidate_id,
        interviewer_id: user?.id || 'interviewer_user',
        stage_name: selectedInterview.stage,
        ratings,
        recommendation,
        notes,
      }
      const res = await submitScorecard(payload)
      toast.success('Calibrated Scorecard submitted successfully! 🎯')

      const savedScorecard = {
        id: res?.data?.id || selectedInterview.id,
        ratings: { ...ratings },
        recommendation,
        notes,
        submitted_at: res?.data?.submitted_at || new Date().toISOString()
      }

      setSelectedInterview((prev) => ({
        ...prev,
        is_submitted: true,
        scorecard: savedScorecard,
      }))
      setInterviews((prev) =>
        prev.map((item) =>
          item.id === selectedInterview.id
            ? { ...item, is_submitted: true, scorecard: savedScorecard }
            : item
        )
      )
      setSubmittedInterviews((prev) => [...new Set([...prev, selectedInterview.id, selectedInterview.application_id])])
      setIsEditing(false)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to submit scorecard.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const isSelectedSubmitted = Boolean(
    selectedInterview &&
    (submittedInterviews.includes(selectedInterview.id) ||
     submittedInterviews.includes(selectedInterview.application_id) ||
     selectedInterview.is_submitted ||
     selectedInterview.scorecard)
  )

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20 font-sans">
      
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* HEADER WITH DUAL MODE SWITCHER                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Interviewer Portal
            </span>
            <span className="text-xs text-slate-400 font-medium">Tenant: {tenantId}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
            Interviews & Proctoring Evaluation Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review automated Live AI assessments, anti-cheat proctoring flags, or submit calibrated scorecards.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Download formatted evaluation results and anti-cheat proctoring logs"
          >
            {exportingExcel ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowScheduleModal(true)}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-blue-200" />
            <span>Schedule AI Interview</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchAiSessions()
              fetchInterviews()
            }}
            title="Refresh All Data"
            className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loadingAi || loadingManual ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── MAIN NAVIGATION TABS (AI Live vs Manual Scorecards) ── */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            setActiveMainTab('ai_interviews')
            setIsEvaluating(false)
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeMainTab === 'ai_interviews'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Live AI Assessments & Proctoring</span>
          {totalAi > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeMainTab === 'ai_interviews' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'
            }`}>
              {totalAi}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('manual_scorecards')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeMainTab === 'manual_scorecards'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Manual Interview Kits & Scorecards</span>
          {totalAssigned > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeMainTab === 'manual_scorecards' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {totalAssigned}
            </span>
          )}
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: LIVE AI ASSESSMENTS & PROCTORING REPORTS                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeMainTab === 'ai_interviews' && (
        <div className="space-y-6">
          {/* AI Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Scheduled</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{totalAi}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Candidates in AI Pipeline</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Completed & Evaluated</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{completedAi}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Scorecards ready</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Active / In-Window</span>
              <div className="text-2xl font-black text-blue-600 mt-1">{activeAi}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Link valid (24h limit)</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Proctoring Flags</span>
              <div className="text-2xl font-black text-amber-600 mt-1">{flaggedAi}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Candidates with warnings</p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={aiSearch}
                onChange={(e) => setAiSearch(e.target.value)}
                placeholder="Search candidate, email, or role..."
                className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {aiSearch && (
                <button
                  type="button"
                  onClick={() => setAiSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              {[
                { key: 'all', label: `All (${totalAi})` },
                { key: 'completed', label: `Evaluated (${completedAi})` },
                { key: 'active', label: `Active (${activeAi})` },
                { key: 'expired', label: 'Expired' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setAiFilterStatus(tab.key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    aiFilterStatus === tab.key
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI Sessions List / Cards */}
          {loadingAi ? (
            <div className="min-h-[30vh] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-medium text-slate-500">Loading AI assessment sessions & scorecards...</p>
            </div>
          ) : filteredAiSessions.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                <Bot className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No AI Assessment Sessions Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Schedule live AI interviews for single or bulk candidates from the Kanban pipeline or using the button below.
              </p>
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition cursor-pointer shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>Schedule New AI Interview</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAiSessions.map((session) => {
                const isCompleted = session.status === 'completed'
                const isExpired = session.is_expired
                const warningCount = session.proctoring_warnings_count || 0
                const score = session.evaluation_score

                return (
                  <div
                    key={session.session_id || session.id}
                    className="bg-white border border-slate-200/90 hover:border-blue-300 rounded-3xl p-6 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-4">
                      {/* Candidate Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-600 to-teal-500 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                            {session.candidate_name?.slice(0, 2).toUpperCase() || 'CA'}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 text-base truncate leading-tight">
                              {session.candidate_name}
                            </h3>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {session.candidate_email}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        {isCompleted ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Completed
                          </span>
                        ) : isExpired ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 shrink-0 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-rose-600" /> Expired (24h)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shrink-0 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-600" /> Link Active
                          </span>
                        )}
                      </div>

                      {/* Role & Difficulty */}
                      <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-700 font-semibold">
                          <span className="truncate">{session.role || session.job_title || 'Software Engineer'}</span>
                          <span className="capitalize px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold">
                            {session.difficulty || 'Medium'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center justify-between">
                          <span>Mode: {session.interview_mode || 'All-in-One'}</span>
                          <span>{session.questions_count || 5} Questions</span>
                        </div>
                      </div>

                      {/* Evaluation Score & Proctoring Badges */}
                      <div className="space-y-2">
                        {isCompleted ? (
                          <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-purple-50/80 border border-blue-100">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">AI Evaluation</span>
                              <div className="text-xl font-black text-blue-700 mt-0.5">
                                {score != null ? `${score}/100` : 'Evaluated'}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Integrity</span>
                              <div className="mt-0.5">
                                {warningCount === 0 ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-lg border border-emerald-200">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Clean (0 Flags)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-lg border border-amber-200">
                                    <ShieldAlert className="w-3.5 h-3.5" /> {warningCount} Warning{warningCount > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-xs text-slate-500 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                            <span>Deadline:</span>
                            <span className="font-semibold text-slate-700">
                              {session.expires_at ? new Date(session.expires_at).toLocaleString() : '24 Hours'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      {isCompleted ? (
                        <button
                          type="button"
                          onClick={() => setSelectedAiScorecard(session)}
                          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <FileCheck className="w-3.5 h-3.5" /> View Full Scorecard
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const magicUrl = `${window.location.origin}/assessment/live/${session.magic_token || session.session_id}`
                              navigator.clipboard.writeText(magicUrl)
                              toast.success('Magic link copied to clipboard! 📋')
                            }}
                            className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copy Magic Link
                          </button>
                          <a
                            href={`/assessment/live/${session.magic_token || session.session_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-xl border border-slate-200 hover:border-blue-300 text-slate-500 hover:text-blue-600 transition cursor-pointer"
                            title="Open Assessment View"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: MANUAL INTERVIEW KITS & SCORECARDS (ORIGINAL COMPONENT)       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeMainTab === 'manual_scorecards' && (
        <div className="space-y-6">
          {/* VIEW 2A: DEDICATED SCORECARD WORKSPACE (FOCUS MODE) */}
          {isEvaluating && selectedInterview ? (
            <div className="space-y-6">
              {/* Top Workspace Navigation Bar */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-4 md:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEvaluating(false)}
                    className="px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Manual List</span>
                  </button>
                  <div className="h-5 w-px bg-slate-200 hidden sm:block" />
                  <div className="text-xs text-slate-500 font-medium hidden sm:block">
                    Manual Competency Scorecard Workspace
                  </div>
                </div>

                {/* Candidate Pager */}
                <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end">
                  {selectedInterview.resume_url && selectedInterview.resume_url !== '#' && (
                    <a
                      href={selectedInterview.resume_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:border-blue-400 text-slate-600 hover:text-blue-600 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <FileText className="w-3.5 h-3.5" /> View Resume
                    </a>
                  )}

                  <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-200/60">
                    <button
                      type="button"
                      onClick={handlePrevCandidate}
                      disabled={currentIndex <= 0}
                      className="p-1.5 rounded-xl hover:bg-white text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                      title="Previous Candidate"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-slate-600 px-2">
                      {currentIndex >= 0 ? `${currentIndex + 1} of ${filteredInterviews.length}` : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={handleNextCandidate}
                      disabled={currentIndex >= filteredInterviews.length - 1 || currentIndex < 0}
                      className="p-1.5 rounded-xl hover:bg-white text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                      title="Next Candidate"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Candidate Header Profile Banner */}
              <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-md">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-black text-xl text-blue-200 shadow-inner">
                      {selectedInterview.candidate_name?.slice(0, 2).toUpperCase() || 'CA'}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                          {selectedInterview.candidate_name}
                        </h1>
                        {isSelectedSubmitted ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Scorecard Calibrated
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            <Clock className="w-3.5 h-3.5" /> Action Needed: Fill Scorecard
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-blue-200/90 font-medium mt-1 flex flex-wrap items-center gap-2">
                        <span>{selectedInterview.role_title}</span>
                        <span>•</span>
                        <span>{selectedInterview.department}</span>
                        <span>•</span>
                        <span className="text-white font-semibold">{selectedInterview.stage}</span>
                      </p>
                    </div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 px-5 text-right shrink-0">
                    <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider block">Scheduled Time</span>
                    <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-300" />
                      {selectedInterview.scheduled_time}
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Scorecard Form / Review Container */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-10 shadow-sm space-y-8">
                {isSelectedSubmitted && !isEditing ? (
                  <div className="space-y-8">
                    <div className="p-6 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            Evaluation Submitted
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Recorded
                            </span>
                          </h3>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Scorecard already exists for this candidate. Your evaluation is stored in MongoDB and calibration consensus is locked.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 hover:text-blue-600 shadow-sm transition cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit Submission
                        </button>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Final Recommendation
                        </span>
                        <h4 className="text-sm font-bold text-slate-800 mt-0.5">Interviewer Consensus Stance</h4>
                      </div>
                      {(() => {
                        const currentRec = selectedInterview.scorecard?.recommendation || recommendation
                        const recObj = RECOMMENDATIONS.find((r) => r.value === currentRec)
                        return (
                          <span className={`px-4 py-1.5 rounded-full text-xs font-black border capitalize ${recObj?.color || 'bg-slate-100 text-slate-700'}`}>
                            {recObj?.label || String(currentRec || '').toUpperCase()}
                          </span>
                        )
                      })()}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-blue-600" />
                        Competency Rubrics Breakdown
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedInterview.competencies?.map((comp) => {
                          const score = (selectedInterview.scorecard?.ratings || ratings)[comp.name] || 3
                          return (
                            <div key={comp.name} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2 shadow-2xs">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-xs font-bold text-slate-900">{comp.name}</h4>
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-extrabold shrink-0">
                                  {score} / 5
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 line-clamp-2">{comp.description}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {(selectedInterview.scorecard?.notes || notes) && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-blue-600" />
                          Qualitative Evidence & Remarks
                        </h3>
                        <div className="p-5 rounded-2xl border border-slate-200 bg-white text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                          {selectedInterview.scorecard?.notes || notes}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Scorecard Edit/Create Form */
                  <form onSubmit={handleSubmitScorecard} className="space-y-10">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div>
                          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Award className="w-5 h-5 text-blue-600" />
                            1. Competency Rubric Ratings
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Grade each competency from 1 (Novice) to 5 (Mastery).
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-5">
                        {selectedInterview.competencies?.map((comp) => {
                          const currentScore = ratings[comp.name] || 3
                          return (
                            <div
                              key={comp.name}
                              className="p-5 md:p-6 rounded-3xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-blue-200 transition space-y-4"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div className="space-y-1 max-w-xl">
                                  <h3 className="font-bold text-slate-900 text-base">{comp.name}</h3>
                                  <p className="text-xs text-slate-500 leading-relaxed">{comp.description}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {[1, 2, 3, 4, 5].map((score) => (
                                    <button
                                      key={score}
                                      type="button"
                                      onClick={() => handleRatingChange(comp.name, score)}
                                      className={`w-11 h-11 rounded-2xl font-black text-sm transition flex items-center justify-center cursor-pointer ${
                                        currentScore === score
                                          ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600/30'
                                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      {score}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="border-b border-slate-100 pb-3">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-blue-600" />
                          2. Overall Recommendation
                        </h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {RECOMMENDATIONS.map((rec) => {
                          const active = recommendation === rec.value
                          return (
                            <button
                              key={rec.value}
                              type="button"
                              onClick={() => setRecommendation(rec.value)}
                              className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between h-24 ${rec.color} ${
                                active ? 'ring-2 font-bold scale-[1.02]' : 'opacity-85 hover:opacity-100'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-black">{rec.label}</span>
                                {active && <Check className="w-4 h-4" />}
                              </div>
                              <span className="text-[11px] opacity-80 line-clamp-1">{rec.description}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        3. Qualitative Evidence & Detailed Notes
                      </h2>
                      <textarea
                        rows={5}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Detail specific problems solved, system design tradeoffs, or reservations..."
                        className="w-full p-4 rounded-2xl border border-slate-200 bg-white text-xs md:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition leading-relaxed"
                      />
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setIsEvaluating(false)}
                        className="px-5 py-2.5 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition shadow-md cursor-pointer disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Submitting Scorecard...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Submit Calibrated Scorecard</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : (
            /* VIEW 2B: PIPELINE LIST VIEW */
            <div className="space-y-6">
              {/* Quick Metrics Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Assigned</span>
                    <div className="text-2xl font-black text-slate-900 mt-0.5">{totalAssigned} Candidates</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Pending Evaluation</span>
                    <div className="text-2xl font-black text-amber-600 mt-0.5">{pendingCount} Action Needed</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Clock className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Submitted & Calibrated</span>
                    <div className="text-2xl font-black text-emerald-600 mt-0.5">{submittedCount} Recorded</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Search & Filter */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search candidate, role, or stage..."
                    className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      filterTab === 'all'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({totalAssigned})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('pending')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      filterTab === 'pending'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Pending ({pendingCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTab('submitted')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      filterTab === 'submitted'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Completed ({submittedCount})
                  </button>
                </div>
              </div>

              {/* Candidate Cards Grid */}
              {loadingManual ? (
                <div className="min-h-[30vh] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-xs font-medium text-slate-500">Loading assigned candidate pipeline...</p>
                </div>
              ) : filteredInterviews.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                    <Inbox className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">No candidates match your criteria</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    You have no manual assigned interviews under this tab.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredInterviews.map((interview) => {
                    const isDone = interview.is_submitted || interview.scorecard || submittedInterviews.includes(interview.id)
                    const recObj = RECOMMENDATIONS.find((r) => r.value === (interview.scorecard?.recommendation))

                    return (
                      <div
                        key={interview.id}
                        className="bg-white border border-slate-200/90 hover:border-blue-300 rounded-3xl p-6 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-5"
                      >
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                                {interview.candidate_name?.slice(0, 2).toUpperCase() || 'CA'}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-slate-900 text-base truncate leading-tight">
                                  {interview.candidate_name}
                                </h3>
                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                  {interview.role_title} • {interview.department}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                            <span className="px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                              {interview.stage}
                            </span>
                            <span className="flex items-center gap-1 text-slate-500 font-medium">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {interview.scheduled_time}
                            </span>
                          </div>

                          <div>
                            {isDone ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Evaluation Submitted
                                </span>
                                {recObj && (
                                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border capitalize ${recObj.color}`}>
                                    {recObj.label}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3.5 h-3.5" /> Action Needed
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectInterview(interview, true)}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                              isDone
                                ? 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                            }`}
                          >
                            {isDone ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>View Calibrated Scorecard</span>
                              </>
                            ) : (
                              <>
                                <FileCheck className="w-3.5 h-3.5" />
                                <span>Start Scorecard</span>
                              </>
                            )}
                          </button>

                          {interview.resume_url && interview.resume_url !== '#' && (
                            <a
                              href={interview.resume_url}
                              target="_blank"
                              rel="noreferrer"
                              title="View Candidate Resume"
                              className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-300 text-slate-500 hover:text-blue-600 transition cursor-pointer"
                            >
                              <FileText className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: LIVE AI SCORECARD & PROCTORING AUDIT DETAILS                 */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedAiScorecard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col my-8"
            >
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-bold text-lg text-blue-200">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black">{selectedAiScorecard.candidate_name}</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        AI Scorecard Complete
                      </span>
                    </div>
                    <p className="text-xs text-blue-200/80 mt-0.5">
                      {selectedAiScorecard.role || 'Role Candidate'} • {selectedAiScorecard.candidate_email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedAiScorecard(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 md:p-8 overflow-y-auto space-y-6">
                
                {/* Score & Integrity Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Overall AI Score</span>
                      <div className="text-3xl font-black text-blue-950 mt-1">
                        {selectedAiScorecard.evaluation_score != null ? `${selectedAiScorecard.evaluation_score}/100` : '—'}
                      </div>
                    </div>
                    <Award className="w-8 h-8 text-blue-600/30" />
                  </div>

                  <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Recommendation</span>
                      <div className="text-xl font-extrabold text-emerald-900 mt-1 capitalize">
                        {selectedAiScorecard.scorecard?.recommendation?.replace('_', ' ') || 'Advance Candidate'}
                      </div>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-emerald-600/30" />
                  </div>

                  <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Proctoring Warnings</span>
                      <div className="text-2xl font-black text-amber-900 mt-1">
                        {selectedAiScorecard.proctoring_warnings_count || 0} Flags
                      </div>
                    </div>
                    <ShieldAlert className="w-8 h-8 text-amber-600/30" />
                  </div>
                </div>

                {/* Proctoring & Anti-Cheat Summary */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>Anti-Cheat & Proctoring Audit Summary</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[11px] block">Face Missing:</span>
                      <strong className="text-slate-900 font-bold">
                        {selectedAiScorecard.proctoring_details?.face_missing_count || 0} times
                      </strong>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[11px] block">Multiple Faces:</span>
                      <strong className="text-slate-900 font-bold">
                        {selectedAiScorecard.proctoring_details?.multi_face_count || 0} times
                      </strong>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[11px] block">Tab Switches:</span>
                      <strong className="text-slate-900 font-bold">
                        {selectedAiScorecard.proctoring_details?.tab_switches_count || 0} times
                      </strong>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-500 text-[11px] block">Speech Pauses:</span>
                      <strong className="text-slate-900 font-bold">
                        {selectedAiScorecard.proctoring_details?.speech_pauses_count || 0} flags
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Strengths & Weaknesses */}
                {selectedAiScorecard.scorecard && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Key Strengths
                      </h4>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {selectedAiScorecard.scorecard.strengths || selectedAiScorecard.scorecard.key_strengths || 'Demonstrated good clarity, technical understanding, and problem-solving method.'}
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600" /> Areas for Improvement
                      </h4>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {selectedAiScorecard.scorecard.weaknesses || selectedAiScorecard.scorecard.areas_to_improve || 'Can provide more granular architectural edge-case testing.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Q&A Transcripts */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Detailed Questions & Candidate Answers Transcript</span>
                  </h4>

                  {selectedAiScorecard.questions && selectedAiScorecard.questions.length > 0 ? (
                    <div className="space-y-4">
                      {selectedAiScorecard.questions.map((q, idx) => {
                        const answer = selectedAiScorecard.answers?.[idx] || selectedAiScorecard.answers?.[q.id]
                        const answerText = typeof answer === 'string' ? answer : answer?.answer || answer?.transcript || '—'
                        const feedback = answer?.feedback || answer?.critique

                        return (
                          <div
                            key={idx}
                            className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-xs font-bold text-blue-600">Question {idx + 1}:</span>
                              {answer?.score != null && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                                  {answer.score}/10
                                </span>
                              )}
                            </div>
                            <h5 className="text-sm font-bold text-slate-900">{q.question_text || q.question}</h5>
                            
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-800 space-y-1">
                              <span className="text-[11px] font-bold text-slate-500 block">Candidate Response:</span>
                              <p className="whitespace-pre-wrap leading-relaxed">{answerText}</p>
                            </div>

                            {feedback && (
                              <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1">
                                <span className="text-[11px] font-bold text-blue-700 block">AI Evaluation & Notes:</span>
                                <p className="leading-relaxed">{feedback}</p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-500">
                      No question transcript details attached to this session.
                    </div>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedAiScorecard(null)}
                  className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Close Scorecard
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Report to Excel</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: SCHEDULE LIVE AI INTERVIEW MODAL                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <ScheduleLiveInterviewModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSuccess={() => {
          fetchAiSessions()
          toast.success('AI interview session scheduled and invitations dispatched!')
        }}
      />

    </div>
  )
}
