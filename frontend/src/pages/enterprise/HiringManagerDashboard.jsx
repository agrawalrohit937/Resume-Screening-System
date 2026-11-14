import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  FileText,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getRequisitions,
  getPipelineCandidates,
  recordApprovalDecision,
  updateApplicationStage,
  getScorecardsByApplication,
  getCalibrationReport,
  createRequisition,
  submitRequisition
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
  const [hiringLoading, setHiringLoading] = useState({}) // { [candidateId]: true } while PATCH in-flight

  // Create Requisition Form State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creatingReq, setCreatingReq] = useState(false)
  const [newReqForm, setNewReqForm] = useState({
    title: '',
    department: 'Engineering',
    headcount: 1,
    budget_currency: 'INR',
    budget_min: 1200000,
    budget_max: 1800000,
  })

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

  const handleCreateRequisition = async (e) => {
    e.preventDefault()
    if (!newReqForm.title.trim()) {
      toast.error('Please enter a position title')
      return
    }

    setCreatingReq(true)
    try {
      const res = await createRequisition({
        title: newReqForm.title.trim(),
        department: newReqForm.department,
        headcount: Number(newReqForm.headcount) || 1,
        budget_min: Number(newReqForm.budget_min) || 0,
        budget_max: Number(newReqForm.budget_max) || 0,
        budget_currency: newReqForm.budget_currency,
      })

      const reqId = res?.data?.id
      if (reqId) {
        try {
          await submitRequisition(reqId)
        } catch {
          // ignore if already submitted
        }
      }

      toast.success('Requisition raised and submitted for approval! 📋')
      setShowCreateModal(false)
      setNewReqForm({
        title: '',
        department: 'Engineering',
        headcount: 1,
        budget_currency: 'INR',
        budget_min: 1200000,
        budget_max: 1800000,
      })
      await fetchData()
    } catch (err) {
      console.error('[HiringManagerDashboard] Create requisition error:', err)
      toast.error(err?.response?.data?.detail || 'Failed to create requisition.')
    } finally {
      setCreatingReq(false)
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

  const reqScrollRef = useRef(null)

  const scrollReqHorizontally = (offset) => {
    if (reqScrollRef.current) {
      reqScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' })
    }
  }

  // Sort requisitions: newest created_at first
  const sortedRequisitions = useMemo(() => {
    return [...requisitions].sort((a, b) => {
      const da = new Date(a.created_at || 0).getTime()
      const db = new Date(b.created_at || 0).getTime()
      if (db !== da) return db - da
      return String(b.id || '').localeCompare(String(a.id || ''))
    })
  }, [requisitions])

  // Active pipeline: exclude candidates who have already been hired or rejected
  const activeCandidates = candidates.filter(c => c.status !== 'hired' && c.status !== 'rejected')
  const decidedCandidates = candidates.filter(c => c.status === 'hired' || c.status === 'rejected')
  const activeCandidatesCount = activeCandidates.length

  return (
    <div className="min-h-screen bg-slate-50/50 py-5 px-4 sm:px-6 lg:px-8 font-sans space-y-6 max-w-7xl mx-auto">
      
      {/* Sleek Top Header Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/70 inline-flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" /> Hiring Manager Portal
            </span>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {user?.name || user?.full_name || 'Engineering'}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            Requisitions &amp; Department Pipeline
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage headcount allocations, approve hiring budgets, and decide on candidate offers.
          </p>
        </div>

        {/* Stats & Actions Row */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2">
            <div className="bg-slate-50 border border-slate-200/70 rounded-xl px-3.5 py-2 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Open Headcount</div>
              <div className="text-base font-black text-slate-900 leading-tight">{totalOpenHeadcount} {totalOpenHeadcount === 1 ? 'Role' : 'Roles'}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200/70 rounded-xl px-3.5 py-2 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Pipeline</div>
              <div className="text-base font-black text-indigo-600 leading-tight">{activeCandidatesCount} Candidates</div>
            </div>
            <button
              onClick={fetchData}
              title="Refresh dashboard"
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/70 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm hover:shadow shadow-indigo-600/20 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            Raise Requisition
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && requisitions.length === 0 && candidates.length === 0 ? (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs animate-pulse space-y-4">
            <div className="h-5 w-48 bg-slate-200 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-28 bg-slate-100 rounded-2xl" />
              <div className="h-28 bg-slate-100 rounded-2xl" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs animate-pulse space-y-4">
            <div className="h-5 w-48 bg-slate-200 rounded" />
            <div className="h-40 bg-slate-100 rounded-2xl" />
          </div>
        </div>
      ) : (
        <>
          {/* Section 1: Headcount & Requisition Approval Chain */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-0.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Headcount Requisitions &amp; Executive Sign-Off
                </h2>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {sortedRequisitions.length}
                </span>
              </div>

              {sortedRequisitions.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">
                    Scroll horizontally
                  </span>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => scrollReqHorizontally(-380)}
                      title="Scroll Left"
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollReqHorizontally(380)}
                      title="Scroll Right"
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {sortedRequisitions.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <Briefcase className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No active requisitions</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  There are currently no headcount requisitions awaiting your review or assigned to your department.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Raise First Requisition
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div
                  ref={reqScrollRef}
                  className="flex items-stretch gap-4 overflow-x-auto pb-3 pt-1 px-0.5 custom-scrollbar snap-x snap-mandatory scroll-smooth"
                >
                  {sortedRequisitions.map((req) => {
                    const chain = req.approval_chain || []
                    const sym = (req.budget_currency === 'INR' || !req.budget_currency) ? '₹ ' : `${req.budget_currency} `
                    const formattedBudget = req.budget_range || (
                      req.budget_min && req.budget_max
                        ? `${sym}${Number(req.budget_min).toLocaleString()} - ${sym}${Number(req.budget_max).toLocaleString()}`
                        : req.budget_min
                        ? `${sym}${Number(req.budget_min).toLocaleString()}`
                        : 'Unspecified'
                    )

                    const execStep = chain.find(
                      s => s.approver_role === 'executive' || s.approver_role === 'admin' || s.approver_id === 'finance_admin'
                    ) || chain[0]

                    const isApproved = req.status === 'approved' || execStep?.status === 'approved'
                    const isRejected = req.status === 'rejected' || execStep?.status === 'rejected'
                    const isPending = !isApproved && !isRejected

                    // Format Requester Name
                    const rawCreator = req.hiring_manager_name || (req.hiring_manager_id === user?.id ? (user?.name || user?.email) : null)
                    let creatorDisplay = 'Hiring Manager'
                    if (rawCreator) {
                      if (rawCreator.includes('@')) {
                        creatorDisplay = user?.name ? `${user.name} (You)` : rawCreator.split('@')[0]
                      } else {
                        creatorDisplay = rawCreator.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
                      }
                    }

                    // Format Approver Name
                    const rawApprover = execStep?.approver_name || 'Company Executive'
                    const approverDisplay = rawApprover.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())

                    return (
                      <div
                        key={req.id}
                        className="w-[340px] sm:w-[380px] shrink-0 snap-start bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                      >
                      {/* Top Header */}
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${
                                isApproved
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isRejected
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {isApproved ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Approved
                                </>
                              ) : isRejected ? (
                                <>
                                  <X className="w-3.5 h-3.5 text-rose-600" /> Rejected
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3.5 h-3.5 text-amber-600" /> Pending Approval
                                </>
                              )}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                              {req.department || 'Engineering'}
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Salary Range</span>
                            <div className="text-xs font-bold text-slate-900 mt-0.5">
                              {formattedBudget}
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-slate-900 tracking-tight">{req.title}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Target Headcount: <strong className="text-slate-800">{req.headcount || 1} {req.headcount === 1 ? 'Role' : 'Roles'}</strong>
                          </p>
                        </div>
                      </div>

                      {/* Governance & Sign-Off Pipeline */}
                      <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 grid grid-cols-2 gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Requested By</div>
                          <div className="font-semibold text-slate-800 truncate" title={creatorDisplay}>
                            {creatorDisplay}
                          </div>
                          <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Raised
                          </div>
                        </div>

                        <div className="space-y-0.5 border-l border-slate-200/80 pl-3">
                          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Executive Sign-Off</div>
                          <div className="font-semibold text-slate-800 truncate" title={approverDisplay}>
                            {approverDisplay}
                          </div>
                          <div className={`text-[10px] font-bold capitalize flex items-center gap-1 ${
                            isApproved ? 'text-emerald-600' : isRejected ? 'text-rose-600' : 'text-amber-600'
                          }`}>
                            {isApproved ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Authorized
                              </>
                            ) : isRejected ? (
                              <>
                                <X className="w-3 h-3 text-rose-600" /> Declined
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-amber-600" /> In Review
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Status Banner */}
                      <div className="pt-1">
                        {req.status === 'draft' && (
                          <button
                            onClick={async () => {
                              try {
                                await submitRequisition(req.id)
                                toast.success('Requisition submitted for approval! 📋')
                                await fetchData()
                              } catch {
                                toast.error('Failed to submit requisition.')
                              }
                            }}
                            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <ArrowRight className="w-4 h-4" /> Submit for Approval
                          </button>
                        )}

                        {isPending && (
                          <div className="flex items-center gap-2 text-xs font-medium text-amber-800 bg-amber-50/70 border border-amber-200/70 rounded-xl px-3 py-2">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">Awaiting executive budget sign-off</span>
                          </div>
                        )}

                        {isApproved && (
                          <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50/70 border border-emerald-200/70 rounded-xl px-3 py-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">Approved by Executive. Authorized for hiring.</span>
                          </div>
                        )}

                        {isRejected && (
                          <div className="flex items-center gap-2 text-xs font-medium text-rose-800 bg-rose-50/70 border border-rose-200/70 rounded-xl px-3 py-2">
                            <X className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span className="truncate">Requisition rejected during executive budget review.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Candidate Pipeline & Hiring Decisions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
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
                              className="group flex items-center gap-1.5 font-bold text-slate-900 text-base hover:text-indigo-600 transition-colors text-left"
                              title="Click to review candidate calibration & scorecards"
                            >
                              <span>{cand.name}</span>
                              <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
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
                                className="text-[11px] font-medium text-slate-400 hover:text-indigo-600 transition flex items-center gap-0.5"
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
                                  className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
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
                              className="px-3.5 py-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                              title="Review interviewer scorecards and qualitative evidence"
                            >
                              <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
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
                              className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold transition flex items-center gap-1"
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
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold transition flex items-center gap-1"
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
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shrink-0">
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
                      {selectedCandidateForCalibration.role} • Stage: <span className="font-semibold text-indigo-700">{selectedCandidateForCalibration.stage}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedCandidateForCalibration.resume_url && (
                    <a
                      href={selectedCandidateForCalibration.resume_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <FileText className="w-3.5 h-3.5" /> Resume
                    </a>
                  )}
                  {selectedCandidateForCalibration.job_id && (
                    <Link
                      to={`/recruiter/jobs/${selectedCandidateForCalibration.job_id}/applicants`}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition"
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
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    <p className="text-xs text-slate-500 font-medium">Fetching interview scorecards & consensus report from database...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Calibration Consensus Banner */}
                    <div className="bg-gradient-to-br from-indigo-50/60 via-slate-50 to-blue-50/40 rounded-2xl p-5 border border-indigo-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-indigo-600" />
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
                        <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Scorecards</span>
                          <span className="text-lg font-black text-slate-900">{calibrationReport?.scorecard_count || scorecardsList.length}</span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Mean Score</span>
                          <span className="text-lg font-black text-indigo-700">{calibrationReport?.mean_score ? Number(calibrationReport.mean_score).toFixed(1) : (calibrationReport?.mean_competency_score ? Number(calibrationReport.mean_competency_score).toFixed(1) : 'N/A')}/5</span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Score Variance</span>
                          <span className="text-lg font-black text-slate-900">{calibrationReport?.score_variance !== undefined ? Number(calibrationReport.score_variance).toFixed(2) : (calibrationReport?.rating_variance !== undefined ? Number(calibrationReport.rating_variance).toFixed(2) : '0.00')}</span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100/60">
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
                        <Users className="w-4 h-4 text-indigo-600" />
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
                                className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3 hover:border-indigo-200 transition"
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
                                                    ? 'bg-indigo-600 text-white'
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

      {/* Create Requisition Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full border border-slate-200 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Raise New Requisition</h3>
                    <p className="text-xs text-slate-500">Official headcount and budget authorization request</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateRequisition} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Job Title / Position Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newReqForm.title}
                    onChange={(e) => setNewReqForm({ ...newReqForm, title: e.target.value })}
                    placeholder="e.g. Senior AI Engineer, Full Stack Developer"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Department <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newReqForm.department}
                      onChange={(e) => setNewReqForm({ ...newReqForm, department: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Data & AI">Data &amp; AI</option>
                      <option value="Product">Product</option>
                      <option value="Design">Design</option>
                      <option value="Operations">Operations</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Sales">Sales</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Headcount (Openings) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      required
                      value={newReqForm.headcount}
                      onChange={(e) => setNewReqForm({ ...newReqForm, headcount: parseInt(e.target.value) || 1 })}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={newReqForm.budget_currency}
                      onChange={(e) => setNewReqForm({ ...newReqForm, budget_currency: e.target.value })}
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Budget Min
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newReqForm.budget_min}
                      onChange={(e) => setNewReqForm({ ...newReqForm, budget_min: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g. 1200000"
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Budget Max
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newReqForm.budget_max}
                      onChange={(e) => setNewReqForm({ ...newReqForm, budget_max: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g. 1800000"
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-[11px] text-indigo-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-indigo-700">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Direct Executive Approval Flow:
                  </div>
                  <div>This requisition is submitted directly to the Company Executive for single-stage budget authorization and hiring sign-off.</div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingReq}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer shadow-indigo-600/20"
                  >
                    {creatingReq ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Submit Requisition
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

