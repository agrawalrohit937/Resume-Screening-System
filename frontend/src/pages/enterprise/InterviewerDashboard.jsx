import { useState, useEffect, useMemo, useCallback } from 'react'
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
  X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getAssignedInterviews, submitScorecard } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'

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

  const [interviews, setInterviews] = useState([])
  const [loading, setLoading] = useState(true)

  // View state: 'pipeline' (candidate list) or 'evaluation' (full-width focused scorecard workspace)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [selectedInterview, setSelectedInterview] = useState(null)
  const [isEditing, setIsEditing] = useState(false)

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState('all') // 'all' | 'pending' | 'submitted'

  // Scorecard Form state
  const [ratings, setRatings] = useState({})
  const [recommendation, setRecommendation] = useState('yes')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedInterviews, setSubmittedInterviews] = useState([])

  const fetchInterviews = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAssignedInterviews()
      const data = Array.isArray(res.data) ? res.data : []
      setInterviews(data)

      // Pre-populate submitted IDs list
      const submittedIds = data
        .filter((item) => item.is_submitted || item.scorecard)
        .map((item) => item.id)
      setSubmittedInterviews(submittedIds)
    } catch (err) {
      console.error('[InterviewerDashboard] Fetch error:', err)
      toast.error('Failed to load assigned interviews.')
      setInterviews([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInterviews()
  }, [tenantId, fetchInterviews])

  // Quick stats
  const totalAssigned = interviews.length
  const submittedCount = interviews.filter(
    (item) => item.is_submitted || item.scorecard || submittedInterviews.includes(item.id)
  ).length
  const pendingCount = Math.max(0, totalAssigned - submittedCount)

  // Filtered interviews list based on tab and search
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

  // Select a candidate and open the dedicated scorecard view
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

  // Pager navigation across candidates inside evaluation workspace
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

      // Update local state
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
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* VIEW 1: DEDICATED SCORECARD WORKSPACE (FOCUS MODE - NO CRAMPING)    */}
        {/* ════════════════════════════════════════════════════════════════════ */}
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
                  <span>Back to Pipeline</span>
                </button>
                <div className="h-5 w-px bg-slate-200 hidden sm:block" />
                <div className="text-xs text-slate-500 font-medium hidden sm:block">
                  Candidate Evaluation Workspace
                </div>
              </div>

              {/* Candidate Pager (Previous / Next) */}
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
                  <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider block">Scheduled Interview</span>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-300" />
                    {selectedInterview.scheduled_time}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Scorecard Form / Review Container */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-10 shadow-sm space-y-8">
              
              {/* If Already Submitted and NOT Editing -> Calibrated View */}
              {isSelectedSubmitted && !isEditing ? (
                <div className="space-y-8">
                  {/* Success Banner */}
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
                        disabled
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold cursor-not-allowed shadow-2xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Evaluation Submitted
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-xs font-bold text-slate-700 hover:text-blue-600 shadow-sm transition cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit Submission
                      </button>
                    </div>
                  </div>

                  {/* Overall Recommendation Review */}
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

                  {/* Competency Ratings Summary */}
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
                            <div className="flex items-center gap-1 pt-1">
                              {[1, 2, 3, 4, 5].map((val) => (
                                <span
                                  key={val}
                                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                    val <= Number(score) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300'
                                  }`}
                                >
                                  {val}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Qualitative Evidence & Remarks */}
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

                  {/* Action row */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsEvaluating(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                    >
                      ← Back to All Candidates
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled
                        className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5 cursor-not-allowed"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Evaluation Submitted
                      </button>
                      {currentIndex < filteredInterviews.length - 1 && (
                        <button
                          type="button"
                          onClick={handleNextCandidate}
                          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          Evaluate Next Candidate <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Interactive Evaluation Form */
                <form onSubmit={handleSubmitScorecard} className="space-y-10">
                  {isSelectedSubmitted && (
                    <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="text-xs text-emerald-800">
                        <strong className="font-bold">Evaluation Already Submitted:</strong> A scorecard for {selectedInterview.candidate_name} ({selectedInterview.stage}) is already registered. Submitting will update your existing evaluation in-place (atomic upsert) to prevent duplicate scorecards.
                      </div>
                    </div>
                  )}
                  
                  {/* Section 1: Competency Rubric Ratings */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <Award className="w-5 h-5 text-blue-600" />
                          1. Competency Rubric Ratings
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Grade each core engineering and collaborative competency from 1 (Novice) to 5 (Mastery).
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-200/60 hidden sm:inline-block">
                        Calibrated Anchors
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-5">
                      {selectedInterview.competencies?.map((comp) => {
                        const currentScore = ratings[comp.name] || 3

                        return (
                          <div
                            key={comp.name}
                            className="p-5 md:p-6 rounded-3xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-blue-200 hover:shadow-xs transition space-y-4"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="space-y-1 max-w-xl">
                                <h3 className="font-bold text-slate-900 text-base">{comp.name}</h3>
                                <p className="text-xs text-slate-500 leading-relaxed">{comp.description}</p>
                              </div>

                              {/* Tactile Score Selector */}
                              <div className="flex items-center gap-2 self-start sm:self-auto">
                                {[1, 2, 3, 4, 5].map((score) => {
                                  const active = currentScore === score
                                  return (
                                    <button
                                      key={score}
                                      type="button"
                                      onClick={() => handleRatingChange(comp.name, score)}
                                      className={`w-11 h-11 rounded-2xl font-black text-sm transition-all duration-150 flex flex-col items-center justify-center cursor-pointer ${
                                        active
                                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-105 ring-2 ring-blue-600/30'
                                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                                      }`}
                                    >
                                      <span>{score}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Rubric Descriptions */}
                            {comp.rubric && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-slate-200/60 text-xs">
                                <div className="p-2.5 bg-white rounded-xl border border-slate-100">
                                  <span className="font-bold text-slate-700">Level 1 (Sub-par):</span>
                                  <p className="text-[11px] text-slate-500 mt-0.5">{comp.rubric[1] || 'Does not meet role expectations'}</p>
                                </div>
                                <div className="p-2.5 bg-white rounded-xl border border-slate-100">
                                  <span className="font-bold text-slate-700">Level 3 (Meets Standard):</span>
                                  <p className="text-[11px] text-slate-500 mt-0.5">{comp.rubric[3] || 'Solid engineering execution'}</p>
                                </div>
                                <div className="p-2.5 bg-white rounded-xl border border-slate-100">
                                  <span className="font-bold text-slate-700">Level 5 (Mastery):</span>
                                  <p className="text-[11px] text-slate-500 mt-0.5">{comp.rubric[5] || 'Exceptional / Elevates the team'}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Section 2: Overall Recommendation */}
                  <div className="space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                        2. Overall Recommendation
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Your synthesized verdict on whether this candidate should advance to offer or the next round.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {RECOMMENDATIONS.map((rec) => {
                        const active = recommendation === rec.value
                        return (
                          <button
                            key={rec.value}
                            type="button"
                            onClick={() => setRecommendation(rec.value)}
                            className={`p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between h-24 ${rec.color} ${
                              active
                                ? 'ring-2 shadow-sm font-bold scale-[1.02]'
                                : 'opacity-85 hover:opacity-100'
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

                  {/* Section 3: Qualitative Evidence & Key Remarks */}
                  <div className="space-y-3">
                    <div className="border-b border-slate-100 pb-3">
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        3. Qualitative Evidence & Detailed Notes
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Detail specific problems solved, code design tradeoffs, communication strengths, or reservations.
                      </p>
                    </div>

                    <textarea
                      rows={5}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Candidate demonstrated deep Python concurrency concepts, correctly handled race conditions in Redis, and communicated architectural tradeoffs clearly. Minor weakness in edge-case testing..."
                      className="w-full p-4 rounded-2xl border border-slate-200 bg-white text-xs md:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-inner leading-relaxed"
                    />
                  </div>

                  {/* Submission Action Bar */}
                  <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsEvaluating(false)}
                        className="px-5 py-2.5 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      {isSelectedSubmitted && (
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition"
                        >
                          Discard Changes
                        </button>
                      )}
                    </div>

                    {isSelectedSubmitted && !isEditing ? (
                      <button
                        type="button"
                        disabled
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs cursor-not-allowed shadow-2xs"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Evaluation Submitted</span>
                      </button>
                    ) : isSelectedSubmitted && isEditing ? (
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Updating Scorecard...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Update Submitted Scorecard</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
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
                    )}
                  </div>
                </form>
              )}
            </div>

          </div>
        ) : (
          /* ════════════════════════════════════════════════════════════════════ */
          /* VIEW 2: PIPELINE LIST VIEW (SCALABLE TO MANY CANDIDATES)            */
          /* ════════════════════════════════════════════════════════════════════ */
          <div className="space-y-6">

            {/* Top Banner */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60 inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Interviewer Portal
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Tenant: {tenantId}</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
                  Assigned Interviews & Structured Scorecards
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Evaluate candidates objectively against standard rubric competency anchors.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchInterviews}
                title="Refresh interview list"
                className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 transition shadow-2xs cursor-pointer self-start md:self-auto"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Quick Metrics Bar (3 Cards) */}
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

            {/* Search & Filter Toolbar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Search Bar */}
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

              {/* Filter Tabs */}
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

            {/* Candidate List / Grid */}
            {loading ? (
              <div className="min-h-[30vh] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-xs font-medium text-slate-500">Loading your assigned candidate pipeline...</p>
              </div>
            ) : filteredInterviews.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                  <Inbox className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900">No candidates match your criteria</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {searchQuery
                    ? `No assigned interviews matching "${searchQuery}". Try clearing search filter.`
                    : 'You have no assigned interviews under this tab.'}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-2 px-4 py-2 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
                  >
                    Clear Search
                  </button>
                )}
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
                        {/* Header: Avatar + Name + Status */}
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

                        {/* Stage & Schedule Info */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <span className="px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                            {interview.stage}
                          </span>
                          <span className="flex items-center gap-1 text-slate-500 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {interview.scheduled_time}
                          </span>
                        </div>

                        {/* Status Badge */}
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

                      {/* Card Action Buttons */}
                      <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
                        {isDone ? (
                          <button
                            type="button"
                            onClick={() => handleSelectInterview(interview, true)}
                            className="flex-1 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Evaluation Submitted
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectInterview(interview, true)}
                            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/10 cursor-pointer"
                          >
                            <FileCheck className="w-3.5 h-3.5" /> Start Scorecard
                          </button>
                        )}

                        {interview.resume_url && interview.resume_url !== '#' && (
                          <a
                            href={interview.resume_url}
                            target="_blank"
                            rel="noreferrer"
                            title="View Candidate Resume"
                            className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-300 text-slate-500 hover:text-blue-600 hover:bg-blue-50/50 transition cursor-pointer"
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
    </div>
  )
}
