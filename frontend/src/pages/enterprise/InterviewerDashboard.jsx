import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Search,
  FileCheck,
  FileText,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Award,
  X,
  Download,
  ShieldAlert,
  Bot,
  Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getMyPostedJobs,
  getAssignedInterviews,
  getEmployerLiveSessions,
  exportEmployerEvaluationsExcel,
} from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import ScheduleLiveInterviewModal from '../../components/recruiter/ScheduleLiveInterviewModal'

export default function InterviewerDashboard() {
  const { user } = useAuth()
  const { tenantId } = useTenant()

  // ── Core Data States ──
  const [jobs, setJobs] = useState([])
  const [assignedCandidates, setAssignedCandidates] = useState([])
  const [liveSessions, setLiveSessions] = useState([])
  const [loading, setLoading] = useState(true)

  // ── Filters & Search ──
  const [selectedJobId, setSelectedJobId] = useState('all') // 'all' or specific jobId
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('pipeline') // 'pipeline' | 'completed'

  // ── Modal States ──
  const [selectedAiScorecard, setSelectedAiScorecard] = useState(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [targetCandidate, setTargetCandidate] = useState(null)
  const [exportingExcel, setExportingExcel] = useState(false)

  // ── Fetch All Dashboard Data ──
  const fetchDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const [jobsRes, candidatesRes, sessionsRes] = await Promise.allSettled([
        getMyPostedJobs(),
        getAssignedInterviews(),
        getEmployerLiveSessions(),
      ])

      // Parse Jobs
      if (jobsRes.status === 'fulfilled') {
        const rawJobs = jobsRes.value?.data?.jobs || jobsRes.value?.data || jobsRes.value || []
        setJobs(Array.isArray(rawJobs) ? rawJobs : [])
      } else {
        setJobs([])
      }

      // Parse Assigned Candidates (Candidates moved to "Interview" stage by HR)
      if (candidatesRes.status === 'fulfilled') {
        const rawCand = candidatesRes.value?.data || []
        setAssignedCandidates(Array.isArray(rawCand) ? rawCand : [])
      } else {
        setAssignedCandidates([])
      }

      // Parse Live AI Sessions
      if (sessionsRes.status === 'fulfilled') {
        const rawSessions = sessionsRes.value?.data?.sessions || sessionsRes.value?.data || []
        setLiveSessions(Array.isArray(rawSessions) ? rawSessions : [])
      } else {
        setLiveSessions([])
      }
    } catch (err) {
      console.error('[InterviewerDashboard] Error fetching dashboard data:', err)
      toast.error('Failed to refresh interview center data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [tenantId, fetchDashboardData])

  // ── Selected Job Object ──
  const selectedJob = useMemo(() => {
    if (selectedJobId === 'all') return null
    return jobs.find((j) => String(j.id || j._id) === String(selectedJobId)) || null
  }, [jobs, selectedJobId])

  // ── Excel Export ──
  const handleExportExcel = async () => {
    setExportingExcel(true)
    try {
      const res = await exportEmployerEvaluationsExcel(
        selectedJobId !== 'all' ? selectedJobId : undefined
      )
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const jobLabel = selectedJob?.title
        ? selectedJob.title.replace(/[^a-zA-Z0-9_-]/g, '_')
        : 'All_Openings'
      a.download = `CareerShala_Evaluations_${jobLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success(
        `Evaluations Excel exported for ${selectedJob ? selectedJob.title : 'All Openings'}! 📊`
      )
    } catch (err) {
      console.error('Excel export error:', err)
      toast.error('Failed to export evaluations to Excel.')
    } finally {
      setExportingExcel(false)
    }
  }

  // ── Base Filter Helper ──
  const matchesJobAndSearch = useCallback((item) => {
    const jid = item.job_id
    if (selectedJobId !== 'all' && String(jid) !== String(selectedJobId)) {
      return false
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const name = (item.candidate_name || '').toLowerCase()
      const email = (item.candidate_email || '').toLowerCase()
      const role = (item.role_title || item.role || item.job_title || '').toLowerCase()
      return name.includes(q) || email.includes(q) || role.includes(q)
    }

    return true
  }, [selectedJobId, searchQuery])

  // ── Filtered Pipeline Candidates (Awaiting or In-Progress) ──
  const filteredPipelineCandidates = useMemo(() => {
    return assignedCandidates.filter((c) => {
      if (c.is_ai_completed) return false
      return matchesJobAndSearch(c)
    })
  }, [assignedCandidates, matchesJobAndSearch])

  // ── Filtered Completed AI Sessions ──
  const filteredCompletedSessions = useMemo(() => {
    return liveSessions.filter((s) => {
      if (s.status !== 'completed') return false
      return matchesJobAndSearch(s)
    })
  }, [liveSessions, matchesJobAndSearch])

  // ── Quick Counts ──
  const jobCounts = useMemo(() => {
    const counts = { all: { total: 0 } }
    assignedCandidates.forEach((c) => {
      const jid = c.job_id || 'unassigned'
      if (!counts[jid]) counts[jid] = { total: 0 }
      counts[jid].total += 1
      counts.all.total += 1
    })
    return counts
  }, [assignedCandidates])

  const handleLaunchScheduleForCandidate = (candidate) => {
    setTargetCandidate(candidate)
    setShowScheduleModal(true)
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-24 font-sans">
      
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 1. CLEAN HEADER                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Technical Interviewer Portal
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {user?.company_name || (tenantId && tenantId !== 'default' ? tenantId : 'Recruitment Workspace')}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight flex items-center gap-3">
            <Bot className="w-8 h-8 text-blue-600 shrink-0" />
            Technical AI Interview Center
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Review candidates assigned by HR, generate role-tailored AI interview links, and evaluate automated proctoring scorecards.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            {exportingExcel ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>
              {exportingExcel
                ? 'Exporting...'
                : selectedJob
                ? `Export Excel (${selectedJob.title})`
                : 'Export Excel (All Openings)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTargetCandidate(null)
              setShowScheduleModal(true)
            }}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-blue-200" />
            <span>Schedule AI Interview</span>
          </button>

          <button
            type="button"
            onClick={fetchDashboardData}
            title="Refresh All Data"
            className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 2. JOB OPENINGS SELECTOR                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedJobId('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                selectedJobId === 'all'
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>All Openings</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                selectedJobId === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {jobCounts.all?.total || 0}
              </span>
            </button>

            {jobs.map((job) => {
              const jid = String(job.id || job._id)
              const count = jobCounts[jid]?.total || 0
              const isSelected = selectedJobId === jid

              return (
                <button
                  key={jid}
                  type="button"
                  onClick={() => setSelectedJobId(jid)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate max-w-[180px]">{job.title || 'Job Opening'}</span>
                  {count > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 3. SEARCH & MAIN TABS (PIPELINE vs EVALUATED)                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name, email, or role..."
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

        {/* 2 Simple Tabs */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('pipeline')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'pipeline'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Interview Pipeline</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'pipeline' ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
            }`}>
              {filteredPipelineCandidates.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Evaluated Scorecards</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'completed' ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
            }`}>
              {filteredCompletedSessions.length}
            </span>
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 4. TAB 1: INTERVIEW PIPELINE CANDIDATES                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-medium text-slate-500">Loading pipeline candidates...</p>
            </div>
          ) : filteredPipelineCandidates.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-70" />
              <h4 className="text-sm font-bold text-slate-800">No Candidates in Pipeline</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Candidates dragged to the "Interview" stage by HR on the Kanban board will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPipelineCandidates.map((cand) => {
                const isScheduled = cand.is_ai_scheduled
                const aiSess = cand.ai_session
                const matchScore = cand.match_score

                return (
                  <div
                    key={cand.application_id || cand.id}
                    className="bg-white border border-slate-200/90 hover:border-blue-300 rounded-3xl p-6 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-4">
                      {/* Candidate Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {cand.profile_picture ? (
                            <img
                              src={cand.profile_picture}
                              alt={cand.candidate_name}
                              className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-xs shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-600 to-teal-500 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                              {cand.candidate_name?.slice(0, 2).toUpperCase() || 'CA'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 text-base truncate leading-tight">
                              {cand.candidate_name}
                            </h3>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {cand.candidate_email}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        {isScheduled ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 shrink-0 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-600" /> Link Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 shrink-0 inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-600" /> Action Required
                          </span>
                        )}
                      </div>

                      {/* Job & Match Score */}
                      <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-800 font-semibold">
                          <span className="truncate">{cand.role_title || 'Role Candidate'}</span>
                          {matchScore != null && (
                            <span className="px-2 py-0.5 rounded-md bg-white border border-blue-200 text-blue-700 text-[10px] font-extrabold shrink-0">
                              {Math.round(matchScore)}% Match
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center justify-between">
                          <span>Dept: {cand.department || 'Engineering'}</span>
                          <span>Stage: Interview</span>
                        </div>
                      </div>

                      {/* Session Live Status */}
                      {isScheduled && aiSess ? (
                        <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100 text-xs text-blue-900 space-y-1.5">
                          <div className="flex items-center justify-between font-bold">
                            <span>Assessment Status:</span>
                            <span className="capitalize px-2 py-0.5 rounded-md bg-white border border-blue-200 text-[10px] text-blue-800">
                              {aiSess?.status || 'Pending'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center justify-between">
                            <span>Expires:</span>
                            <span className="font-semibold text-slate-700">
                              {aiSess?.expires_at ? new Date(aiSess.expires_at).toLocaleDateString() : '24-48 Hours'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-100 text-xs text-amber-800">
                          Link not generated yet. Click below to generate tailored AI questions for this candidate.
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      {isScheduled && aiSess?.magic_token ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const token = aiSess?.magic_token
                              if (!token) return
                              const magicUrl = `${window.location.origin}/assessment/live/${token}`
                              navigator.clipboard.writeText(magicUrl)
                              toast.success('Candidate Magic Link copied! 📋')
                            }}
                            className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" /> Copy Magic Link
                          </button>

                          <a
                            href={`/assessment/live/${aiSess.magic_token}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-300 text-slate-500 hover:text-blue-600 transition cursor-pointer"
                            title="Open Assessment View"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleLaunchScheduleForCandidate(cand)}
                          className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                          <span>Generate AI Interview Link</span>
                        </button>
                      )}

                      {cand.resume_url && cand.resume_url !== '#' && (
                        <a
                          href={cand.resume_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-300 text-slate-500 hover:text-blue-600 transition cursor-pointer"
                          title="View Candidate Resume"
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

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 5. TAB 2: COMPLETED & EVALUATED SCORECARDS                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'completed' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-medium text-slate-500">Loading completed evaluations...</p>
            </div>
          ) : filteredCompletedSessions.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center space-y-2">
              <Bot className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">No Evaluated Sessions Yet</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                When candidates finish taking their Live AI assessment, their detailed scorecards and anti-cheat audit logs will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCompletedSessions.map((session) => {
                const score = session.evaluation_score
                const warningCount = session.proctoring_warnings_count || 0

                return (
                  <div
                    key={session.session_id || session.id}
                    className="bg-white border border-slate-200/90 hover:border-emerald-300 rounded-3xl p-6 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-blue-500 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
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

                        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Completed
                        </span>
                      </div>

                      {/* Role Info */}
                      <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-800 font-semibold">
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

                      {/* AI Evaluation Score & Proctoring Badges */}
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-teal-50/80 to-blue-50/80 border border-emerald-100">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">AI Evaluation</span>
                          <div className="text-xl font-black text-emerald-700 mt-0.5">
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
                    </div>

                    {/* Action */}
                    <div className="pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedAiScorecard(session)}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>View Full Scorecard & Transcripts</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 6. MODAL: LIVE AI SCORECARD & PROCTORING AUDIT DETAILS               */}
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
                      {selectedAiScorecard.role || selectedAiScorecard.job_title || 'Role Candidate'} • {selectedAiScorecard.candidate_email}
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

                {/* Anti-Cheat Proctoring Audit Summary */}
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
                        {selectedAiScorecard.scorecard.strengths || selectedAiScorecard.scorecard.key_strengths || 'Demonstrated strong technical understanding, problem breakdown, and communication clarity.'}
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600" /> Areas for Improvement
                      </h4>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {selectedAiScorecard.scorecard.weaknesses || selectedAiScorecard.scorecard.areas_to_improve || 'Can improve precision in edge-case handling and system scaling considerations.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Detailed Q&A Transcripts */}
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
                  <span>
                    {selectedJob
                      ? `Export (${selectedJob.title}) to Excel`
                      : 'Export Report to Excel'}
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 7. SCHEDULE LIVE AI INTERVIEW MODAL                                 */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <ScheduleLiveInterviewModal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false)
          setTargetCandidate(null)
        }}
        initialJob={
          targetCandidate
            ? {
                id: targetCandidate.job_id,
                title: targetCandidate.role_title,
                department: targetCandidate.department,
                required_skills: targetCandidate.required_skills,
              }
            : selectedJob
        }
        initialCandidate={
          targetCandidate
            ? {
                id: targetCandidate.candidate_id,
                name: targetCandidate.candidate_name,
                email: targetCandidate.candidate_email,
                application_id: targetCandidate.application_id,
              }
            : null
        }
        applicationId={targetCandidate?.application_id || null}
        onSuccess={() => {
          fetchDashboardData()
          setShowScheduleModal(false)
          setTargetCandidate(null)
          toast.success('AI Interview session scheduled and invitations dispatched! 🚀')
        }}
      />

    </div>
  )
}
