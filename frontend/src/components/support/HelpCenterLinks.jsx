/**
 * HelpCenterLinks — Quick links to FAQ, documentation, privacy policy, etc.
 */
import { motion } from 'framer-motion'
import {
  FileQuestion,
  BookOpen,
  Shield,
  FileText,
  Mail,
  Activity,
  ExternalLink,
} from 'lucide-react'

const LINKS = [
  { label: 'Frequently Asked Questions', icon: FileQuestion, href: '/faq' },
  { label: 'Documentation', icon: BookOpen, href: '/docs' },
  { label: 'Privacy Policy', icon: Shield, href: '/privacy' },
  { label: 'Terms of Service', icon: FileText, href: '/terms' },
  { label: 'Contact Email', icon: Mail, href: 'mailto:admin@careershala.tech' },
  { label: 'Status Page', icon: Activity, href: 'https://status.careershala.tech' },
]

export default function HelpCenterLinks() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
        Help Center
      </p>
      <div className="grid grid-cols-2 gap-2">
        {LINKS.map((link, idx) => {
          const Icon = link.icon
          const isExternal = link.href.startsWith('http') || link.href.startsWith('mailto:')

          return (
            <a
              key={idx}
              href={link.href}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-slate-200 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-all shrink-0">
                <Icon size={15} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-slate-700 group-hover:text-indigo-700 transition-colors truncate">
                  {link.label}
                </p>
              </div>
              <ExternalLink size={12} className="text-slate-400 group-hover:text-indigo-500 shrink-0" strokeWidth={2.5} />
            </a>
          )
        })}
      </div>
    </motion.div>
  )
}

