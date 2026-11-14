import { createPortal } from 'react-dom'
import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  CreditCard,
  Shield,
  Zap,
  Calendar,
  Download,
  Mail,
  Receipt,
  CheckCircle2,
  Wallet,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  X,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SupportButton from '../components/support/SupportButton'
import { getMyRecoveryBanner } from '../services/revenueRecoveryApi'
import { cancelSubscription } from '../services/api'
import CustomDropdown from '../components/common/CustomDropdown'
import { formatDate } from '../utils/formatters'

// --- Components ---
function Card({ className = '', children, noPadding = false, accentTop = '' }) {
  return (
    <div className={`relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {accentTop && <div className={`absolute top-0 left-0 right-0 h-1 ${accentTop}`} />}
      {noPadding ? children : <div className="p-6">{children}</div>}
    </div>
  )
}

function SectionTitle({ title, subtitle, icon: Icon }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
          <Icon size={18} className="text-slate-700" />
        </div>
      )}
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5 font-medium">{subtitle}</p>}
      </div>
    </div>
  )
}

function StatBox({ label, value, subtext }) {
  return (
    <div className="flex flex-col p-4 rounded-xl border border-slate-100 bg-slate-50 transition-colors hover:bg-slate-100/50">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <span className="text-2xl font-black text-slate-900 leading-none mb-1">{value}</span>
      {subtext && <span className="text-[10px] font-medium text-slate-400">{subtext}</span>}
    </div>
  )
}

function EmptyState({ title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-sm">
        <Receipt className="text-slate-400" size={18} />
      </div>
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{desc}</p>
    </div>
  )
}

function InvoiceReceiptModal({ invoice, user, onClose }) {
  if (!invoice) return null

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const invYear = new Date(invoice.date || Date.now()).getFullYear() || 2026
  const refCode = (invoice.payment_id || invoice.order_id || 'CS001').replace(/^pay_|^order_/, '').slice(-6).toUpperCase()
  const invId = `INV-${invYear}-${refCode}`
  const total = parseFloat(invoice.amount || 0)
  const subtotal = total > 0 ? (total / 1.18).toFixed(2) : '0.00'
  const gst = total > 0 ? (total - parseFloat(subtotal)).toFixed(2) : '0.00'
  const cgst = (parseFloat(gst) / 2).toFixed(2)
  const sgst = (parseFloat(gst) / 2).toFixed(2)

  const handlePrint = () => {
    window.print()
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] my-auto"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="text-blue-600" size={18} />
            <span className="text-sm font-bold text-slate-800">Tax Invoice & Payment Receipt</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shadow-sm"
            >
              <Download size={13} /> Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-800 font-sans">
          <div className="flex justify-between items-start pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm">
                  CS
                </div>
                <span className="text-xl font-black text-slate-900 tracking-tight">CareerShala</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-medium">AI Career Acceleration Platform</p>
              <p className="text-[11px] text-slate-400 mt-0.5">careershala.tech • billing@careershala.tech</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold tracking-wider uppercase mb-2">
                ✓ PAID
              </span>
              <p className="text-sm font-extrabold text-slate-900">{invId}</p>
              <p className="text-xs text-slate-500">Date: {formatDate(invoice.date)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Billed To</span>
              <p className="font-bold text-slate-900 text-sm">{user?.full_name || user?.username || 'Valued Candidate'}</p>
              <p className="text-slate-500 mt-0.5">{user?.email}</p>
              <p className="text-slate-400 mt-0.5">Country: India (Domestic)</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Payment Method</span>
              <p className="font-bold text-slate-900 text-sm">Razorpay Secure Checkout</p>
              <p className="text-slate-500 mt-0.5 font-mono text-[11px] truncate">Ref: {invoice.payment_id || invoice.order_id || 'pay_online'}</p>
              <p className="text-emerald-600 font-medium mt-0.5">Status: Verified & Settled</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-bold text-slate-600">Description</th>
                  <th className="py-2.5 px-4 font-bold text-slate-600">SAC Code</th>
                  <th className="py-2.5 px-4 font-bold text-slate-600">Duration</th>
                  <th className="py-2.5 px-4 font-bold text-slate-600 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr>
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-900">{invoice.plan || 'CareerShala VIP'} Tier Subscription</p>
                    <p className="text-[11px] text-slate-500">Full platform access, unlimited ATS scans, AI live mock interviews & dev portfolio</p>
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono">998311</td>
                  <td className="py-3 px-4 text-slate-600">{invoice.duration || '3 Months (90 Days)'}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">₹{subtotal}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end text-xs">
            <div className="w-64 space-y-2 text-slate-600">
              <div className="flex justify-between">
                <span>Taxable Amount (Subtotal):</span>
                <span className="font-semibold text-slate-900">₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>CGST (9%):</span>
                <span>₹{cgst}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>SGST (9%):</span>
                <span>₹{sgst}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-extrabold text-slate-900">
                <span>Total Paid:</span>
                <span className="text-blue-600">₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-[10px] text-slate-400 text-center">
            This is a computer-generated tax invoice and payment acknowledgement. No physical signature required.
          </div>
        </div>
      </motion.div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}

export default function Billing() {
  const { user, refreshUser } = useAuth()
  const [recoveryBanner, setRecoveryBanner] = useState(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('Too expensive')
  const [cancelFeedback, setCancelFeedback] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState(null)

  // Using a mount effect to silently refresh user data & recovery status
  useEffect(() => {
    refreshUser?.().catch(() => null)
    getMyRecoveryBanner().then(data => {
      if (data?.has_active_recovery) setRecoveryBanner(data)
    }).catch(() => null)
  }, [refreshUser])

  const handleCancelSubscription = async () => {
    setCancelling(true)
    try {
      const res = await cancelSubscription({
        reason: cancelReason,
        feedback: cancelFeedback,
      })
      toast.success(res.data?.message || 'Subscription cancelled successfully.')
      setShowCancelModal(false)
      if (refreshUser) {
        await refreshUser()
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to cancel subscription.'
      toast.error(msg)
    } finally {
      setCancelling(false)
    }
  }

  // Core State Logic
  const planId = (user?.plan || 'free').toLowerCase()
  const isFree = planId === 'free'
  const subscriptionActive = user?.subscription_active ?? false
  const startedOn = user?.subscription_start_date || user?.plan_updated_at || user?.created_at
  
  // Dynamic Renewal Calculation (Quarterly / 3 Months System)
  const nextRenewal = useMemo(() => {
    if (isFree || !subscriptionActive) return 'Lifetime (No Expiry)'
    if (user?.subscription_end_date) return formatDate(user.subscription_end_date)
    if (!startedOn) return '—'
    try {
      const d = new Date(startedOn)
      if (Number.isNaN(d.getTime())) return '—'
      d.setDate(d.getDate() + 90) // Default 90 days quarterly extension
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
    } catch {
      return '—'
    }
  }, [startedOn, isFree, subscriptionActive, user?.subscription_end_date])

  // Plan Configurations for Candidate & Recruiter Tiers (3 Months)
  const planConfigs = {
    free: {
      name: 'Free Tier',
      price: '₹0',
      period: 'forever',
      badge: 'bg-slate-100 text-slate-600 border-slate-200',
      accent: 'bg-slate-300'
    },
    pro: {
      name: 'Candidate Pro',
      price: '₹199',
      period: '/ 3 months',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      accent: 'bg-blue-600'
    },
    candidate_pro: {
      name: 'Candidate Pro',
      price: '₹199',
      period: '/ 3 months',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      accent: 'bg-blue-600'
    },
    premium: {
      name: 'Job Seeker VIP',
      price: '₹399',
      period: '/ 3 months',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      accent: 'bg-amber-500'
    },
    candidate_premium: {
      name: 'Job Seeker VIP',
      price: '₹399',
      period: '/ 3 months',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      accent: 'bg-amber-500'
    },
    recruiter_pro: {
      name: 'Recruiter Growth',
      price: '₹999',
      period: '/ 3 months',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      accent: 'bg-emerald-600'
    },
    growth: {
      name: 'Recruiter Growth',
      price: '₹999',
      period: '/ 3 months',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      accent: 'bg-emerald-600'
    },
    recruiter_enterprise: {
      name: 'Recruiter Enterprise',
      price: '₹2,499',
      period: '/ 3 months',
      badge: 'bg-slate-900 text-white border-slate-800',
      accent: 'bg-slate-900'
    },
    enterprise: {
      name: 'Recruiter Enterprise',
      price: '₹2,499',
      period: '/ 3 months',
      badge: 'bg-slate-900 text-white border-slate-800',
      accent: 'bg-slate-900'
    }
  }

  const currentConfig = planConfigs[planId] || planConfigs.free

  // Dynamic Financial Data (Pulling from user object if available, zeroing out for free)
  const currentCharges = isFree ? '0.00' : (user?.current_charges || currentConfig.price.replace('₹', ''))
  const totalPaid = isFree ? '0.00' : (user?.total_paid || currentCharges)
  const taxes = isFree ? '0.00' : (user?.taxes || (parseFloat(currentCharges) * 0.18).toFixed(2)) // Example 18% GST calculation
  
  // Usage Stats
  const atsChecks = user?.total_ats_checks ?? 0
  const resumeUploads = user?.total_resumes ?? 0
  const aiUsage = user?.ai_minutes_used ?? 0 
  const interviewSessions = user?.total_interviews ?? 0 
  const paymentHistory = useMemo(() => {
    const list = Array.isArray(user?.payment_history) ? user.payment_history : []
    if (list.length > 0) {
      return [...list].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    }
    if (user?.subscription_active && !isFree) {
      return [{
        order_id: `ord_${user?.id ? String(user.id).slice(0, 8) : 'cs'}`,
        payment_id: `pay_${user?.id ? String(user.id).slice(0, 10) : 'verified'}`,
        plan: currentConfig.name,
        amount: currentCharges,
        duration: currentConfig.period || '3 months',
        status: 'paid',
        date: startedOn || new Date().toISOString(),
      }]
    }
    return []
  }, [user?.payment_history, user?.subscription_active, isFree, currentConfig, currentCharges, startedOn, user?.id]) 

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 font-sans">
      
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Billing & Usage</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Manage your subscription, track usage, and view invoices.</p>
          </div>
          <div className="flex items-center gap-2">
             <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${currentConfig.badge}`}>
               <Shield size={14} /> {currentConfig.name}
             </span>
             <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${isFree || !subscriptionActive ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
               <Zap size={14} /> {isFree ? 'Standard' : subscriptionActive ? 'Active' : 'Inactive'}
             </span>
          </div>
        </div>
      </motion.div>

      {/* ── Active Recovery / Win-Back Notification Banner ────────────────── */}
      {recoveryBanner && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded border border-amber-300">
                  Action Required
                </span>
                {recoveryBanner.offer?.discount_pct > 0 && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                    <Sparkles size={11} /> Special {recoveryBanner.offer.discount_pct}% Win-Back Offer
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-900 mt-1">
                {recoveryBanner.offer?.discount_pct > 0
                  ? `Claim ${recoveryBanner.offer.discount_pct}% off your ${recoveryBanner.plan?.toUpperCase()} renewal with code ${recoveryBanner.offer.promo_code}`
                  : `Your ${recoveryBanner.plan?.toUpperCase()} plan renewal needs attention`}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {recoveryBanner.message || 'Update payment method to retain unlimited AI interviews & ATS resume checks.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => (window.location.href = `/premium?coupon=${recoveryBanner.offer?.promo_code || ''}`)}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition flex items-center gap-2 shrink-0 active:scale-95"
          >
            {recoveryBanner.offer?.discount_pct > 0 ? 'Claim Offer & Renew' : 'Retry Payment'} <ArrowRight size={14} />
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ── Left Col: Current Plan ──────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="lg:col-span-1">
          <Card accentTop={currentConfig.accent} className="h-full flex flex-col">
            <SectionTitle title="Current Plan" subtitle="Your active tier details" icon={CreditCard} />
            
            <div className="mt-6 flex-1">
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-black text-slate-900 tracking-tight">{currentConfig.price}</span>
                <span className="text-sm font-bold text-slate-400">{currentConfig.period}</span>
              </div>

              <div className="space-y-4 py-4 border-y border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Calendar size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider">Started</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{formatDate(startedOn)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Zap size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider">Renews</span>
                  </div>
                  <span className={`text-sm font-bold ${isFree ? 'text-slate-400' : 'text-slate-900'}`}>{nextRenewal}</span>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Payment Method</p>
                <div className="flex items-center gap-2">
                  <div className="bg-white p-1.5 rounded-lg border border-slate-200">
                    {isFree ? <Wallet size={16} className="text-slate-400" /> : <Receipt size={16} className="text-slate-600" />}
                  </div>
                  {isFree ? (
                    <div>
                      <p className="text-sm font-bold text-slate-900">None attached</p>
                      <p className="text-[10px] text-slate-400 font-medium">Not required for Free Tier</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-slate-900">Razorpay Secured</p>
                      <p className="text-[10px] text-slate-400 font-medium">Active billing profile</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button 
                onClick={() => (window.location.href = '/premium')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
              >
                {isFree ? 'Upgrade to Premium ✨' : 'Change Plan'}
              </button>
              {!isFree && subscriptionActive && (
                <button 
                  onClick={() => setShowCancelModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-white text-rose-600 border border-slate-200 hover:bg-rose-50 hover:border-rose-200 transition-colors shadow-sm"
                >
                  Cancel Subscription
                </button>
              )}
              {!isFree && !subscriptionActive && (
                <div className="text-center p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-xs font-bold text-amber-800">Subscription Inactive</p>
                  <p className="text-[11px] text-amber-600 font-medium">Your plan has been cancelled.</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* ── Right Col: Usage & Summary ──────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} className="lg:col-span-2 space-y-6">
          
          {/* Usage Stats */}
          <Card>
            <SectionTitle title="Resource Usage" subtitle="Track your consumption for the current period" />
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox label="ATS Checks" value={atsChecks} subtext="Total scanned" />
              <StatBox label="Resumes" value={resumeUploads} subtext="Saved profiles" />
              <StatBox label="AI Minutes" value={aiUsage} subtext="Generative usage" />
              <StatBox label="Interviews" value={interviewSessions} subtext="Mock sessions" />
            </div>
          </Card>

          {/* Billing Breakdown */}
          <Card>
             <SectionTitle title="Financial Summary" subtitle={isFree ? "You are not being charged on this tier." : "Overview of your current billing cycle"} />
             <div className={`mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 ${isFree ? 'opacity-60 grayscale' : ''}`}>
              <div className="p-4 rounded-xl border-l-2 border-l-slate-300 bg-slate-50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Paid</p>
                <p className="mt-1 text-xl font-black text-slate-900">₹{totalPaid}</p>
              </div>
              <div className="p-4 rounded-xl border-l-2 border-l-slate-300 bg-slate-50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Current Charges</p>
                <p className="mt-1 text-xl font-black text-slate-900">₹{currentCharges}</p>
              </div>
              <div className="p-4 rounded-xl border-l-2 border-l-slate-300 bg-slate-50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Est. Taxes</p>
                <p className="mt-1 text-xl font-black text-slate-900">₹{taxes}</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ── Payment History ─────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
        <Card noPadding>
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <SectionTitle title="Invoice History" subtitle="Download receipts for past transactions" />
          </div>

          {paymentHistory.length === 0 ? (
            <div className="p-6">
              <EmptyState 
                title={isFree ? "No invoices to display" : "No invoices found"} 
                desc={isFree ? "Invoices will appear here once you upgrade to a premium tier." : "Your payment history will appear here once you complete your first billing cycle."} 
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">Invoice ID</th>
                    <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</th>
                    <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">Plan</th>
                    <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount</th>
                    <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium text-slate-700">
                  {paymentHistory.map((p, idx) => {
                    const invYear = new Date(p.date || Date.now()).getFullYear() || 2026
                    const refCode = (p.payment_id || p.order_id || `00${idx+1}`).replace(/^pay_|^order_/, '').slice(-6).toUpperCase()
                    const invId = `INV-${invYear}-${refCode}`
                    return (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 whitespace-nowrap font-mono text-xs font-bold text-slate-900">{invId}</td>
                        <td className="py-4 px-6 whitespace-nowrap text-slate-700 font-medium">{formatDate(p.date)}</td>
                        <td className="py-4 px-6 font-semibold text-slate-900">{p.plan}</td>
                        <td className="py-4 px-6 font-bold text-slate-900">₹{p.amount}</td>
                        <td className="py-4 px-6">
                          {p.status === 'cancelled' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                              Cancelled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                              <CheckCircle2 size={12} /> Paid
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(p)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-blue-600 bg-white hover:bg-blue-50/60 hover:border-blue-200 transition-colors shadow-xs"
                          >
                            <Download size={12} /> View & PDF
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ── Support ─────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
        <div className="bg-slate-900 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
          <div className="flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <Mail className="text-white" size={20} />
            </div>
            <div>
              <p className="text-base font-bold text-white">Need help with your account?</p>
              <p className="text-sm text-slate-400 mt-0.5">Reach out to our support team for upgrade assistance, invoices, or general questions.</p>
            </div>
          </div>
          <SupportButton variant="billing" label="Get Support" />
        </div>
      </motion.div>

      {/* ── Cancel Subscription Modal ── */}
      <AnimatePresence>
        {showCancelModal && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !cancelling && setShowCancelModal(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-6 z-10 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Cancel Subscription?</h3>
                    <p className="text-xs text-slate-500 font-medium">Revert to Free Tier</p>
                  </div>
                </div>
                <button
                  disabled={cancelling}
                  onClick={() => setShowCancelModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3.5 text-xs text-rose-800 leading-relaxed">
                <p className="font-bold mb-0.5">Are you sure you want to cancel {currentConfig.name}?</p>
                <p className="text-rose-700/90 text-[11px]">
                  Your subscription will be deactivated immediately and your account will revert to the standard Free Tier.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reason for cancelling
                </label>
                <CustomDropdown
                  value={cancelReason}
                  onChange={(val) => setCancelReason(val)}
                  options={[
                    { value: 'Too expensive', label: 'Too expensive' },
                    { value: 'Temporary need fulfilled', label: 'Found a job / Interview cleared' },
                    { value: 'Missing features', label: 'Missing features I need' },
                    { value: 'Switching to another platform', label: 'Switching to another service' },
                    { value: 'Technical issues', label: 'Technical difficulties' },
                    { value: 'Other', label: 'Other reason' }
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Additional feedback (optional)
                </label>
                <textarea
                  rows={2}
                  value={cancelFeedback}
                  onChange={(e) => setCancelFeedback(e.target.value)}
                  placeholder="How could we make CareerShala better?"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white resize-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Keep Subscription
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleCancelSubscription}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {cancelling ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    'Confirm Cancel'
                  )}
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* ── Tax Invoice Receipt Modal ── */}
      <AnimatePresence>
        {selectedInvoice && (
          <InvoiceReceiptModal
            invoice={selectedInvoice}
            user={user}
            onClose={() => setSelectedInvoice(null)}
          />
        )}
      </AnimatePresence>

    </div>
  )
}