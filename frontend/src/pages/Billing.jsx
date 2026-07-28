import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  CreditCard,
  Shield,
  Zap,
  Calendar,
  Download,
  Mail,
  Receipt,
  CheckCircle2,
  Wallet
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SupportButton from '../components/support/SupportButton'

// --- Utility Functions ---
function formatDate(d) {
  if (!d) return '—'
  try {
    const date = new Date(d)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
  } catch {
    return '—'
  }
}

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

export default function Billing() {
  const { user, refreshUser } = useAuth()
  
  // Using a mount effect to silently refresh user data
  useEffect(() => {
    refreshUser?.().catch(() => null)
  }, [refreshUser])

  // Core State Logic
  const planId = (user?.plan || 'free').toLowerCase()
  const isFree = planId === 'free'
  const subscriptionActive = user?.subscription_active ?? false
  const startedOn = user?.plan_updated_at || user?.created_at
  
  // Dynamic Renewal Calculation
  const nextRenewal = useMemo(() => {
    if (isFree) return 'Lifetime (No Expiry)'
    if (user?.subscription_end_date) return formatDate(user.subscription_end_date)
    if (!startedOn) return '—'
    try {
      const d = new Date(startedOn)
      if (Number.isNaN(d.getTime())) return '—'
      d.setMonth(d.getMonth() + 1)
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })
    } catch {
      return '—'
    }
  }, [startedOn, isFree, user?.subscription_end_date])

  // Plan Configurations
  const planConfigs = {
    free: {
      name: 'Free Tier',
      price: '₹0',
      period: 'forever',
      badge: 'bg-slate-100 text-slate-600 border-slate-200',
      accent: 'bg-slate-300'
    },
    pro: {
      name: 'Pro Plan',
      price: '₹299',
      period: '/ month',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      accent: 'bg-indigo-600'
    },
    premium: {
      name: 'Premium Plan',
      price: '₹499',
      period: '/ month',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      accent: 'bg-gradient-to-r from-amber-400 to-orange-500'
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
  const paymentHistory = user?.payment_history || [] 

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
              {!isFree && (
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-white text-rose-600 border border-slate-200 hover:bg-rose-50 hover:border-rose-200 transition-colors">
                  Cancel Subscription
                </button>
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
                    <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">Date</th>
                    <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">Plan</th>
                    <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount</th>
                    <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="py-3 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium text-slate-700">
                  {paymentHistory.map((p, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 whitespace-nowrap text-slate-900 font-bold">{formatDate(p.date)}</td>
                      <td className="py-4 px-6">{p.plan}</td>
                      <td className="py-4 px-6">₹{p.amount}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          <CheckCircle2 size={12} /> {p.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                          <Download size={12} /> PDF
                        </button>
                      </td>
                    </tr>
                  ))}
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

    </div>
  )
}