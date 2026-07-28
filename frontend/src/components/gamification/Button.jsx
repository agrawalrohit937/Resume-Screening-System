import { motion } from 'framer-motion'

const VARIANTS = {
  primary: 'bg-gradient-to-b from-blue-400 to-blue-600 text-white shadow-[0_8px_15px_rgba(37,99,235,0.25)] shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-3px_4px_rgba(0,0,0,0.2)] border border-blue-500',
  outline: 'bg-white text-slate-700 border-2 border-slate-200 shadow-sm hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 hover:shadow-md',
  ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800',
}

export default function Button({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button' }) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.03, y: -1 }}
      whileTap={disabled ? {} : { scale: 0.95, y: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-extrabold text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2
        ${VARIANTS[variant]} ${disabled ? 'opacity-50 grayscale cursor-not-allowed shadow-none' : 'cursor-pointer'} ${className}`}
    >
      {children}
    </motion.button>
  )
}