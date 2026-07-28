import { motion } from 'framer-motion'

// ── Plan Detection ────────────────────────────────────────────────────────
export function getUserPlan(user) {
  if (!user) return 'free'
  const raw =
    user.plan ||
    user.subscription_tier ||
    user.subscription?.tier ||
    user.subscription?.plan ||
    user.tier ||
    'free'
  const normalized = String(raw).toLowerCase()
  if (normalized.includes('premium')) return 'premium'
  if (normalized.includes('pro')) return 'pro'
  return 'free'
}

// ── Google Gemini Inspired Gradients ──────────────────────────────────────
const PLAN_THEMES = {
  premium: {
    // The iconic Gemini Advanced flow: Deep Purple -> Electric Violet -> Soft Pink/Amber
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 35%, #EC4899 70%, #F59E0B 100%)',
    glow: 'rgba(168, 85, 247, 0.25)',
  },
  pro: {
    // A clean, tech-focused Google Pro aesthetic: Clean Cyan to Royal Blue
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 50%, #6366F1 100%)',
    glow: 'rgba(59, 130, 246, 0.2)',
  }
}

export default function AvatarRing({ user, ringSize = 44, shape = 'circle', children }) {
  const plan = getUserPlan(user)
  
  // Free users don't get the premium treatment
  if (plan === 'free') return children

  const theme = PLAN_THEMES[plan]
  const isCircle = shape === 'circle'
  const borderRadius = isCircle ? '50%' : '14px' // Sleek modern rounded corner for squircle
  
  // Gemini rings are extremely delicate and thin (around 1.5px to 2px)
  const strokeWidth = 1.75 
  const gapWidth = 2.5 // The critical whitespace between the ring and the photo

  return (
    <div
      className="relative shrink-0 flex items-center justify-center select-none"
      style={{ 
        width: ringSize, 
        height: ringSize,
        padding: `${strokeWidth + gapWidth}px`
      }}
    >
      {/* 1. The Aura Layer (Soft, ethereal background glow) */}
      <motion.div
        className="absolute pointer-events-none opacity-40 mix-blend-screen dark:mix-blend-normal"
        style={{
          inset: '-2px',
          background: theme.gradient,
          borderRadius: borderRadius,
          filter: 'blur(6px)',
        }}
        animate={{ 
          opacity: [0.35, 0.55, 0.35],
          scale: [0.98, 1.02, 0.98] 
        }}
        transition={{ 
          duration: 5, 
          repeat: Infinity, 
          ease: 'easeInOut' 
        }}
        aria-hidden="true"
      />

      {/* 2. Razor-Thin Precision Ring */}
      <div
        className="absolute inset-0"
        style={{
          background: theme.gradient,
          borderRadius: borderRadius,
          padding: `${strokeWidth}px`,
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
        aria-hidden="true"
      />

      {/* 3. The Avatar Container Core */}
      <div 
        className="relative z-10 w-full h-full flex items-center justify-center overflow-hidden"
        style={{ borderRadius: isCircle ? '50%' : '10px' }}
      >
        {children}
      </div>
    </div>
  )
}