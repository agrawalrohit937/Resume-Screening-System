import React from 'react'
import { Crown as LucideCrown } from 'lucide-react'
import { getUserPlan } from '../AvatarRing'

/**
 * Helper to determine crown variant based on user subscription plan:
 * - 'gold': Premium / Enterprise / VIP
 * - 'silver': Pro / Growth
 * - null: Free / No subscription
 */
export function getCrownVariant(user) {
  const plan = getUserPlan(user)
  if (plan === 'premium') return 'gold'
  if (plan === 'pro') return 'silver'
  return null
}

/**
 * Universal Crown component for CareerShala.
 * - 'gold': Premium / Enterprise / VIP (Rich golden amber with warm glow)
 * - 'silver': Pro (Polished metallic silver with crisp slate border)
 * - 'emerald': Executive tier (Emerald green)
 */
export default function Crown({ size = 16, variant = 'gold', className = '', ...props }) {
  const isSilver = variant === 'silver'
  const isEmerald = variant === 'emerald'

  const colorClasses = isEmerald
    ? 'text-emerald-500 fill-emerald-400 drop-shadow-[0_2px_8px_rgba(52,211,153,0.7)]'
    : isSilver
    ? 'text-slate-400 fill-slate-200 drop-shadow-[0_2px_5px_rgba(148,163,184,0.65)]'
    : 'text-amber-400 fill-amber-400 drop-shadow-[0_2px_8px_rgba(243,194,75,0.7)]'

  return (
    <LucideCrown
      size={size}
      strokeWidth={2.2}
      className={`${colorClasses} ${className}`}
      {...props}
    />
  )
}

