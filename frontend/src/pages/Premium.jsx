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

  // Dynamically load the external Razorpay Checkout SDK script tag
  useEffect(() => {
    const scriptId = 'razorpay-checkout-sdk'
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  const handlePaymentFlow = async (planName) => {
    setProcessingPlan(planName)
    try {
      // Step 1: Request order instantiation from backend gateway routes
      const checkoutRes = await createCheckout(planName.toLowerCase())
      const orderData = checkoutRes.data

      // Ensure the runtime script has compiled into global context
      if (!window.Razorpay) {
        throw new Error('Payment SDK is loading. Please try again in a moment.')
      }

      // Step 2: Configure the native modal checkout options overlay
      const options = {
        key: orderData.razorpay_key_id,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'CareerShala Platform',
        description: `Upgrade to ${planName} Subscription`,
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
          setProcessingPlan(planName)
          try {
            await verifyPayment({
              plan: planName.toLowerCase(),
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })

            toast.success(`Account successfully upgraded to ${planName}! 🎉`)
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
            plan: planName.toLowerCase(),
            order_id: response.error?.metadata?.order_id || orderData.id,
            failure_reason: errorDesc,
            failure_code: response.error?.code || 'payment_failed',
          })
          console.log('[Razorpay] Payment failure successfully reported to AI recovery pipeline.')
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
    <div className="w-full max-w-6xl mx-auto px-4 py-12 antialiased">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-16">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest text-blue-600 uppercase mb-2 bg-blue-50 px-2.5 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            Pricing Strategy
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Upgrade to Unlimited AI Power
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl font-medium">
            Scale your optimization capabilities, refine structural analyses, and access state-of-the-art career predictive modeling instantly.
          </p>
        </div>
        
        <button
          onClick={() => navigate('/dashboard')}
          className="self-start md:self-center px-5 py-2.5 rounded-xl font-bold text-xs bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 flex items-center gap-2 active:scale-95"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 lg:gap-8 items-stretch mb-16">
        <PricingCard
          plan="Base"
          price="₹0"
          description="Essential features for initial evaluation and basic testing parameters."
          features={[
            'Smart ATS screening models',
            'Core metrics and analysis dashboard',
            'Standard optimization tracking',
            'Community documentation access',
          ]}
          ctaLabel="Current Tier"
          isCurrent={true}
        />

        <PricingCard
          plan="Pro"
          price="₹299"
          description="Enhanced intelligence limits for scaling workflows and proactive insights."
          features={[
            'Expanded deep learning token limit',
            'Advanced metrics and priority scoring',
            'Automated optimization recommendations',
            'Comprehensive diagnostic tools',
            'Priority queue server processing',
          ]}
          ctaLabel="Upgrade to Pro"
          loading={processingPlan === 'Pro'}
          onCta={() => handlePaymentFlow('Pro')}
        />

        <PricingCard
          plan="Premium"
          price="₹499"
          description="The complete processing standard for absolute access without constraints."
          features={[
            'Unlimited advanced deep learning scans',
            'Predictive cross-platform career telemetry',
            'Real-time automated optimization system',
            'Dedicated processing infrastructure',
            'Direct programmatic API endpoints',
            'Elite engineering support access',
          ]}
          ctaLabel="Unlock Premium"
          isPopular={true}
          loading={processingPlan === 'Premium'}
          onCta={() => handlePaymentFlow('Premium')}
        />
      </div>

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
            Secured Encrypted Checkout
          </h4>
          <p className="text-xs text-slate-500 mt-0.5 font-medium leading-relaxed">
            Payments are fully routed securely via automated Razorpay token infrastructure layers. Your account values will update instantly following a valid webhook cryptographic handshake confirmation.
          </p>
        </div>
      </motion.div>
    </div>
  )
}