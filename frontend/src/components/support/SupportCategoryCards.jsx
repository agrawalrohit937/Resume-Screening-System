/**
 * SupportCategoryCards — Displays support category cards with icons
 * Clicking a card selects the category for ticket creation
 */
import { motion } from 'framer-motion'
import {
  CreditCard,
  UserCircle,
  FileText,
  Sparkles,
  Bug,
  Lightbulb,
  HelpCircle,
  ChevronRight,
} from 'lucide-react'

const CATEGORIES = [
  {
    id: 'billing',
    label: 'Billing & Payments',
    icon: CreditCard,
    subcategories: ['Upgrade Plan', 'Cancel Subscription', 'Refund Request', 'Failed Payment', 'GST Invoice'],
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    hoverColor: 'hover:border-emerald-300 hover:bg-emerald-50/80',
  },
  {
    id: 'account',
    label: 'Account & Login',
    icon: UserCircle,
    subcategories: ['Password Reset', 'Email Verification', 'Google Login', 'GitHub Login', 'LinkedIn Login', 'Delete Account'],
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    hoverColor: 'hover:border-blue-300 hover:bg-blue-50/80',
  },
  {
    id: 'resume',
    label: 'Resume & ATS',
    icon: FileText,
    subcategories: ['Resume Upload', 'ATS Score', 'Resume Parsing', 'PDF Generation'],
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    hoverColor: 'hover:border-purple-300 hover:bg-purple-50/80',
  },
  {
    id: 'ai_features',
    label: 'AI Features',
    icon: Sparkles,
    subcategories: ['AI Copilot', 'Mock Interview', 'Resume Enhancer', 'Career Recommendations'],
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    hoverColor: 'hover:border-amber-300 hover:bg-amber-50/80',
  },
  {
    id: 'bug',
    label: 'Report a Bug',
    icon: Bug,
    subcategories: [],
    color: 'bg-rose-50 text-rose-600 border-rose-200',
    hoverColor: 'hover:border-rose-300 hover:bg-rose-50/80',
  },
  {
    id: 'feature_request',
    label: 'Feature Request',
    icon: Lightbulb,
    subcategories: [],
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    hoverColor: 'hover:border-indigo-300 hover:bg-indigo-50/80',
  },
  {
    id: 'other',
    label: 'Other',
    icon: HelpCircle,
    subcategories: [],
    color: 'bg-slate-50 text-slate-600 border-slate-200',
    hoverColor: 'hover:border-slate-300 hover:bg-slate-50/80',
  },
]

export default function SupportCategoryCards({ selectedCategory, onSelect, onBack }) {
  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.05, duration: 0.25, ease: 'easeOut' },
    }),
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div>
          <h3 className="text-base font-black text-slate-900">How can we help?</h3>
          <p className="text-xs font-medium text-slate-500 mt-0.5">Choose a category to get started</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
        {CATEGORIES.map((cat, idx) => {
          const Icon = cat.icon
          const isSelected = selectedCategory === cat.id

          return (
            <motion.button
              key={cat.id}
              custom={idx}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              onClick={() => onSelect(cat.id)}
              className={`w-full flex items-center gap-3.5 p-4 rounded-xl border transition-all text-left group
                ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-300 bg-indigo-50/50' : `border-slate-200 bg-white ${cat.hoverColor}`}
              `}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cat.color}`}>
                <Icon size={20} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                  {cat.label}
                </p>
                {cat.subcategories.length > 0 && (
                  <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate">
                    {cat.subcategories.slice(0, 3).join(' · ')}
                    {cat.subcategories.length > 3 && ` +${cat.subcategories.length - 3} more`}
                  </p>
                )}
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" strokeWidth={2.5} />
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

