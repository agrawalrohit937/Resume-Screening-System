import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  X,
  Briefcase,
  Layers,
  Clock,
  Send,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Mail,
  User,
  Users,
  ShieldCheck,
  ChevronDown,
  Plus,
  Trash2,
  FileText,
  Target,
  BrainCircuit,
  MessageSquarePlus,
  CheckSquare,
  Square,
  Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { scheduleLiveInterview, scheduleBulkLiveInterviews } from '../../services/api'
import CustomDropdown from '../common/CustomDropdown'

const INTERVIEW_MODES = [
  { value: 'mixed', label: 'All-in-One Assessment (5 Resume + 5 JD Balanced)' },
  { value: 'technical', label: 'Technical Core (Deep Architecture & Code Design)' },
  { value: 'behavioral', label: 'Behavioral & Leadership (STAR Scenario Evaluation)' },
  { value: 'situational', label: 'Situational Judgment (Real-world Problem Solving)' },
]

const DIFFICULTY_OPTIONS = [
  {
    value: 'easy',
    title: 'Warm-up / Easy',
    desc: 'Foundational concepts, direct project explanations, 2m/question',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    value: 'medium',
    title: 'Standard / Medium',
    desc: 'Practical problem solving, architectural trade-offs, 2.5m/question',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    value: 'hard',
    title: 'Challenge / Hard',
    desc: 'Senior edge cases, high-scale bottlenecks & deep dive scenarios',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
]

const EXPIRY_OPTIONS = [
  { value: 24, label: '24 Hours (Urgent Priority)' },
  { value: 48, label: '48 Hours (Standard 2-Day Window)' },
  { value: 72, label: '72 Hours (Extended 3-Day Window)' },
  { value: 168, label: '7 Days (Standard Week)' },
]

export default function ScheduleLiveInterviewModal({
  isOpen,
  onClose,
  initialJob = null,
  initialCandidate = null,
  candidates = [], // Pre-selected candidates array if provided from caller
  applicationId = null,
  onSuccess = null,
}) {
  const [jobs, setJobs] = useState([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState(initialJob?.id || '')
  const [selectedJob, setSelectedJob] = useState(initialJob || null)

  // Pipeline Candidates Roster
  const [pipelineCandidates, setPipelineCandidates] = useState([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState(new Set())

  const [interviewMode, setInterviewMode] = useState('mixed')
  const [difficulty, setDifficulty] = useState('medium')
  const [expiryHours, setExpiryHours] = useState(48)

  // Interactive Custom Questions List State
  const [customQuestions, setCustomQuestions] = useState([])
  const [newQuestionInput, setNewQuestionInput] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [resultData, setResultData] = useState(null)
  const [copiedToken, setCopiedToken] = useState(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const prevIsOpenRef = useRef(false)

  // Fetch candidates in interview pipeline for the selected job
  const fetchPipelineCandidatesForJob = useCallback(async (jobId) => {
    if (!jobId) {
      setPipelineCandidates([])
      return
    }
    if (initialCandidate) {
      setPipelineCandidates([initialCandidate])
      setSelectedCandidateIds(new Set([initialCandidate.id || initialCandidate._id || 'cand_0']))
      return
    }
    if (Array.isArray(candidates) && candidates.length > 0) {
      setPipelineCandidates(candidates)
      setSelectedCandidateIds(new Set(candidates.map((c, i) => c.id || c._id || `cand_${i}`)))
      return
    }

    setLoadingCandidates(true)
    try {
      const res = await api.get(`/jobs/${jobId}/applicants`)
      const rawApps = res.data?.applicants || res.data?.applications || res.data || []
      const appsList = Array.isArray(rawApps) ? rawApps : []
      
      // Prefer applicants in 'Interview' stage, or all active applicants if none filtered
      const interviewApps = appsList.filter(
        (a) => String(a.stage || '').toLowerCase() === 'interview'
      )
      const finalList = interviewApps.length > 0 ? interviewApps : appsList
      setPipelineCandidates(finalList)
      setSelectedCandidateIds(new Set(finalList.map((a, i) => a.id || a._id || `cand_${i}`)))
    } catch (err) {
      console.warn('Failed to load pipeline candidates for job:', err)
      setPipelineCandidates([])
    } finally {
      setLoadingCandidates(false)
    }
  }, [initialCandidate, candidates])

  // Initialize modal state on open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setResultData(null)
      setCopiedToken(null)
      setCopiedAll(false)
      setCustomQuestions([])
      setNewQuestionInput('')

      let targetJobId = initialJob?.id || ''
      if (initialJob) {
        setSelectedJob(initialJob)
        setSelectedJobId(initialJob.id)
      }

      const fetchJobs = async () => {
        setLoadingJobs(true)
        try {
          let list = []
          try {
            const res = await api.get('/jobs/me')
            const raw = res.data?.jobs || res.data?.results || res.data || []
            list = Array.isArray(raw) ? raw : []
          } catch (e) {
            try {
              const resAlt = await api.get('/jobs/my-jobs')
              const rawAlt = resAlt.data?.jobs || resAlt.data?.results || resAlt.data || []
              list = Array.isArray(rawAlt) ? rawAlt : []
            } catch (e2) {
              console.warn('Jobs API error:', e2)
            }
          }

          if (list.length === 0) {
            list = [
              {
                id: 'software_engineer',
                title: 'Software Development Engineer',
                jd_text_raw: 'Full stack software development engineering role covering frontend, backend API architecture, database performance, system design, and collaborative engineering.',
              },
            ]
          }
          setJobs(list)

          if (!targetJobId && list.length > 0) {
            targetJobId = list[0].id
            setSelectedJob(list[0])
            setSelectedJobId(list[0].id)
          }

          if (targetJobId) {
            fetchPipelineCandidatesForJob(targetJobId)
          }
        } catch (err) {
          console.error('Failed to fetch jobs:', err)
        } finally {
          setLoadingJobs(false)
        }
      }

      fetchJobs()
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen, initialJob, fetchPipelineCandidatesForJob])

  const handleJobSelect = (jobId) => {
    setSelectedJobId(jobId)
    const found = jobs.find((j) => String(j.id) === String(jobId))
    if (found) setSelectedJob(found)
    fetchPipelineCandidatesForJob(jobId)
  }

  // Toggle candidate selection in cohort
  const toggleCandidateSelection = (cId) => {
    const next = new Set(selectedCandidateIds)
    if (next.has(cId)) {
      next.delete(cId)
    } else {
      next.add(cId)
    }
    setSelectedCandidateIds(next)
  }

  const toggleSelectAllCandidates = () => {
    if (selectedCandidateIds.size === pipelineCandidates.length) {
      setSelectedCandidateIds(new Set())
    } else {
      setSelectedCandidateIds(new Set(pipelineCandidates.map((c, i) => c.id || c._id || `cand_${i}`)))
    }
  }

  // Add Custom Question Helper
  const handleAddCustomQuestion = () => {
    const trimmed = newQuestionInput.trim()
    if (!trimmed) return
    if (trimmed.length < 5) {
      toast.error('Question should be at least 5 characters.')
      return
    }
    if (customQuestions.includes(trimmed)) {
      toast.error('This question is already added.')
      return
    }
    if (customQuestions.length >= 5) {
      toast.error('Maximum 5 custom questions allowed.')
      return
    }
    setCustomQuestions([...customQuestions, trimmed])
    setNewQuestionInput('')
  }

  const handleRemoveCustomQuestion = (index) => {
    setCustomQuestions(customQuestions.filter((_, idx) => idx !== index))
  }

  const handleCopySingleLink = (linkUrl, tokenKey) => {
    if (!linkUrl) return
    navigator.clipboard.writeText(linkUrl)
    setCopiedToken(tokenKey)
    toast.success('Magic Assessment link copied to clipboard!')
    setTimeout(() => setCopiedToken(null), 2500)
  }

  const handleCopyAllBulk = () => {
    if (!resultData?.sessions) return
    const text = resultData.sessions
      .map(
        (s) =>
          `Candidate: ${s.candidate_name} (${s.candidate_email})\nMagic Link: ${s.magic_link_url}\n`
      )
      .join('\n------------------------\n')
    navigator.clipboard.writeText(text)
    setCopiedAll(true)
    toast.success('All Magic Assessment links copied to clipboard!')
    setTimeout(() => setCopiedAll(false), 3000)
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()

    if (!selectedJob) {
      toast.error('Please select a Job Position.')
      return
    }

    const jdText =
      selectedJob.jd_text_raw ||
      selectedJob.job_description ||
      selectedJob.description ||
      selectedJob.title

    if (!jdText || jdText.length < 10) {
      toast.error('Selected job does not have a complete Job Description text.')
      return
    }

    // Filter active candidates selected by the interviewer
    const chosenCandidates = pipelineCandidates.filter((c, i) =>
      selectedCandidateIds.has(c.id || c._id || `cand_${i}`)
    )

    if (chosenCandidates.length === 0) {
      toast.error('Please select at least 1 candidate to schedule interview.')
      return
    }

    // Include any pending text in input if user forgot to click Add
    let finalCustomQs = [...customQuestions]
    if (newQuestionInput.trim().length >= 5 && !finalCustomQs.includes(newQuestionInput.trim())) {
      finalCustomQs.push(newQuestionInput.trim())
    }

    setSubmitting(true)
    try {
      if (chosenCandidates.length > 1) {
        // Bulk Cohort Scheduling
        const bulkPayload = {
          job_id: selectedJob.id,
          job_title: selectedJob.title,
          full_job_description: jdText,
          interview_mode: interviewMode,
          difficulty: difficulty,
          custom_questions: finalCustomQs,
          expiry_hours: parseInt(expiryHours, 10) || 48,
          num_questions: 10 + finalCustomQs.length,
          candidates: chosenCandidates.map((c) => ({
            candidate_name: c.candidate_name || c.name || c.candidate?.name || c.contact?.name || 'Candidate',
            candidate_email: (c.candidate_email || c.email || c.candidate?.email || c.contact?.email || '').trim(),
            application_id: c.id || c._id || c.application_id || null,
          })),
        }

        const res = await scheduleBulkLiveInterviews(bulkPayload)
        const data = res.data
        setResultData({ ...data, is_bulk: true })
        toast.success(`Live AI Interviews scheduled for ${data.scheduled_count} candidates! 🎯`)
        if (onSuccess) onSuccess(data)
      } else {
        // Single Candidate Scheduling
        const cand = chosenCandidates[0]
        const singlePayload = {
          job_id: selectedJob.id,
          job_title: selectedJob.title,
          full_job_description: jdText,
          interview_mode: interviewMode,
          difficulty: difficulty,
          custom_questions: finalCustomQs,
          expiry_hours: parseInt(expiryHours, 10) || 48,
          candidate_email: (cand.candidate_email || cand.email || cand.candidate?.email || '').trim() || null,
          candidate_name: (cand.candidate_name || cand.name || cand.candidate?.name || 'Candidate').trim() || null,
          application_id: cand.id || cand._id || cand.application_id || applicationId || null,
          num_questions: 10 + finalCustomQs.length,
        }

        const res = await scheduleLiveInterview(singlePayload)
        const data = res.data
        setResultData({ ...data, is_bulk: false })
        toast.success('Live AI Interview session generated & magic link dispatched! 🎯')
        if (onSuccess) onSuccess(data)
      }
    } catch (err) {
      console.error('Schedule interview error:', err)
      const msg = err.response?.data?.detail || 'Failed to generate interview assessment.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const selectedCount = selectedCandidateIds.size

  return typeof document !== 'undefined'
    ? createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
            >
              {/* ── Modal Header ── */}
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 font-poppins">
                      Schedule Live AI Interview
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      10-Question Personalized Assessment (5 Resume Deep-Dive + 5 JD Core)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* ── Modal Body ── */}
              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
                {resultData ? (
                  /* ── Success Result State ── */
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                      <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-emerald-900">
                          {resultData.is_bulk
                            ? `Successfully Dispatched ${resultData.scheduled_count} Live AI Assessments!`
                            : 'AI Assessment Link Generated & Dispatched!'}
                        </h4>
                        <p className="text-xs text-emerald-700 mt-1">
                          {resultData.is_bulk
                            ? `All ${resultData.scheduled_count} candidates received their magic interview links with proctoring access (Valid for ${expiryHours}h).`
                            : `The candidate received their magic interview link via email (Valid for ${expiryHours}h).`}
                        </p>
                      </div>
                    </div>

                    {resultData.is_bulk && resultData.sessions ? (
                      /* Bulk Links Roster */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Candidate Assessment Links ({resultData.sessions.length})
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyAllBulk}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition cursor-pointer"
                          >
                            {copiedAll ? <Check size={13} /> : <Copy size={13} />}
                            <span>{copiedAll ? 'All Copied!' : 'Copy All Links'}</span>
                          </button>
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                          {resultData.sessions.map((s) => (
                            <div
                              key={s.session_id}
                              className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 truncate">
                                    {s.candidate_name}
                                  </span>
                                  {s.email_sent && (
                                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Email Sent ✉️
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-500 truncate block">
                                  {s.candidate_email || 'No email'}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleCopySingleLink(s.magic_link_url, s.session_id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition shrink-0 cursor-pointer"
                              >
                                {copiedToken === s.session_id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                <span>{copiedToken === s.session_id ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* Single Magic Link Box */
                      <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Candidate Magic Link (Valid for {expiryHours}h)
                        </label>
                        <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
                          <input
                            type="text"
                            readOnly
                            value={resultData.magic_link_url || ''}
                            className="bg-transparent border-none text-xs text-slate-700 font-mono flex-1 px-3 py-1 focus:outline-none select-all"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopySingleLink(resultData.magic_link_url, 'single')}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition cursor-pointer shrink-0"
                          >
                            {copiedToken === 'single' ? <Check size={14} /> : <Copy size={14} />}
                            <span>{copiedToken === 'single' ? 'Copied!' : 'Copy Link'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
                      >
                        Done & Close
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── Form State ── */
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* 1. Target Job Selection */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          1. Target Job Role
                        </label>
                        {loadingJobs && (
                          <span className="text-[11px] text-slate-400 font-medium">Loading jobs...</span>
                        )}
                      </div>

                      {jobs.length > 0 ? (
                        <CustomDropdown
                          options={jobs.map((j) => ({
                            value: j.id,
                            label: `${j.title} ${j.location ? `(${j.location})` : ''}`,
                          }))}
                          value={selectedJobId}
                          onChange={handleJobSelect}
                          icon={<Briefcase size={14} className="text-slate-400" />}
                          className="w-full"
                          buttonClassName="py-2.5 px-3.5 text-xs font-bold rounded-xl bg-slate-50 border-slate-200"
                        />
                      ) : (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                          <AlertCircle size={14} />
                          <span>No jobs found. Please create a Job Posting first.</span>
                        </div>
                      )}
                    </div>

                    {/* 2. Automated Pipeline Candidates Roster (No manual textboxes!) */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users size={15} className="text-indigo-600" />
                          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            2. Candidates in Interview Pipeline ({pipelineCandidates.length})
                          </label>
                        </div>
                        {pipelineCandidates.length > 1 && (
                          <button
                            type="button"
                            onClick={toggleSelectAllCandidates}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                          >
                            {selectedCandidateIds.size === pipelineCandidates.length ? 'Deselect All' : 'Select All'}
                          </button>
                        )}
                      </div>

                      {loadingCandidates ? (
                        <div className="py-4 text-center text-xs text-slate-400 font-medium flex items-center justify-center gap-2">
                          <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                          <span>Loading pipeline candidates...</span>
                        </div>
                      ) : pipelineCandidates.length > 0 ? (
                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                          {pipelineCandidates.map((cand, idx) => {
                            const cid = cand.id || cand._id || `cand_${idx}`
                            const isChecked = selectedCandidateIds.has(cid)
                            const cName = cand.candidate_name || cand.name || cand.candidate?.name || 'Candidate'
                            const cEmail = cand.candidate_email || cand.email || cand.candidate?.email || 'No email'
                            const atsMatch = cand.recruiter_score || cand.match_score

                            return (
                              <div
                                key={cid}
                                onClick={() => toggleCandidateSelection(cid)}
                                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 cursor-pointer transition ${
                                  isChecked
                                    ? 'bg-white border-indigo-300 shadow-2xs'
                                    : 'bg-white/60 border-slate-200 hover:border-slate-300 opacity-60'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className="text-indigo-600 shrink-0">
                                    {isChecked ? (
                                      <CheckSquare size={16} className="text-indigo-600" />
                                    ) : (
                                      <Square size={16} className="text-slate-300" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-800 truncate">{cName}</div>
                                    <div className="text-[11px] text-slate-400 truncate">{cEmail}</div>
                                  </div>
                                </div>

                                {atsMatch && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                    ATS: {atsMatch}%
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-800">
                          No applicants currently in the Interview pipeline for this job. Drag candidates to the Interview column on Kanban first.
                        </div>
                      )}
                    </div>

                    {/* 3. Clean Light Blueprint Card (5 Resume + 5 JD) */}
                    <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                          <BrainCircuit size={15} className="text-indigo-600" />
                          <span>AI Assessment Structure</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {10 + customQuestions.length} Questions Total
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-white border border-indigo-100 flex items-start gap-2 shadow-2xs">
                          <FileText size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-800 block">5 Resume Deep-Dive Questions</span>
                            <span className="text-[11px] text-slate-500">
                              Past internships, projects, tools & achievements.
                            </span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-indigo-100 flex items-start gap-2 shadow-2xs">
                          <Target size={14} className="text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-800 block">5 Job Description Questions</span>
                            <span className="text-[11px] text-slate-500">
                              Core role requirements & practical scenarios.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4. Focus Mode & Deadline */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          3. Interview Focus Mode
                        </label>
                        <CustomDropdown
                          options={INTERVIEW_MODES}
                          value={interviewMode}
                          onChange={setInterviewMode}
                          className="w-full"
                          buttonClassName="py-2.5 px-3.5 text-xs font-bold rounded-xl bg-slate-50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Link Expiry / Deadline
                        </label>
                        <CustomDropdown
                          options={EXPIRY_OPTIONS}
                          value={expiryHours}
                          onChange={setExpiryHours}
                          icon={<Clock size={13} className="text-slate-400" />}
                          className="w-full"
                          buttonClassName="py-2.5 px-3.5 text-xs font-bold rounded-xl bg-slate-50"
                        />
                      </div>
                    </div>

                    {/* 5. Assessment Difficulty */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        4. Assessment Difficulty
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {DIFFICULTY_OPTIONS.map((opt) => {
                          const isSelected = difficulty === opt.value
                          return (
                            <div
                              key={opt.value}
                              onClick={() => setDifficulty(opt.value)}
                              className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/20'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${opt.badgeClass}`}
                                >
                                  {opt.title}
                                </span>
                                <input
                                  type="radio"
                                  checked={isSelected}
                                  onChange={() => setDifficulty(opt.value)}
                                  className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500"
                                />
                              </div>
                              <p className="text-[11px] text-slate-500 font-medium leading-snug mt-1">
                                {opt.desc}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* 6. Interviewer Custom Questions (Clean Input + Delete List, No Example Chips) */}
                    <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquarePlus size={16} className="text-indigo-600" />
                          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            5. Interviewer Custom Questions ({customQuestions.length}/5)
                          </label>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">
                          Optional — Injected verbatim into AI test
                        </span>
                      </div>

                      {/* Add Question Input Box */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Type your own custom question here..."
                          value={newQuestionInput}
                          onChange={(e) => setNewQuestionInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddCustomQuestion()
                            }
                          }}
                          disabled={customQuestions.length >= 5}
                          className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium disabled:bg-slate-100"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomQuestion}
                          disabled={!newQuestionInput.trim() || customQuestions.length >= 5}
                          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus size={14} /> Add
                        </button>
                      </div>

                      {/* Added Custom Questions List */}
                      {customQuestions.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {customQuestions.map((q, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-xl bg-white border border-indigo-100 text-xs flex items-start justify-between gap-2 shadow-2xs group"
                            >
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-black text-[10px] shrink-0 mt-0.5">
                                  Q{idx + 1}
                                </span>
                                <span className="text-slate-800 font-medium leading-relaxed">{q}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomQuestion(idx)}
                                className="w-6 h-6 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition shrink-0 cursor-pointer"
                                title="Remove question"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Submit Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={submitting || !selectedJob || selectedCount === 0}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 disabled:opacity-50 transition cursor-pointer"
                      >
                        {submitting ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>
                              {selectedCount > 1
                                ? `Generating AI Sessions for ${selectedCount} Candidates...`
                                : 'Generating AI Session & Inviting...'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Send size={14} />
                            <span>
                              {selectedCount > 1
                                ? `Send AI Invites to ${selectedCount} Candidates →`
                                : 'Generate Magic Link & Send Invite →'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )
    : null
}
