/**
 * PremiumSupportCard — Plan-specific support card with gradient styling
 * Enterprise for Recruiters/Admins, Gold for Premium, Blue for Pro, Slate for Free
 */
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { Sparkles, Zap, ShieldCheck, Clock, ArrowRight, Check } from 'lucide-react'

const PLAN_CONFIGS = {
  enterprise: {
    gradient: 'from-indigo-600/15 via-violet-500/10 to-indigo-950/20',
    border: 'border-indigo-300/60',
    badge: 'bg-indigo-600 text-white',
    badgeLabel: 'Enterprise VIP Support',
    title: 'Enterprise Dedicated Support',
    responseTime: '< 30 Minutes',
    accentText: 'text-indigo-600',
    features: ['Dedicated Account Lead', '24/7 Priority SLA', 'Direct Tech Escalation'],
    glowColor: 'rgba(99,102,241,0.18)',
    buttonBg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  premium: {
    gradient: 'from-amber-600/15 via-amber-500/10 to-amber-900/20',
    border: 'border-amber-400/40',
    badge: 'bg-amber-500 text-amber-950',
    badgeLabel: 'Priority Support',
    title: 'Premium Priority Support',
    responseTime: '< 2 Hours',
    accentText: 'text-amber-700',
    features: ['Dedicated Support Queue', 'Fast SLA Resolution', 'Direct Email Access'],
    glowColor: 'rgba(245,158,11,0.18)',
    buttonBg: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  pro: {
    gradient: 'from-blue-600/15 via-blue-500/10 to-indigo-900/20',
    border: 'border-blue-400/40',
    badge: 'bg-blue-600 text-white',
    badgeLabel: 'Fast Support',
    title: 'Pro Member Support',
    responseTime: '< 8 Hours',
    accentText: 'text-blue-700',
    features: ['Priority Email', 'Same-Day Response', 'Dedicated Ticket Queue'],
    glowColor: 'rgba(59,130,246,0.15)',
    buttonBg: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  free: {
    gradient: 'from-slate-600/10 via-slate-500/5 to-slate-800/10',
    border: 'border-slate-200',
    badge: 'bg-slate-100 text-slate-700 border border-slate-200',
    badgeLabel: 'Standard Support',
    title: 'Community & Standard Help',
    responseTime: '24-48 Hours',
    accentText: 'text-slate-600',
    features: ['Email Support', 'Help Center Documentation', 'Community Forum'],
    glowColor: 'rgba(100,116,139,0.1)',
    buttonBg: 'bg-slate-900 hover:bg-slate-800 text-white',
  },
}

export default function PremiumSupportCard({ onGetSupport }) {
  const { user } = useAuth()
  
  const userRoles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
  ].filter(Boolean).map((r) => String(r).toLowerCase().trim())

  const isEnterprise =
    user?.plan === 'enterprise' ||
    userRoles.some((r) => ['recruiter', 'admin', 'platform_admin', 'executive', 'exec', 'hiring_manager'].includes(r))

  const planKey = isEnterprise
    ? 'enterprise'
    : (user?.plan || 'free').toLowerCase()

  const config = PLAN_CONFIGS[planKey] || PLAN_CONFIGS.free

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 bg-gradient-to-br ${config.gradient} ${config.border} shadow-xs`}
    >
      {/* Decorative Glow */}
      <div
        className="absolute -top-16 -right-16 w-36 h-36 rounded-full blur-2xl pointer-events-none"
        style={{ background: config.glowColor }}
      />

      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Side: Header, Title, Features */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${config.badge}`}>
              {config.badgeLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/60 shadow-2xs">
              <Clock size={11} className={config.accentText} />
              <span>SLA: {config.responseTime}</span>
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-black text-slate-900 font-poppins leading-tight">
            {config.title}
          </h3>

          {/* Feature Badges */}
          <div className="flex items-center gap-x-3 gap-y-1 mt-2.5 flex-wrap">
            {config.features.map((feat) => (
              <span key={feat} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Check size={10} strokeWidth={3} />
                </span>
                {feat}
              </span>
            ))}
          </div>
        </div>

        {/* Right Side: CTA Button */}
        <div className="shrink-0 flex items-center">
          <button
            type="button"
            onClick={onGetSupport}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:shadow transition-all cursor-pointer active:scale-95 ${config.buttonBg}`}
          >
            <span>Create Ticket</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
