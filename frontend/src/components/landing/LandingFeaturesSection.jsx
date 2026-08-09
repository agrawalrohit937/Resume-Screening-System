import React from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Video,
  Globe,
  Award,
  Users,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Trophy,
  ArrowRight,
  Sparkles,
  Send,
  Gamepad2,
  Bot,
} from 'lucide-react'

export default function LandingFeaturesSection({ fadeInUp }) {
  const features = [
    {
      icon: <FileText className="w-6 h-6 text-[#2E9BDA]" />,
      badge: 'SMART ATS SCANNER',
      badgeBg: 'bg-sky-100 text-[#2E9BDA] border-sky-200',
      title: 'Pass corporate ATS filters with high-precision keyword alignment',
      description: 'Upload your resume alongside any job post. CareerShala points out missing technical keywords, calculates your match percentage, and formats your bullets for 100% parseability.',
      bullets: ['Compatible with Workday, Greenhouse & Lever', 'Actionable bullet point suggestions', '1-Click PDF export'],
    },
    {
      icon: <Video className="w-6 h-6 text-indigo-600" />,
      badge: 'FRIENDLY AI MOCK COACH',
      badgeBg: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      title: 'Practice live mock interviews with real-time speech feedback',
      description: 'Build confidence with our friendly AI interviewer. Practice answering system design and behavioral questions while receiving helpful speech pace and clarity telemetry.',
      bullets: ['Speech pace & filler word tracker', 'MediaPipe vision proctoring', 'Instant post-interview scoring'],
    },
    {
      icon: <Globe className="w-6 h-6 text-emerald-600" />,
      badge: 'FREE DEVELOPER PORTFOLIO',
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      title: 'Showcase your GitHub projects with a free instant website',
      description: 'Connect your GitHub profile to generate a beautiful developer website (portfolio.careershala.com/yourname). Highlight live projects, tech stacks, and your ATS-optimized resume.',
      bullets: ['1-Click GitHub sync', '100% Free forever', 'Fast CDN hosting'],
    },
    {
      icon: <Award className="w-6 h-6 text-amber-600" />,
      badge: 'VERIFIED CERTIFICATES',
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-200',
      title: 'Earn 100% Club QR verified badges for hiring managers',
      description: 'Complete mock interviews to unlock tamper-proof digital certificates. Each badge includes a unique public verification URL and scannable QR code for your resume.',
      bullets: ['Unique public verification link', 'Scannable QR code badge', 'Add directly to LinkedIn profile'],
    },
    {
      icon: <Send className="w-6 h-6 text-cyan-600" />,
      badge: 'AUTO OUTREACH AGENT',
      badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      title: 'Automated job applications & recruiter cold outreach',
      description: 'Generate personalized recruiter cold emails, track application follow-ups, and auto-submit targeted job applications with AI precision.',
      bullets: ['Personalized email generator', 'Application status dashboard', '1-Click recruiter dispatch'],
    },
    {
      icon: <Gamepad2 className="w-6 h-6 text-rose-600" />,
      badge: 'CAREERQUEST ENGINE',
      badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
      title: 'Gamified career progression with daily XP streaks & quests',
      description: 'Earn XP points, level up your engineering tier, unlock achievement badges, and keep your daily interview practice streak alive.',
      bullets: ['Daily streak tracker', 'Engineering level progression', 'Unlockable achievement badges'],
    },
    {
      icon: <Bot className="w-6 h-6 text-blue-600" />,
      badge: 'REAL-TIME AI COPILOT',
      badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
      title: '24/7 personal AI career advisor & resume copilot',
      description: 'Ask questions anytime. Get instant advice on salary negotiations, interview prep strategy, and technical resume refinements.',
      bullets: ['24/7 AI career assistant', 'Salary negotiation guidance', 'Custom interview prep plans'],
    },
    {
      icon: <Users className="w-6 h-6 text-purple-600" />,
      badge: 'RECRUITER FAST-TRACK',
      badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
      title: 'Connect directly with hiring managers searching for top talent',
      description: 'Opt into our talent marketplace so top recruiters can view your verified scorecards, search your exact tech stack, and dispatch direct interview invitations.',
      bullets: ['Verified candidate rankings', 'Direct recruiter outreach', 'Full privacy controls'],
    },
  ]

  return (
    <section id="features" className="py-16 sm:py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-[#2E9BDA] text-xs font-bold uppercase tracking-wider mb-4 shadow-sm">
            <Sparkles size={14} />
            <span>Complete 8-in-1 Platform Capabilities</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4">
            Built to Give You an Unfair Advantage
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-medium">
            Everything you need to optimize your resume, ace technical interviews, automate application outreach, and get hired fast.
          </p>
        </div>

        {/* Feature Cards Grid (8 Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="bg-gradient-to-b from-slate-50 to-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                    {feat.icon}
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${feat.badgeBg}`}>
                    {feat.badge}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 mb-2 leading-snug">
                  {feat.title}
                </h3>
                <p className="text-slate-600 text-xs leading-relaxed mb-4 font-medium">
                  {feat.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200/70 space-y-2">
                {feat.bullets.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                    <CheckCircle2 size={13} className="text-[#2E9BDA] shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
