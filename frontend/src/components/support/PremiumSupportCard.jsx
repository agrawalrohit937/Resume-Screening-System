/**
 * PremiumSupportCard — Plan-specific support card with gradient styling
 * Gold for Premium, Blue for Pro, Gray for Free
 */
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'

const PLAN_CONFIGS = {
  premium: {
    gradient: 'from-amber-600/20 via-amber-500/10 to-amber-900/20',
    border: 'border-amber-500/30',
    ring: 'ring-amber-500/20',
    badge: 'bg-amber-500 text-amber-950',
    badgeLabel: 'Priority Support',
    title: 'Premium Support',
    responseTime: '<2 Hours',
    accent: 'bg-gradient-to-r from-amber-400 to-orange-500',
    accentText: 'text-amber-100',
    features: ['Dedicated Support', 'Fast Resolution', 'Priority Queue'],
    glowColor: 'rgba(245,158,11,0.15)',
  },
  pro: {
    gradient: 'from-blue-600/20 via-blue-500/10 to-indigo-900/20',
    border: 'border-blue-500/30',
    ring: 'ring-blue-500/20',
    badge: 'bg-blue-500 text-white',
    badgeLabel: 'Fast Support',
    title: 'Pro Support',
    responseTime: '8 Hours',
    accent: 'bg-gradient-to-r from-blue-400 to-indigo-500',
    accentText: 'text-blue-100',
    features: ['Priority Email', 'Faster Response', 'Dedicated Queue'],
    glowColor: 'rgba(59,130,246,0.15)',
  },
  free: {
    gradient: 'from-slate-600/20 via-slate-500/10 to-slate-800/20',
    border: 'border-slate-500/20',
    ring: 'ring-slate-500/10',
    badge: 'bg-slate-500 text-white',
    badgeLabel: 'Standard',
    title: 'Standard Support',
    responseTime: '24-48 Hours',
    accent: 'bg-gradient-to-r from-slate-400 to-slate-500',
    accentText: 'text-slate-300',
    features: ['Email Support', 'Knowledge Base', 'Community Access'],
    glowColor: 'rgba(100,116,139,0.1)',
  },
}

export default function PremiumSupportCard({ onGetSupport }) {
  const { user } = useAuth()
  const plan = (user?.plan || 'free').toLowerCase()
  const config = PLAN_CONFIGS[plan] || PLAN_CONFIGS.free

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="relative overflow-hidden rounded-2xl border p-6"
      style={{
        background: `linear-gradient(135deg, ${config.glowColor}, transparent)`,
        borderColor: config.border,
      }}
    >
      {/* Glow effect */}
      <div
        className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl pointer-events-none"
        style={{ background: config.glowColor }}
      />
      <div
        className="absolute -bottom-10 -left-10 w-24 h-24 rounded-full blur-2xl pointer-events-none"
        style={{ background: config.glowColor }}
      />

      <div className="relative">
        {/* Badge */}
        <div className="flex items-center justify-between mb-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${config.badge}`}>
            {config.badgeLabel}
          </span>
          <span className={`text-[11px] font-bold ${config.accentText} opacity-80`}>
            Avg. {config.responseTime}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-black text-slate-900 mb-1">{config.title}</h3>
        <p className="text-sm font-medium text-slate-500 mb-4">Average response time: <span className="font-bold text-slate-800">{config.responseTime}</span></p>

        {/* Features */}
        <div className="space-y-2.5 mb-5">
          {config.features.map((feat) => (
            <div key={feat} className="flex items-center gap-2.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${config.accent}`}>
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700">{feat}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onGetSupport}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
          style={{
            background: `linear-gradient(135deg, ${plan === 'premium' ? '#F59E0B, #D97706' : plan === 'pro' ? '#3B82F6, #6366F1' : '#64748B, #475569'})`,
          }}
        >
          Get Support
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </motion.div>
  )
}

