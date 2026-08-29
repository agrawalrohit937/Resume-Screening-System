import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, ShieldAlert, AlertTriangle, CheckCircle2, XCircle,
  Phone, Mail, Bell, RefreshCw, Play, User, ArrowRight,
  Clock, Shield, DollarSign, ChevronRight, X, Filter, Search,
  Activity, Check, ExternalLink, HelpCircle, Layers,
  Volume2, Mic, MicOff, PhoneCall, PhoneOff, Award
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import toast from 'react-hot-toast'

import {
  getRecoveryOverview,
  getRecoveryCases,
  getRecoveryCaseDetail,
  retryRecoveryCase,
  approveRecoveryCase,
  rejectRecoveryCase,
  closeRecoveryCase,
  triggerChannelOutreach,
  interactVoiceRecovery,
  payRecoveredCase,
  RECOVERY_STATUS_CONFIG,
  RISK_LEVEL_CONFIG,
  CHANNEL_CONFIG,
} from '../../services/revenueRecoveryApi'
import { useSpeechToText, useTextToSpeech } from '../../hooks/useSpeech'

// ── Formatters ─────────────────────────────────────────────────────────────
function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const PIE_COLORS = ['#10B981', '#F59E0B', '#EF4444', '#6366F1']

// ═══════════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatusPill({ status }) {
  const cfg = RECOVERY_STATUS_CONFIG[status] || { label: status, color: '#64748B', bg: '#F8FAFC' }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border"
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: `${cfg.color}30` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function RiskBadge({ score, level }) {
  const cfg = RISK_LEVEL_CONFIG[level] || { label: level || 'LOW', color: '#10B981', bg: '#ECFDF5' }
  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center justify-center font-black text-xs px-2 py-0.5 rounded-md border"
        style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: `${cfg.color}40` }}
      >
        {score}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{cfg.label}</span>
    </div>
  )
}

function ChannelIcon({ channel, size = 15 }) {
  const ch = (channel || 'NONE').toUpperCase()
  if (ch === 'VOICE') return <Phone size={size} className="text-emerald-600" />
  if (ch === 'EMAIL') return <Mail size={size} className="text-blue-600" />
  if (ch === 'IN_APP') return <Bell size={size} className="text-purple-600" />
  return <Layers size={size} className="text-slate-400" />
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function RevenueRecoveryTab() {
  // State
  const [overview, setOverview] = useState(null)
  const [loadingOverview, setLoadingOverview] = useState(true)

  const [cases, setCases] = useState([])
  const [pagination, setPagination] = useState({})
  const [filters, setFilters] = useState({
    status: '',
    risk_level: '',
    channel: '',
    plan: '',
    search: '',
    human_review: false,
    page: 1,
  })
  const [loadingCases, setLoadingCases] = useState(false)

  // Modals
  const [selectedCase, setSelectedCase] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)



  // Live Voice Simulator State
  const [voiceModalOpen, setVoiceModalOpen] = useState(false)
  const [voiceCase, setVoiceCase] = useState(null)
  const [voiceTranscript, setVoiceTranscript] = useState([])
  const [voiceInputText, setVoiceInputText] = useState('')
  const [voiceProcessing, setVoiceProcessing] = useState(false)

  // Web Speech hooks
  const { speak, stop: stopTTS, speaking } = useTextToSpeech({ rate: 0.9, lang: 'hi-IN' })
  const {
    listening,
    transcript: micTranscript,
    startListening,
    stopListening,
    resetTranscript,
    supported: sttSupported,
  } = useSpeechToText({
    language: 'hi-IN',
    onFinalTranscript: (text) => {
      if (text) handleSendVoiceUtterance(text)
    },
  })

  // ── Load Analytics ────────────────────────────────────────────────────────
  const loadOverview = useCallback(async () => {
    try {
      setLoadingOverview(true)
      const data = await getRecoveryOverview()
      setOverview(data)
    } catch (err) {
      console.error('Failed to load overview analytics:', err)
      toast.error('Could not load recovery analytics')
    } finally {
      setLoadingOverview(false)
    }
  }, [])

  // ── Load Cases ────────────────────────────────────────────────────────────
  const loadCases = useCallback(async () => {
    try {
      setLoadingCases(true)
      const params = { page: filters.page, page_size: 15 }
      if (filters.status) params.status = filters.status
      if (filters.risk_level) params.risk_level = filters.risk_level
      if (filters.channel) params.channel = filters.channel
      if (filters.plan) params.plan = filters.plan
      if (filters.search) params.search = filters.search
      if (filters.human_review) params.human_review = true

      const data = await getRecoveryCases(params)
      setCases(data.cases || [])
      setPagination(data.pagination || {})
    } catch (err) {
      console.error('Failed to load recovery cases:', err)
      toast.error('Could not load recovery queue')
    } finally {
      setLoadingCases(false)
    }
  }, [filters])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    loadCases()
  }, [loadCases])

  // ── Case Detail Modal ─────────────────────────────────────────────────────
  const openCaseDetail = async (caseId) => {
    try {
      setActionLoading(true)
      const detail = await getRecoveryCaseDetail(caseId)
      setSelectedCase(detail)
      setDetailModalOpen(true)
    } catch {
      toast.error('Failed to load case details')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Admin Actions ─────────────────────────────────────────────────────────
  const handleRetry = async (caseId) => {
    try {
      setActionLoading(true)
      const updated = await retryRecoveryCase(caseId)
      setSelectedCase(updated)
      toast.success('LangGraph recovery pipeline re-executed!')
      loadCases()
      loadOverview()
    } catch {
      toast.error('Retry execution failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = async (caseId, overrideDiscount = null) => {
    try {
      setActionLoading(true)
      const updated = await approveRecoveryCase(caseId, {
        admin_note: 'Approved by admin via dashboard.',
        override_discount_pct: overrideDiscount,
      })
      setSelectedCase(updated)
      toast.success('Escalation approved! Outreach dispatched.')
      loadCases()
      loadOverview()
    } catch {
      toast.error('Approval failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (caseId) => {
    try {
      setActionLoading(true)
      const updated = await rejectRecoveryCase(caseId)
      setSelectedCase(updated)
      toast.success('Escalation rejected. Case stopped.')
      loadCases()
      loadOverview()
    } catch {
      toast.error('Rejection failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleClose = async (caseId) => {
    try {
      setActionLoading(true)
      const updated = await closeRecoveryCase(caseId)
      setSelectedCase(updated)
      toast.success('Case closed.')
      loadCases()
      loadOverview()
    } catch {
      toast.error('Close failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleTriggerChannel = async (caseId, channel) => {
    try {
      setActionLoading(true)
      const updated = await triggerChannelOutreach(caseId, { channel })
      setSelectedCase(updated)
      toast.success(`${channel} outreach triggered successfully!`)
      loadCases()
      loadOverview()
    } catch {
      toast.error('Outreach dispatch failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRefreshAll = async () => {
    try {
      setActionLoading(true)
      await Promise.all([loadCases(), loadOverview()])
      toast.success('Recovery data refreshed from database')
    } catch {
      toast.error('Failed to refresh recovery data')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Voice Simulator ───────────────────────────────────────────────────────
  const openVoiceSimulator = (kase) => {
    setVoiceCase(kase)
    const initialGreeting = `Namaste ${(kase.user_name || 'sir').split(' ')[0]} ji, CareerShala team se call hai. Aapke ${kase.plan || 'Pro'} subscription ka ${formatCurrency(kase.amount || 999)} renewal payment complete nahi ho paya hai. Kya aap isse retry karna chahenge?`
    setVoiceTranscript([
      { role: 'agent', text: initialGreeting, time: new Date().toLocaleTimeString() }
    ])
    setVoiceModalOpen(true)
    speak(initialGreeting)
  }

  const handleSendVoiceUtterance = async (textToSend) => {
    const text = textToSend || voiceInputText
    if (!text.trim()) return

    const newHistory = [
      ...voiceTranscript,
      { role: 'user', text, time: new Date().toLocaleTimeString() }
    ]
    setVoiceTranscript(newHistory)
    setVoiceInputText('')
    resetTranscript()

    try {
      setVoiceProcessing(true)
      const res = await interactVoiceRecovery({
        case_id: voiceCase?.case_id,
        user_utterance: text,
        conversation_history: newHistory.map(h => ({ role: h.role, text: h.text })),
        plan: voiceCase?.plan || 'pro',
        amount: voiceCase?.amount || 999.0,
        user_name: voiceCase?.user_name || 'Rahul',
      })

      const withAgentReply = [
        ...newHistory,
        { role: 'agent', text: res.agent_reply, time: new Date().toLocaleTimeString() }
      ]
      setVoiceTranscript(withAgentReply)
      speak(res.agent_reply)

      if (res.should_retry_payment) {
        toast.success('User accepted payment retry! Payment link generated.')
        loadCases()
        loadOverview()
      }
    } catch (err) {
      toast.error('Voice service error')
    } finally {
      setVoiceProcessing(false)
    }
  }

  const handleCompleteVoicePayment = async () => {
    if (!voiceCase) return
    try {
      setActionLoading(true)
      await payRecoveredCase({
        case_id: voiceCase.case_id,
        razorpay_payment_id: `pay_voice_rec_${Date.now()}`,
      })
      toast.success(`₹${voiceCase.amount} recovered successfully!`)
      setVoiceModalOpen(false)
      loadCases()
      loadOverview()
    } catch {
      toast.error('Payment recovery failed')
    } finally {
      setActionLoading(false)
    }
  }

  const kpis = overview?.kpis || {}

  return (
    <div className="space-y-6 font-sans">

      {/* ── Top Header Toolbar ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl text-white shadow-xl border border-slate-700">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Autonomous Revenue AI
            </span>
            <span className="text-xs font-semibold text-slate-400">· Multi-Agent & Voice</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            AI Revenue Recovery Agent
          </h1>
          <p className="text-sm font-medium text-slate-300 mt-1 max-w-xl">
            Predictive churn scoring, multi-channel adaptive recovery (Email · In-App · Hinglish Voice), bounded win-backs, and human escalation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRefreshAll}
            disabled={actionLoading || loadingOverview || loadingCases}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white border border-white/15 transition-all flex items-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={14} className={actionLoading || loadingOverview || loadingCases ? 'animate-spin' : ''} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* ── 6 Modern KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">At-Risk Revenue</p>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{formatCurrency(kpis.at_risk_revenue || 0)}</p>
          <span className="text-[10px] text-amber-600 font-bold mt-1 inline-flex items-center gap-0.5">⚠️ Pre-failure risk</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Failed Revenue</p>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{formatCurrency(kpis.failed_revenue || 0)}</p>
          <span className="text-[10px] text-rose-600 font-bold mt-1 inline-flex items-center gap-0.5">Payment declined</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recovered Revenue</p>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">{formatCurrency(kpis.recovered_revenue || 0)}</p>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-flex items-center gap-0.5">✓ Secured by AI</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recovery Rate</p>
          <p className="text-xl sm:text-2xl font-black text-indigo-600 mt-1">{kpis.recovery_rate || 0}%</p>
          <span className="text-[10px] text-indigo-600 font-bold mt-1 inline-flex items-center gap-0.5">Conversion</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Recoveries</p>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{kpis.active_recoveries || 0}</p>
          <span className="text-[10px] text-blue-600 font-bold mt-1 inline-flex items-center gap-0.5">In workflow</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-pink-500" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Human Escalations</p>
          <p className="text-xl sm:text-2xl font-black text-pink-600 mt-1">{kpis.human_escalations || 0}</p>
          <span className="text-[10px] text-pink-600 font-bold mt-1 inline-flex items-center gap-0.5">HITL Queue</span>
        </motion.div>
      </div>

      {/* ── Visual Analytics Section (4 Charts) ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Recovered Revenue Over Time */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recovered vs At-Risk Revenue Over Time</h2>
              <p className="text-xs text-slate-400">Daily monetary trajectory (7-day trend)</p>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              Live Trajectory
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.time_series || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="recoveredGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="atRiskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip formatter={(val) => [`₹${val}`, '']} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Area type="monotone" dataKey="recovered" name="Recovered (₹)" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#recoveredGrad)" />
                <Area type="monotone" dataKey="at_risk" name="At-Risk (₹)" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#atRiskGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Recovery Funnel */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recovery Conversion Funnel</h2>
              <p className="text-xs text-slate-400">Failed → Contacted → Retried → Recovered</p>
            </div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
              End-to-End Funnel
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { stage: 'Failed Payments', count: overview?.funnel?.failed_payments || 0, fill: '#EF4444' },
                  { stage: 'Contacted Users', count: overview?.funnel?.contacted || 0, fill: '#3B82F6' },
                  { stage: 'Retried Attempts', count: overview?.funnel?.retried || 0, fill: '#8B5CF6' },
                  { stage: 'Recovered Revenue', count: overview?.funnel?.recovered || 0, fill: '#10B981' },
                ]}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="stage" tick={{ fontSize: 10.5, fill: '#475569', fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={42}>
                  {
                    [0, 1, 2, 3].map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#EF4444', '#3B82F6', '#8B5CF6', '#10B981'][index]} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Recovery by Channel */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recovery by Channel (Email · In-App · Voice)</h2>
              <p className="text-xs text-slate-400">Monetary recovery breakdown per communication medium</p>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              Channel ROI
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview?.channel_performance || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="channel" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip formatter={(val) => [`₹${val}`, '']} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="recovered_amount" name="Recovered Amount (₹)" fill="#10B981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="total_amount" name="Total Targeted (₹)" fill="#CBD5E1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Risk Distribution */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Predictive Risk Level Distribution</h2>
              <p className="text-xs text-slate-400">Low (&lt;40) · Medium (40-69) · High (70-100)</p>
            </div>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
              Risk Profile
            </span>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Low Risk', value: overview?.risk_distribution?.LOW || 1, color: '#10B981' },
                    { name: 'Medium Risk', value: overview?.risk_distribution?.MEDIUM || 2, color: '#F59E0B' },
                    { name: 'High Risk', value: overview?.risk_distribution?.HIGH || 1, color: '#EF4444' },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  <Cell fill="#10B981" />
                  <Cell fill="#F59E0B" />
                  <Cell fill="#EF4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Recovery Cases Queue Table ─────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        
        {/* Table Filters Bar */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Live Recovery Cases Queue</h2>
            <p className="text-xs font-medium text-slate-400">Search and manage active recovery operations</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search user, email, reason..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                className="pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 w-52 font-medium"
              />
            </div>

            {/* Risk Filter */}
            <select
              value={filters.risk_level}
              onChange={(e) => setFilters(prev => ({ ...prev, risk_level: e.target.value, page: 1 }))}
              className="text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700 focus:outline-none"
            >
              <option value="">All Risk Levels</option>
              <option value="LOW">Low Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="HIGH">High Risk</option>
            </select>

            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
              className="text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="AT_RISK">At Risk</option>
              <option value="PAYMENT_FAILED">Payment Failed</option>
              <option value="RECOVERY_ACTIVE">Recovery Active</option>
              <option value="CONTACTED">Contacted</option>
              <option value="RETRY_SCHEDULED">Retry Scheduled</option>
              <option value="RECOVERED">Recovered</option>
              <option value="ESCALATED">Escalated</option>
              <option value="STOPPED">Stopped</option>
            </select>

            {/* Channel Filter */}
            <select
              value={filters.channel}
              onChange={(e) => setFilters(prev => ({ ...prev, channel: e.target.value, page: 1 }))}
              className="text-xs rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700 focus:outline-none"
            >
              <option value="">All Channels</option>
              <option value="EMAIL">Email</option>
              <option value="IN_APP">In-App</option>
              <option value="VOICE">Voice (AI)</option>
            </select>

            {/* HITL Toggle */}
            <button
              onClick={() => setFilters(prev => ({ ...prev, human_review: !prev.human_review, page: 1 }))}
              className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
                filters.human_review
                  ? 'bg-pink-50 text-pink-700 border-pink-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <ShieldAlert size={14} /> Escalations Only
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="py-3 px-5">Case / User</th>
                <th className="py-3 px-4">Plan & Amount</th>
                <th className="py-3 px-4">Predictive Risk</th>
                <th className="py-3 px-4">Failure Reason</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Attempts</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs font-medium text-slate-700 divide-y divide-slate-100">
              {loadingCases ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2 font-bold">
                      <RefreshCw size={16} className="animate-spin text-slate-400" /> Loading recovery cases...
                    </div>
                  </td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="font-bold text-slate-700">No recovery cases found.</p>
                    <p className="text-xs text-slate-400 mt-1">Failed payments will be automatically captured here from real Razorpay webhooks.</p>
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c.case_id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-3.5 px-5">
                      <div className="font-black text-slate-900 tracking-tight">{c.case_id}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{c.user_name} ({c.user_email})</div>
                      {c.human_review_required && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-pink-600 bg-pink-50 px-1.5 py-0.2 rounded border border-pink-200 mt-0.5">
                          ⚠️ Human Review Required
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-slate-900 uppercase">{c.plan}</span>
                      <div className="text-[11px] font-black text-slate-700">{formatCurrency(c.amount)}</div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <RiskBadge score={c.risk_score} level={c.risk_level} />
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="text-slate-700 font-semibold line-clamp-1 max-w-[200px]" title={c.failure_reason}>
                        {c.failure_reason || 'Approaching Renewal'}
                      </p>
                      <p className="text-[10px] text-slate-400">{c.failed_at ? formatDate(c.failed_at) : 'Active'}</p>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                        <ChannelIcon channel={c.selected_channel} />
                        {c.selected_channel || 'NONE'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusPill status={c.status} />
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="font-bold text-slate-800">{c.attempt_count}</span>
                      <span className="text-slate-400">/{c.max_attempts || 3}</span>
                    </td>

                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.selected_channel === 'VOICE' && c.status !== 'RECOVERED' && (
                          <button
                            onClick={() => openVoiceSimulator(c)}
                            title="Open Voice Call Simulator"
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                          >
                            <PhoneCall size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => openCaseDetail(c.case_id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition shadow-sm"
                        >
                          Diagnosis →
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.total_pages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Showing page {pagination.page} of {pagination.total_pages} ({pagination.total} total cases)</span>
            <div className="flex items-center gap-2">
              <button
                disabled={!pagination.has_prev}
                onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 font-bold"
              >
                Previous
              </button>
              <button
                disabled={!pagination.has_next}
                onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 font-bold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: CASE DETAIL & EXPLAINABILITY MODAL                             */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {detailModalOpen && selectedCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                      {selectedCase.case_id}
                    </span>
                    <StatusPill status={selectedCase.status} />
                    {selectedCase.human_review_required && (
                      <span className="text-xs font-black text-pink-600 bg-pink-50 px-2 py-0.5 rounded-md border border-pink-200">
                        HITL Review Required
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mt-2">
                    {selectedCase.user_name} ({selectedCase.user_email})
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Plan: <strong className="text-slate-800 uppercase">{selectedCase.plan}</strong> · Amount: <strong className="text-slate-800">{formatCurrency(selectedCase.amount)}</strong> · Attempts: {selectedCase.attempt_count}/{selectedCase.max_attempts || 3}
                  </p>
                </div>
                <button
                  onClick={() => setDetailModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">

                {/* 1. AI Diagnosis & Predictive Risk Score */}
                <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Activity className="text-indigo-400" size={16} />
                      <span className="font-black text-sm uppercase tracking-wider text-indigo-300">AI Diagnosis & Risk Scoring</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">Score:</span>
                      <span className="text-xl font-black text-amber-400">{selectedCase.risk_score}/100</span>
                      <span className="text-xs font-black uppercase text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                        {selectedCase.risk_level}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-300 text-xs font-medium leading-relaxed mb-3">
                    {selectedCase.explanation || 'Evaluated based on renewal proximity, engagement frequency, and payment failure history.'}
                  </p>
                  {selectedCase.risk_factors && selectedCase.risk_factors.length > 0 && (
                    <div className="pt-2 border-t border-slate-800">
                      <p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Identified Risk Factors:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedCase.risk_factors.map((rf, idx) => (
                          <span key={idx} className="bg-slate-800 text-slate-300 px-2 py-1 rounded-md text-[11px] font-medium border border-slate-700">
                            • {rf}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Explainability: Strategy & Channel Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Selected Strategy</p>
                    <p className="text-sm font-bold text-slate-900 mb-1">{selectedCase.selected_strategy}</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      {selectedCase.agent_reasoning || 'Automated strategy optimized for recovery safety.'}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Selected Channel</p>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 mb-1">
                      <ChannelIcon channel={selectedCase.selected_channel} />
                      {selectedCase.selected_channel}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Adaptive routing based on user opening behavior and contact urgency.
                    </p>
                  </div>
                </div>

                {/* 3. Bounded Win-Back Offer (if present) */}
                {selectedCase.offer && selectedCase.offer.offered && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-amber-900 text-xs uppercase tracking-wider">
                        🎁 Bounded Win-Back Incentive ({selectedCase.offer.discount_pct}% Discount)
                      </span>
                      <span className="font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        {selectedCase.offer.promo_code}
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 mt-1 font-medium">
                      Discounted Amount: <strong>{formatCurrency(selectedCase.offer.discounted_amount)}</strong> (Original: {formatCurrency(selectedCase.offer.original_amount)}). Hard-capped at max 20% by policy engine.
                    </p>
                  </div>
                )}

                {/* 4. Complete Audit Trail */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-2.5 flex items-center gap-1.5">
                    <Shield size={14} className="text-indigo-600" /> Complete Audit Trail & Decision Log
                  </h4>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-slate-50/50">
                    {(selectedCase.audit_trail || []).map((log, idx) => (
                      <div key={idx} className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900 text-[11px]">{log.action}</span>
                          <span className="text-[10px] text-slate-400">{formatDate(log.timestamp)} {formatTime(log.timestamp)}</span>
                        </div>
                        <p className="text-slate-600 text-xs">{log.reasoning}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">Actor: {log.actor_name || log.actor}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Voice Call Transcripts (if attempted) */}
                {selectedCase.voice_data && selectedCase.voice_data.voice_attempted && (
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-2.5 flex items-center gap-1.5">
                      <Phone size={14} className="text-emerald-600" /> Voice Call Transcript (Hinglish AI)
                    </h4>
                    <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2 max-h-48 overflow-y-auto">
                      {(selectedCase.voice_data.transcript || []).map((t, idx) => (
                        <div key={idx} className={`p-2 rounded-xl text-xs ${t.role === 'agent' ? 'bg-slate-800 text-slate-200 mr-8' : 'bg-emerald-950 text-emerald-200 ml-8 border border-emerald-800/40'}`}>
                          <p className="text-[9px] font-bold uppercase text-slate-400 mb-0.5">{t.role === 'agent' ? 'Priya (CareerShala AI)' : selectedCase.user_name}</p>
                          <p>{t.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {selectedCase.human_review_required && (
                    <>
                      <button
                        onClick={() => handleApprove(selectedCase.case_id)}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-1.5"
                      >
                        <Check size={14} /> Approve Escalation
                      </button>
                      <button
                        onClick={() => handleReject(selectedCase.case_id)}
                        disabled={actionLoading}
                        className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs hover:bg-rose-100 transition"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => handleRetry(selectedCase.case_id)}
                    disabled={actionLoading}
                    className="px-3.5 py-2 rounded-xl bg-white text-slate-700 border border-slate-200 font-bold text-xs hover:bg-slate-100 transition flex items-center gap-1.5"
                  >
                    <RefreshCw size={13} /> Re-Run Pipeline
                  </button>

                  <button
                    onClick={() => handleTriggerChannel(selectedCase.case_id, 'EMAIL')}
                    disabled={actionLoading}
                    className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-bold text-xs hover:bg-blue-100 transition flex items-center gap-1.5"
                  >
                    <Mail size={13} /> Send Recovery Email
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {selectedCase.status !== 'RECOVERED' && (
                    <button
                      onClick={() => openVoiceSimulator(selectedCase)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
                    >
                      <PhoneCall size={14} /> Launch Voice Call
                    </button>
                  )}
                  <button
                    onClick={() => handleClose(selectedCase.case_id)}
                    disabled={actionLoading}
                    className="px-3 py-2 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold text-xs transition"
                  >
                    Close Case
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: LIVE HINGLISH VOICE CALL SIMULATOR                             */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {voiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-white"
            >
              {/* Call Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                    <Phone size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-white">
                      CareerShala Voice Recovery Agent
                    </h3>
                    <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Hinglish Voice Call · {voiceCase?.user_name || 'User'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    stopTTS()
                    stopListening()
                    setVoiceModalOpen(false)
                  }}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Call Audio Waveform Simulation */}
              <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-center gap-1.5 py-6">
                {[4, 12, 24, 16, 8, 28, 18, 10, 22, 14, 6].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={speaking || listening ? { height: [h, h * 1.8, h] } : { height: 6 }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.08 }}
                    className={`w-1.5 rounded-full ${speaking ? 'bg-indigo-400' : listening ? 'bg-emerald-400' : 'bg-slate-700'}`}
                  />
                ))}
              </div>

              {/* Conversation Transcript */}
              <div className="p-4 space-y-3 max-h-72 overflow-y-auto text-xs font-medium bg-slate-950">
                {voiceTranscript.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl max-w-[85%] ${
                      msg.role === 'agent'
                        ? 'bg-slate-900 text-slate-200 mr-auto border border-slate-800'
                        : 'bg-emerald-950 text-emerald-200 ml-auto border border-emerald-700/50'
                    }`}
                  >
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">
                      {msg.role === 'agent' ? 'Priya (CareerShala AI)' : voiceCase?.user_name || 'You'} · {msg.time}
                    </p>
                    <p className="leading-relaxed">{msg.text}</p>
                  </div>
                ))}
                {voiceProcessing && (
                  <div className="p-3 rounded-2xl bg-slate-900 text-slate-400 mr-auto border border-slate-800 text-xs flex items-center gap-2">
                    <RefreshCw size={12} className="animate-spin" /> Priya is responding in Hinglish...
                  </div>
                )}
              </div>

              {/* Quick Prompt Suggestions */}
              <div className="p-2.5 bg-slate-900/60 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px]">
                <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">Suggestions:</span>
                <button
                  onClick={() => handleSendVoiceUtterance('Haan, main payment retry karna chahta hoon.')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/40 shrink-0"
                >
                  "Haan, retry kar do"
                </button>
                <button
                  onClick={() => handleSendVoiceUtterance('Kuch discount mil sakta hai kya? Mehenga hai.')}
                  className="px-2.5 py-1 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/40 shrink-0"
                >
                  "Discount milega?"
                </button>
                <button
                  onClick={() => handleSendVoiceUtterance('Abhi busy hoon, baad me call karo.')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 shrink-0"
                >
                  "Baad me call karo"
                </button>
              </div>

              {/* Input & Microphone Controls */}
              <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center gap-2">
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-lg shrink-0 ${
                    listening
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                  title={listening ? 'Listening... click to stop' : 'Click to speak in Hinglish'}
                >
                  {listening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <input
                  type="text"
                  placeholder={listening ? 'Listening to speech...' : 'Type Hinglish response (e.g. Haan, retry link bhej do)...'}
                  value={voiceInputText}
                  onChange={(e) => setVoiceInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendVoiceUtterance()
                  }}
                  className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />

                <button
                  onClick={() => handleSendVoiceUtterance()}
                  disabled={!voiceInputText.trim() || voiceProcessing}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs transition"
                >
                  Send
                </button>

                <button
                  onClick={handleCompleteVoicePayment}
                  className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1 shadow-md shrink-0"
                  title="Simulate successful payment verification"
                >
                  <CheckCircle2 size={14} /> Pay & Recover
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
