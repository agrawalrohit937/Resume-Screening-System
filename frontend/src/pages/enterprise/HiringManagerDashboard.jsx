import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Briefcase,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  DollarSign,
  TrendingUp,
  FileCheck,
  Building,
  Check,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Eye,
  Star,
  MessageSquare,
  ExternalLink,
  Award,
  FileText
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getRequisitions,
  getPipelineCandidates,
  recordApprovalDecision,
  updateApplicationStage,
  getScorecardsByApplication,
  getCalibrationReport
} from '../../services/api'
import { useTenant } from '../../context/TenantContext'
import { useAuth } from '../../context/AuthContext'

const RECOMMENDATION_CONFIG = {
  strong_yes: { label: 'Strong Yes', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  yes: { label: 'Yes', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  mixed: { label: 'Mixed / Neutral', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  no: { label: 'No', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  strong_no: { label: 'Strong No', color: 'bg-rose-50 text-rose-700 border-rose-200' },
}

export default function HiringManagerDashboard() {
  const { tenantId } = useTenant()
  const { user } = useAuth()

  const [requisitions, setRequisitions] = useState([])
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [decisionModal, setDecisionModal] = useState(null) // { reqId, decision: 'approved' | 'rejected' }
  const [comment, setComment] = useState('')
  const [submittingDecision, setSubmittingDecision] = useState(false)
  const [hiringLoading, setHiringLoading] = useState({}) // { [candidateId]: true } while PATCH in-flight

  // Calibration & Scorecard Review State
  const [selectedCandidateForCalibration, setSelectedCandidateForCalibration] = useState(null)
  const [calibrationReport, setCalibrationReport] = useState(null)
  const [scorecardsList, setScorecardsList] = useState([])
  const [loadingCalibration, setLoadingCalibration] = useState(false)

  const openCalibrationModal = async (cand) => {
    setSelectedCandidateForCalibration(cand)
    setLoadingCalibration(true)
    setCalibrationReport(null)
    setScorecardsList([])

    try {
      const appId = cand.application_id || cand.id
      const [scorecardsRes, calibRes] = await Promise.allSettled([
        getScorecardsByApplication(appId),
        getCalibrationReport(appId, cand.stage || 'Technical Interview')
      ])

      if (scorecardsRes.status === 'fulfilled' && Array.isArray(scorecardsRes.value.data)) {
        setScorecardsList(scorecardsRes.value.data)
      }
      if (calibRes.status === 'fulfilled' && calibRes.value.data) {
        setCalibrationReport(calibRes.value.data)
      }
    } catch (err) {
      console.error('[HiringManagerDashboard] Error fetching calibration data:', err)
      toast.error('Could not load candidate scorecards.')
    } finally {
      setLoadingCalibration(false)
    }
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [reqRes, candRes] = await Promise.allSettled([
        getRequisitions(),
        getPipelineCandidates()
      ])

      if (reqRes.status === 'fulfilled') {
        setRequisitions(Array.isArray(reqRes.value.data) ? reqRes.value.data : [])
      } else {
        setRequisitions([])
      }

      if (candRes.status === 'fulfilled') {
        setCandidates(Array.isArray(candRes.value.data) ? candRes.value.data : [])
      } else {
        setCandidates([])
      }
    } catch (err) {
      console.error('[HiringManagerDashboard] Fetch error:', err)
      setRequisitions([])
      setCandidates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [tenantId, fetchData])

  const handleApprovalSubmit = async () => {
    if (!decisionModal) return
    const { reqId, decision } = decisionModal
    setSubmittingDecision(true)

    try {
      await recordApprovalDecision(reqId, { decision, comments: comment })
      toast.success(`Requisition ${decision === 'approved' ? 'Signed Off' : 'Rejected'}! 📋`)
      await fetchData()
    } catch (e) {
      // Optimistic local update in case backend demo mock
      setRequisitions(prev =>
        prev.map(r => {
          if (r.id === reqId) {
            const updatedChain = (r.approval_chain || []).map(step => {
              const role = step.role || step.approver_role
              return role === 'Hiring Manager' ? { ...step, status: decision } : step
            })
            const allApproved = updatedChain.every(s => s.status === 'approved')
            return {
              ...r,
              status: decision === 'rejected' ? 'rejected' : allApproved ? 'approved' : 'pending_approval',
              approval_chain: updatedChain
            }
          }
          return r
        })
      )
      toast.success(`Requisition decision recorded!`)
    } finally {
      setSubmittingDecision(false)
      setDecisionModal(null)
      setComment('')
    }
  }

  const handleCandidateAction = async (candId, actionName) => {
    const target = candidates.find(c => c.id === candId)
    const candName = target?.name || 'Candidate'
    // Prefer the real application document ID; fall back to cand.id for legacy data
    const appId = target?.application_id || candId

    setHiringLoading(prev => ({ ...prev, [candId]: actionName }))
    try {
      if (actionName === 'hired') {
        await updateApplicationStage(appId, 'Hired')
        toast.success(`🎉 Offer extended to ${candName}! Headcount recorded.`)
        // Remove from active pipeline — decision is final
        setCandidates(prev => prev.map(c => c.id === candId ? { ...c, status: 'hired', stage: 'Hired' } : c))
      } else if (actionName === 'rejected') {
        await updateApplicationStage(appId, 'Rejected')
        toast.error(`Candidate ${candName} marked as rejected.`)
        setCandidates(prev => prev.map(c => c.id === candId ? { ...c, status: 'rejected', stage: 'Rejected' } : c))
      } else if (actionName === 'advance') {
        await updateApplicationStage(appId, 'Executive Review & Calibration')
        toast.success(`Candidate ${candName} advanced to next stage! 🚀`)
        setCandidates(prev => prev.map(c => c.id === candId ? { ...c, stage: 'Executive Review & Calibration' } : c))
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || `Action failed for ${candName}. Please try again.`)
    } finally {
      setHiringLoading(prev => { const n = { ...prev }; delete n[candId]; return n })
    }
  }

  const totalOpenHeadcount = requisitions.reduce((acc, r) => {
    const head = Number(r.headcount) || 0
    const filled = Number(r.filled_count) || 0
    return acc + Math.max(0, head - filled)
  }, 0)

  // Active pipeline: exclude candidates who have already been hired or rejected
  const activeCandidates = candidates.filter(c => c.status !== 'hired' && c.status !== 'rejected')
  const decidedCandidates = candidates.filter(c => c.status === 'hired' || c.status === 'rejected')
  const activeCandidatesCount = activeCandidates.length

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 font-sans space-y-10 max-w-7xl mx-auto">
      
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200/60 inline-flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5" /> Hiring Manager Portal
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-2 tracking-tight">
            Requisitions & Department Pipeline
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage headcount allocations, approve hiring budgets, and decide on candidate offers.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3 px-5 text-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Open Headcount</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{totalOpenHeadcount} {totalOpenHeadcount === 1 ? 'Role' : 'Roles'}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3 px-5 text-center">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">In Pipeline</div>
            <div className="text-2xl font-black text-purple-600 mt-0.5">{activeCandidatesCount} Candidates</div>
          </div>
          <button
            onClick={fetchData}
            title="Refresh dashboard"
            className="p-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-purple-600 hover:border-purple-200 transition shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && requisitions.length === 0 && candidates.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center space-y-4 bg-white rounded-3xl border border-slate-200/80 shadow-sm">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading department requisitions & talent pipeline...</p>
        </div>
      ) : (
        <>
          {/* Section 1: Headcount & Requisition Approval Chain */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Headcount Requisitions & Budget Approval
              </h2>
              <span className="text-xs text-slate-500 font-medium">Sequential 3-Step Approval</span>
            </div>

            {requisitions.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                  <Briefcase className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No active requisitions</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  There are currently no headcount requisitions awaiting your review or assigned to your department.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {requisitions.map((req) => {
                  const chain = req.approval_chain || []
                  const isPendingManager = chain.some(
                    s => (s.role === 'Hiring Manager' || s.approver_role === 'hiring_manager') && s.status === 'pending'
                  )

                  const formattedBudget = req.budget_range || (
                    req.budget_min && req.budget_max
                      ? `${req.budget_currency || '$'}${Number(req.budget_min).toLocaleString()} - ${req.budget_currency || '$'}${Number(req.budget_max).toLocaleString()}`
                      : req.budget_min
                      ? `${req.budget_currency || '$'}${Number(req.budget_min).toLocaleString()}`
                      : 'Unspecified'
                  )

                  return (
                    <div key={req.id} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            req.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : req.status === 'rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {(req.status || 'pending').replace('_', ' ')}
                          </span>
                          <h3 className="font-bold text-slate-900 text-lg mt-2">{req.title}</h3>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">{req.department} • Headcount: {req.headcount || 1}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400">Budget Range</span>
                          <div className="text-xs font-bold text-slate-800 mt-0.5">{formattedBudget}</div>
                        </div>
                      </div>

                      {/* Approval Chain Stepper */}
                      {chain.length > 0 && (
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Approval Chain</div>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            {chain.map((step, idx) => (
                              <div key={step.step || step.step_order || idx} className="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
                                <div className="text-[10px] text-slate-400">{step.role || step.approver_role || 'Approver'}</div>
                                <div className="font-bold text-slate-800 truncate mt-0.5">{step.approver || step.approver_id || 'Reviewer'}</div>
                                <div className={`mt-1 text-[10px] font-bold capitalize ${
                                  step.status === 'approved' ? 'text-emerald-600' : step.status === 'rejected' ? 'text-rose-600' : 'text-amber-600'
                                }`}>
                                  {step.status || 'pending'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons for Hiring Manager */}
                      {isPendingManager && (
                        <div className="flex items-center gap-3 pt-2">
                          <button
                            onClick={() => setDecisionModal({ reqId: req.id, decision: 'approved' })}
                            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-700 transition flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <Check className="w-4 h-4" /> Approve Requisition
                          </button>
                          <button
                            onClick={() => setDecisionModal({ reqId: req.id, decision: 'rejected' })}
                            className="px-4 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-600 font-semibold text-xs hover:bg-rose-50 transition flex items-center gap-1"
                          >
                            <X className="w-4 h-4" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Section 2: Candidate Pipeline & Hiring Decisions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Active Candidate Pipeline &amp; Decisions
              </h2>
              <span className="text-xs text-slate-500 font-medium">Ranked by Calibrated ATS Match</span>
            </div>

            {activeCandidates.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200/80 rounded-3xl shadow-sm space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No active pipeline candidates</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Candidates shortlisted by recruiters or advancing to your department's roles will appear here.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
                <div className="divide-y divide-slate-100">
                  {activeCandidates.map((cand) => {
                    const isActing = !!hiringLoading[cand.id]
                    return (
                      <div key={cand.id} className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition">
                        {/* Info column */}
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => openCalibrationModal(cand)}
                              className="group flex items-center gap-1.5 font-bold text-slate-900 text-base hover:text-purple-600 transition-colors text-left"
                              title="Click to review candidate calibration & scorecards"
                            >
                              <span>{cand.name}</span>
                              <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 transition-colors" />
                            </button>

                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              ATS: {cand.ats_score}%
                            </span>

                            <button
                              type="button"
                              onClick={() => openCalibrationModal(cand)}
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition cursor-pointer hover:opacity-85 flex items-center gap-1.5 ${cand.consensus_color || 'bg-slate-50 text-slate-700 border-slate-200'}`}
                              title="Click to inspect interview calibration consensus"
                            >
                              <FileCheck className="w-3 h-3" />
                              Calibration: {cand.calibration_consensus || 'Pending'}
                            </button>

                            {cand.job_id && (
                              <Link
                                to={`/recruiter/jobs/${cand.job_id}/applicants`}
                                className="text-[11px] font-medium text-slate-400 hover:text-purple-600 transition flex items-center gap-0.5"
                                title="View in Job Pipeline"
                              >
                                Pipeline <ExternalLink className="w-2.5 h-2.5" />
                              </Link>
                            )}
                          </div>

                          <div className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-2">
                            <span>{cand.role}</span>
                            <span>•</span>
                            <span>Stage: <strong className="text-slate-700">{cand.stage}</strong></span>
                            <span>•</span>
                            <span>{cand.years_experience} YOE</span>
                            {cand.resume_url && (
                              <>
                                <span>•</span>
                                <a
                                  href={cand.resume_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-purple-600 hover:underline flex items-center gap-1 font-medium"
                                >
                                  <FileText className="w-3 h-3" /> Resume
                                </a>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {cand.status === 'active' || !cand.status ? (
                          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => openCalibrationModal(cand)}
                              disabled={isActing}
                              className="px-3.5 py-2 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/80 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                              title="Review interviewer scorecards and qualitative evidence"
                            >
                              <FileCheck className="w-3.5 h-3.5 text-purple-600" />
                              Review Scorecards
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCandidateAction(cand.id, 'advance')}
                              disabled={isActing}
                              className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition flex items-center gap-1 disabled:opacity-50"
                            >
                              {hiringLoading[cand.id] === 'advance'
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <ArrowRight className="w-3.5 h-3.5" />}
                              Advance
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCandidateAction(cand.id, 'hired')}
                              disabled={isActing}
                              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-60"
                            >
                              {hiringLoading[cand.id] === 'hired'
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <CheckCircle2 className="w-3.5 h-3.5" />}
                              {hiringLoading[cand.id] === 'hired' ? 'Processing…' : 'Extend Offer / Hire'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCandidateAction(cand.id, 'rejected')}
                              disabled={isActing}
                              className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition text-xs font-semibold disabled:opacity-50"
                            >
                              {hiringLoading[cand.id] === 'rejected'
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />
                                : null}
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openCalibrationModal(cand)}
                              className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-semibold transition flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> View Scorecards
                            </button>
                            <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider ${
                              cand.status === 'hired' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {cand.status}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Decided Candidates (Hired / Rejected) — collapsible audit trail */}
          {decidedCandidates.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-500 tracking-tight flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
                Decided ({decidedCandidates.length}) — Hired &amp; Rejected
              </h3>
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
                {decidedCandidates.map((cand) => (
                  <div key={cand.id} className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 opacity-80 hover:opacity-100 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-slate-800 text-sm">{cand.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          ATS: {cand.ats_score}%
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">{cand.role} • Stage: <span className="font-semibold text-slate-600">{cand.stage}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openCalibrationModal(cand)}
                        className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-semibold transition flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> Scorecards
                      </button>
                      <span className={`px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider ${
                        cand.status === 'hired'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {cand.status === 'hired' ? '🎉 Hired' : 'Rejected'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Calibration & Scorecard Review Modal */}
      <AnimatePresence>
        {selectedCandidateForCalibration && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 md:p-8 z-50 overflow-hidden">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] border border-slate-200 shadow-2xl flex flex-col my-auto overflow-hidden"
            >
              {/* Sticky / Fixed Modal Header */}
              <div className="shrink-0 p-6 md:px-8 border-b border-slate-100 bg-white flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg shrink-0">
                    {selectedCandidateForCalibration.name?.slice(0, 2).toUpperCase() || 'CA'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">
                        {selectedCandidateForCalibration.name}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        ATS: {selectedCandidateForCalibration.ats_score}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {selectedCandidateForCalibration.role} • Stage: <span className="font-semibold text-purple-700">{selectedCandidateForCalibration.stage}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedCandidateForCalibration.resume_url && (
                    <a
                      href={selectedCandidateForCalibration.resume_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-purple-600 hover:border-purple-200 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <FileText className="w-3.5 h-3.5" /> Resume
                    </a>
                  )}
                  {selectedCandidateForCalibration.job_id && (
                    <Link
                      to={`/recruiter/jobs/${selectedCandidateForCalibration.job_id}/applicants`}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-purple-600 hover:border-purple-200 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Pipeline
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedCandidateForCalibration(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Gracefully Scrolling Internal Content Area */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                {loadingCalibration ? (
                  <div className="py-14 flex flex-col items-center justify-center space-y-3">
                    <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                    <p className="text-xs text-slate-500 font-medium">Fetching interview scorecards & consensus report from MongoDB...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Calibration Consensus Banner */}
                    <div className="bg-gradient-to-br from-purple-50/60 via-slate-50 to-indigo-50/40 rounded-2xl p-5 border border-purple-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-purple-600" />
                          Inter-Rater Calibration Overview
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize border ${
                          calibrationReport?.calibration_status === 'calibrated'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : calibrationReport?.calibration_status === 'split_decision'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {calibrationReport?.calibration_status ? calibrationReport.calibration_status.replace('_', ' ') : 'Review Needed'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {calibrationReport?.recommendation_summary ||
                          'Synthesized assessment across all interviewer kits submitted for this requisition stage.'}
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-center">
                        <div className="bg-white/80 p-2.5 rounded-xl border border-purple-100/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Scorecards</span>
                          <span className="text-lg font-black text-slate-900">{calibrationReport?.scorecard_count || scorecardsList.length}</span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-purple-100/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Mean Score</span>
                          <span className="text-lg font-black text-purple-700">{calibrationReport?.mean_score ? Number(calibrationReport.mean_score).toFixed(1) : (calibrationReport?.mean_competency_score ? Number(calibrationReport.mean_competency_score).toFixed(1) : 'N/A')}/5</span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-purple-100/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Score Variance</span>
                          <span className="text-lg font-black text-slate-900">{calibrationReport?.score_variance !== undefined ? Number(calibrationReport.score_variance).toFixed(2) : (calibrationReport?.rating_variance !== undefined ? Number(calibrationReport.rating_variance).toFixed(2) : '0.00')}</span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-purple-100/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Consensus</span>
                          <span className="text-xs font-black text-slate-900 uppercase block mt-1">
                            {calibrationReport?.consensus_recommendation ? calibrationReport.consensus_recommendation.replace('_', ' ') : (scorecardsList.length > 0 ? 'Evaluating' : 'Pending')}
                          </span>
                        </div>
                      </div>

                      {/* Divergent Raters Alert */}
                      {calibrationReport?.divergent_raters && calibrationReport.divergent_raters.length > 0 && (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            <strong>Calibration Variance Flag:</strong> Interviewer(s) <strong>{calibrationReport.divergent_raters.join(', ')}</strong> deviated significantly from consensus.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Interviewer Scorecards List */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-purple-600" />
                        Submitted Scorecards ({scorecardsList.length})
                      </h4>

                      {scorecardsList.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-500 text-xs space-y-2">
                          <MessageSquare className="w-8 h-8 text-slate-400 mx-auto" />
                          <div className="text-xs font-bold text-slate-700">No scorecards submitted yet</div>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            Interviewers assigned to this candidate will submit rubrics and qualitative remarks through the Interviewer Portal.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {scorecardsList.map((sc, idx) => {
                            const recConfig = RECOMMENDATION_CONFIG[sc.recommendation] || {
                              label: (sc.recommendation || 'Mixed').replace('_', ' '),
                              color: 'bg-slate-100 text-slate-700 border-slate-200'
                            }
                            const submittedDate = sc.submitted_at
                              ? new Date(sc.submitted_at).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Recently'

                            return (
                              <div
                                key={sc.id || sc._id || idx}
                                className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3 hover:border-purple-200 transition"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                                      {sc.interviewer_id?.slice(0, 2).toUpperCase() || 'IN'}
                                    </div>
                                    <div>
                                      <h5 className="text-xs font-bold text-slate-900">
                                        {sc.interviewer_id || `Interviewer #${idx + 1}`}
                                      </h5>
                                      <p className="text-[11px] text-slate-400">
                                        Stage: <span className="font-semibold text-slate-700">{sc.stage_name || 'Interview'}</span> • {submittedDate}
                                      </p>
                                    </div>
                                  </div>

                                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase border ${recConfig.color}`}>
                                    {recConfig.label}
                                  </span>
                                </div>

                                {/* Competency Breakdown */}
                                {sc.ratings && Object.keys(sc.ratings).length > 0 && (
                                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-2">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                      Competency Ratings
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                      {Object.entries(sc.ratings).map(([competency, score]) => (
                                        <div
                                          key={competency}
                                          className="bg-white p-2.5 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs"
                                        >
                                          <span className="font-medium text-slate-700 truncate mr-2">{competency}</span>
                                          <div className="flex items-center gap-1 shrink-0">
                                            {[1, 2, 3, 4, 5].map((val) => (
                                              <span
                                                key={val}
                                                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                                  val <= Number(score)
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-slate-200 text-slate-400'
                                                }`}
                                              >
                                                {val}
                                              </span>
                                            ))}
                                            <span className="ml-1 text-xs font-bold text-slate-800">
                                              {score}/5
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Qualitative Notes */}
                                {sc.notes && (
                                  <div className="space-y-1.5">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                      <MessageSquare className="w-3 h-3" /> Qualitative Remarks & Evidence
                                    </div>
                                    <p className="text-xs text-slate-700 bg-slate-50/80 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap leading-relaxed">
                                      {sc.notes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sticky / Pinned Decision Actions Footer */}
              <div className="shrink-0 p-4 md:px-8 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500 font-medium">
                  Pipeline decision for <strong className="text-slate-800">{selectedCandidateForCalibration.name}</strong>:
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleCandidateAction(selectedCandidateForCalibration.id, 'advance')
                      setSelectedCandidateForCalibration(null)
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition flex items-center gap-1 cursor-pointer"
                  >
                    Advance <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleCandidateAction(selectedCandidateForCalibration.id, 'hired')
                      setSelectedCandidateForCalibration(null)
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Extend Offer / Hire
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleCandidateAction(selectedCandidateForCalibration.id, 'rejected')
                      setSelectedCandidateForCalibration(null)
                    }}
                    className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition text-xs font-semibold cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCandidateForCalibration(null)}
                    className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Decision Modal */}
      <AnimatePresence>
        {decisionModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-4"
            >
              <h3 className="text-lg font-bold text-slate-900">
                Confirm {decisionModal.decision === 'approved' ? 'Approval' : 'Rejection'}
              </h3>
              <p className="text-xs text-slate-500">
                Provide rationale or comments for the finance and executive review chain.
              </p>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional comments / notes..."
                className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setDecisionModal(null)}
                  disabled={submittingDecision}
                  className="px-4 py-2 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprovalSubmit}
                  disabled={submittingDecision}
                  className={`px-5 py-2 rounded-xl text-white text-xs font-semibold transition flex items-center gap-1.5 ${
                    decisionModal.decision === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {submittingDecision && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Decision
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

