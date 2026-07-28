/**
 * SupportButton — "Get Support" button that opens the support modal
 * Can be used standalone or as a replacement for Contact Support buttons
 */
import { useState, forwardRef } from 'react'
import { LifeBuoy } from 'lucide-react'
import SupportModal from './SupportModal'

const SupportButton = forwardRef(function SupportButton(
  {
    variant = 'primary',
    size = 'md',
    className = '',
    label = 'Get Support',
    showIcon = true,
    ...props
  },
  ref
) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const baseClasses =
    'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all active:scale-[0.98] cursor-pointer select-none'

  const variantClasses = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300',
    ghost: 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700',
    billing:
      'w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-white text-slate-900 hover:bg-slate-100 transition-colors shrink-0',
  }

  const sizeClasses = {
    sm: 'px-3.5 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base rounded-2xl',
  }

  return (
    <>
      <button
        ref={ref}
        onClick={() => setIsModalOpen(true)}
        className={`${baseClasses} ${variantClasses[variant] || variantClasses.primary} ${sizeClasses[size] || sizeClasses.md} ${className}`}
        {...props}
      >
        {showIcon && <LifeBuoy size={size === 'sm' ? 14 : 16} strokeWidth={2.5} />}
        {label}
      </button>

      <SupportModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
})

export default SupportButton

