import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { createCheckout, verifyPayment, reportPaymentFailure } from '../services/api'

// Elegant Minimalist Crown SVG
function CrownIcon({ className, size = 20 }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
      <path d="M3 20h18" />
    </svg>
  )
}

function ActionButton({ children, onClick, disabled, variant = 'gold', loading = false }) {
  const variantStyles = useMemo(() => {
    switch (variant) {
      case 'slate':
        return 'bg-slate-900 text-white hover:bg-slate-800 border border-slate-800 shadow-lg shadow-slate-900/20'
      case 'outline':
        return 'bg-transparent text-slate-400 border border-slate-200 cursor-not-allowed opacity-75'
      case 'gold':
      default:
        return 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-slate-950 hover:brightness-105 shadow-xl shadow-amber-600/20 font-black'
    }
  }, [variant])

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-bold tracking-wide transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles}`}
    >
      {loading ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <>
          {children}
          {variant !== 'outline' && <span className="text-sm">→</span>}
        </>
      )}
    </button>
  )
}

function PricingCard({
  plan,
  price,
  period = 'month',
  description,
  features,
  ctaLabel,
  onCta,
  isPopular = false,
  isCurrent = false,
  loading = false,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
      className={`relative flex flex-col justify-between rounded-3xl p-6 transition-all duration-300 border ${
        isPopular 
          ? 'bg-slate-950 text-white border-amber-500/40 shadow-2xl shadow-slate-950/40 lg:scale-[1.03] z-10' 
          : 'bg-white/80 backdrop-blur-md text-slate-900 border-slate-200/80 shadow-md hover:shadow-xl'
      }`}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 px-4 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
          Best Value
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className={`text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${
            isPopular ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-100 text-slate-600'
          }`}>
            {plan}
          </span>
          {isPopular && <CrownIcon className="text-amber-400" size={18} />}
        </div>

        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-3xl font-black tracking-tight">{price}</span>
          <span className={`text-xs ${isPopular ? 'text-slate-400' : 'text-slate-500'}`}>/{period}</span>
        </div>

        <p className={`text-xs mb-6 font-medium ${isPopular ? 'text-slate-400' : 'text-slate-500'}`}>
          {description}
        </p>

        <hr className={`my-5 border-t ${isPopular ? 'border-slate-800' : 'border-slate-100'}`} />

        <ul className="space-y-3.5 mb-8">
          {features.map((feat, idx) => (
            <li key={idx} className="flex items-start gap-3 text-xs font-medium">
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                isPopular ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              }`}>
                ✓
              </span>
              <span className={isPopular ? 'text-slate-300' : 'text-slate-600'}>{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      <ActionButton
        disabled={isCurrent}
        loading={loading}
        onClick={onCta}
        variant={isCurrent ? 'outline' : isPopular ? 'gold' : 'slate'}
      >
        {isCurrent ? 'Current Plan' : ctaLabel}
      </ActionButton>
    </motion.div>
  )
}

export default function Premium() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const [processingPlan, setProcessingPlan] = useState(null)

  const userRole = String(user?.role || '').toLowerCase().trim()
  const userRoles = Array.isArray(user?.roles)
    ? user.roles.map(r => String(r || '').toLowerCase().trim())
    : [userRole || 'candidate']

  const isCompanyRole = [
    'executive',
    'exec',
    'recruiter',
    'employer',
    'hiring_manager',
    'interviewer',
    'company_admin',
  ].some(r => userRoles.includes(r) || userRole === r)

  const isExecutiveRole = userRole === 'executive' || userRole === 'exec' || userRoles.includes('executive') || userRoles.includes('exec')
  const isRecruiterRole = isCompanyRole
  const isAdminRole = ['admin', 'platform_admin', 'superadmin'].includes(userRole) || userRoles.includes('admin') || userRoles.includes('platform_admin')
  const isCandidateRole = !isCompanyRole && !isAdminRole

  // Only admins can toggle between candidate and recruiter pricing tiers; candidates & company roles NEVER see the switcher!
  const canSwitchCategory = isAdminRole

  const [activeCategory, setActiveCategory] = useState(isCompanyRole ? 'recruiter' : 'candidate')

  // Keep strictly synchronized when auth user loads
  useEffect(() => {
    if (isCandidateRole) {
      setActiveCategory('candidate')
    } else if (isCompanyRole) {
      setActiveCategory('recruiter')
    }
  }, [userRole, isCandidateRole, isCompanyRole])

  const currentPlan = (user?.plan || 'free').toLowerCase()
  const isSubscriptionActive = !!user?.subscription_active

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.Razorpay) {
        return resolve(true)
      }
      const scriptId = 'razorpay-checkout-sdk'
      let script = document.getElementById(scriptId)
      if (!script) {
        script = document.createElement('script')
        script.id = scriptId
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.async = true
        document.body.appendChild(script)
      }
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      // Safety timeout after 4 seconds
      setTimeout(() => resolve(Boolean(window.Razorpay)), 4000)
    })
  }

  // Dynamically load the external Razorpay Checkout SDK script tag
  useEffect(() => {
    loadRazorpayScript()
  }, [])

  const handlePaymentFlow = async (planKey, displayName) => {
    setProcessingPlan(planKey)
    try {
      // Step 1: Ensure Razorpay SDK script is ready
      const sdkReady = await loadRazorpayScript()
      if (!sdkReady || !window.Razorpay) {
        throw new Error('Payment gateway SDK failed to load. Please verify your internet connection or disable ad-blockers.')
      }

      // Step 2: Request order instantiation from backend gateway routes
      const checkoutRes = await createCheckout(planKey.toLowerCase())
      const orderData = checkoutRes.data

      // Step 2: Configure the native modal checkout options overlay
      const options = {
        key: orderData.razorpay_key_id,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'CareerShala Platform',
        description: `Upgrade to ${displayName || planKey} (3 Months Access)`,
        order_id: orderData.id,
        prefill: {
          name: user?.full_name || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        modal: {
          ondismiss: function () {
            setProcessingPlan(null)
          }
        },
        handler: async function (response) {
          // Step 3: Send verification signatures to server
          setProcessingPlan(planKey)
          try {
            await verifyPayment({
              plan: planKey.toLowerCase(),
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })

            toast.success(`Account successfully upgraded to ${displayName || planKey}! 🎉 (3 Months Active)`)
            if (refreshUser) await refreshUser()
            navigate('/billing')
          } catch (verifyErr) {
            const msg = verifyErr.response?.data?.detail || verifyErr.message || 'Verification failed. Please contact support.'
            toast.error(msg)
          } finally {
            setProcessingPlan(null)
          }
        },
        theme: {
          color: '#0f172a'
        }
      }

      const rzpInstance = new window.Razorpay(options)

      // Automatically report payment failure to AI recovery system & trigger Brevo recovery email
      rzpInstance.on('payment.failed', async function (response) {
        console.warn('[Razorpay] Payment failed:', response.error)
        const errorDesc = response.error?.description || response.error?.reason || 'Payment failed during checkout.'
        toast.error(errorDesc)
        setProcessingPlan(null)

        try {
          await reportPaymentFailure({
            plan: planKey.toLowerCase(),
            order_id: response.error?.metadata?.order_id || orderData.id,
            failure_reason: errorDesc,
            failure_code: response.error?.code || 'payment_failed',
          })
        } catch (reportErr) {
          console.error('[Razorpay] Failed to report payment failure to server:', reportErr)
        }
      })

      rzpInstance.open()

    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Could not complete payment execution.'
      toast.error(msg)
      setProcessingPlan(null)
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 sm:py-12 antialiased">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest text-[#2E9BDA] uppercase mb-2 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-100">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E9BDA] animate-pulse" />
            Quarterly Super Saver (3 Months)
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            {isCompanyRole ? 'Recruiter & Company Hiring Suite' : 'Affordable Plans for Candidates'}
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl font-medium">
            {isCompanyRole 
              ? 'Complete quarterly hiring suite for your company. Empower all recruiters & interviewers with automated resume screening and AI proctoring.' 
              : 'Get complete 3-month unrestricted access at deeply discounted student-friendly rates.'}
          </p>
        </div>
        
        <button
          onClick={() => navigate(isExecutiveRole ? '/exec/dashboard' : isCompanyRole ? '/recruiter/dashboard' : '/dashboard')}
          className="self-start md:self-center px-5 py-2.5 rounded-xl font-bold text-xs bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 flex items-center gap-2 active:scale-95 cursor-pointer"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Role Category Switcher: Shown ONLY to Admins, NEVER to Candidates or normal Recruiters */}
      {canSwitchCategory && (
        <div className="flex items-center justify-center mb-10">
          <div className="inline-flex p-1 bg-slate-100/90 rounded-2xl border border-slate-200 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveCategory('candidate')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeCategory === 'candidate'
                  ? 'bg-white text-[#2E9BDA] shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🎓 Candidate Plans</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-sky-50 text-[#2E9BDA] font-mono">Job Seeker</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('recruiter')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeCategory === 'recruiter'
                  ? 'bg-white text-emerald-700 shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🏢 Recruiter & Hiring Suite</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono">Company</span>
            </button>
          </div>
        </div>
      )}

      {/* ── CANDIDATE PRICING GRID ── */}
      {activeCategory === 'candidate' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 lg:gap-8 items-stretch mb-16">
          <PricingCard
            plan="Base (Free)"
            price="₹0"
            period="forever"
            description="Essential evaluation tools for initial resume inspection and practice."
            features={[
              '3 Smart ATS resume screening checks / mo',
              'Core score metrics & match dashboard',
              'Standard resume builder access',
              '1 AI Mock Interview session',
              'Standard documentation access',
            ]}
            ctaLabel="Current Tier"
            isCurrent={!isSubscriptionActive || currentPlan === 'free'}
          />

          <PricingCard
            plan="Candidate Pro"
            price="₹199"
            period="3 months"
            description="Full AI enhancement studio and interview coaching for active job hunters (Just ₹66/mo)."
            features={[
              'Unlimited ATS scans & keyword targeting',
              'Full AI Resume Enhancer Studio (Live WYSIWYG)',
              '15 AI Mock Interview sessions with audio review',
              'Hosted Web Portfolio (careershala.tech/p/you)',
              'Priority fast server processing queue',
              'Export ATS-approved PDF resumes',
            ]}
            ctaLabel="Get 3-Month Pro"
            isPopular={true}
            isCurrent={isSubscriptionActive && (currentPlan === 'pro' || currentPlan === 'candidate_pro')}
            loading={processingPlan === 'pro'}
            onCta={() => handlePaymentFlow('pro', 'Candidate Pro')}
          />

          <PricingCard
            plan="Job Seeker VIP"
            price="₹399"
            period="3 months"
            description="Complete unlimited career accelerator with 1-click apply and recruiter spotlight (Just ₹133/mo)."
            features={[
              'Everything in Pro included',
              'Unlimited AI Mock Interviews & live proctoring',
              '1-Click AI Apply Assistant browser tool',
              'Priority Recruiter Spotlight profile boost',
              'Interactive WYSIWYG resume compilation',
              'Direct AI Career Mentor copilot support',
            ]}
            ctaLabel="Unlock VIP Access"
            isCurrent={isSubscriptionActive && (currentPlan === 'premium' || currentPlan === 'candidate_premium')}
            loading={processingPlan === 'premium'}
            onCta={() => handlePaymentFlow('premium', 'Job Seeker VIP')}
          />
        </div>
      )}

      {/* ── RECRUITER & COMPANY PRICING GRID ── */}
      {activeCategory === 'recruiter' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 lg:gap-8 items-stretch mb-16">
          <PricingCard
            plan="Recruiter Starter"
            price="₹0"
            period="trial"
            description="Quick setup for founders and HRs exploring automated candidate parsing."
            features={[
              '1 Active job posting',
              'Up to 25 candidate resume parsing & ranking',
              'Basic ATS keyword match scoring',
              'Standard applicant status tracking',
              'Single user access',
            ]}
            ctaLabel="Current Tier"
            isCurrent={!isSubscriptionActive || currentPlan === 'free'}
          />

          <PricingCard
            plan="Recruiter Growth"
            price="₹999"
            period="3 months"
            description="High-velocity hiring suite for startups and growing agencies (Just ₹333/mo)."
            features={[
              '5 Active job postings',
              'Up to 300 candidate applications / quarter',
              'Automated AI Resume Screening & deep scoring',
              'Interactive candidate Kanban pipeline',
              '2 Team member seats & exportable shortlists',
              'Priority technical evaluation reports',
            ]}
            ctaLabel={isExecutiveRole ? "Upgrade Company (Growth)" : "Get 3-Month Growth"}
            isPopular={true}
            isCurrent={isSubscriptionActive && (currentPlan === 'recruiter_pro' || currentPlan === 'growth')}
            loading={processingPlan === 'recruiter_pro'}
            onCta={() => handlePaymentFlow('recruiter_pro', 'Recruiter Growth')}
          />

          <PricingCard
            plan="Recruiter Enterprise"
            price="₹2,499"
            period="3 months"
            description="End-to-end talent acquisition standard with proctoring and blind screening (Just ₹833/mo)."
            features={[
              'Unlimited active job postings',
              'Unlimited candidate ingestion & batch parsing',
              'Automated AI Technical Proctoring & integrity scoring',
              'Blind screening & knockout rule automation',
              'Unlimited team seats + CSV/ATS data export',
              'Dedicated hiring support & priority SLA',
            ]}
            ctaLabel={isExecutiveRole ? "Upgrade Company (Enterprise)" : "Get 3-Month Enterprise"}
            isCurrent={isSubscriptionActive && (currentPlan === 'recruiter_enterprise' || currentPlan === 'enterprise')}
            loading={processingPlan === 'recruiter_enterprise'}
            onCta={() => handlePaymentFlow('recruiter_enterprise', 'Recruiter Enterprise')}
          />
        </div>
      )}

      {/* Production Info Box */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl p-5 border border-slate-200/60 bg-slate-50/50 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center gap-4 max-w-3xl mx-auto"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-base">
          🛡️
        </div>
        <div>
          <h4 className="text-xs font-black text-slate-900 tracking-wide uppercase">
            Transparent 3-Month Access • Instant Activation
          </h4>
          <p className="text-xs text-slate-500 mt-0.5 font-medium leading-relaxed">
            All plans grant full 90-day uninterrupted access from the exact second of payment. Routed securely via Razorpay with encrypted payment verification and immediate account upgrades.
          </p>
        </div>
      </motion.div>
    </div>
  )
}