import React, { useState, lazy, Suspense } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { isMobileViewport } from '../utils/motionUtils'

import LandingNavbar from '../components/landing/LandingNavbar'
import LandingHeroSection from '../components/landing/LandingHeroSection'
import LandingFeaturesSection from '../components/landing/LandingFeaturesSection'
import LandingCertificateSection from '../components/landing/LandingCertificateSection'
import LandingEnterpriseSection from '../components/landing/LandingEnterpriseSection'
import LandingWorkflowSection from '../components/landing/LandingWorkflowSection'
import LandingComparisonSection from '../components/landing/LandingComparisonSection'
import LandingTestimonialsSection from '../components/landing/LandingTestimonialsSection'
import LandingPricingSection from '../components/landing/LandingPricingSection'
import LandingFaqSection from '../components/landing/LandingFaqSection'
import LandingFinalCtaSection from '../components/landing/LandingFinalCtaSection'
import LandingFooter from '../components/landing/LandingFooter'

const AmbientMotionBg = lazy(() => import('../components/landing/AmbientMotionBg'))

const AmbientFallback = () => (
  <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden hidden md:flex justify-center">
    <div className="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-gradient-to-br from-[#2E9BDA]/10 to-[#6366F1]/10 rounded-full blur-[120px] opacity-60" />
    <div className="absolute top-[40%] -left-[10%] w-[600px] h-[600px] bg-gradient-to-tr from-[#3B82F6]/10 to-[#8B5CF6]/10 rounded-full blur-[140px] opacity-60" />
    <div
      className="absolute inset-0 opacity-[0.25]"
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.05) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
      }}
    />
  </div>
)

// ── Motion Animation Variants ───────────────────────────────────────────────
const customEasing = [0.16, 1, 0.3, 1]

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: customEasing } },
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
}

const scaleUp = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: customEasing } },
}

// ── FAQ Items ─────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'How does CareerShala help my resume pass ATS filters?',
    a: 'CareerShala compares your resume directly against the exact Job Description you are applying for. It checks keyword density, formatting parseability, and missing technical terms, giving you instant step-by-step suggestions to score 90%+.',
  },
  {
    q: 'Is the developer portfolio website really 100% free forever?',
    a: 'Yes, completely free! Connect your GitHub profile in one click, and we generate a personalized developer website (careershala.tech/dev/yourname) showcasing your repositories, tech stacks, and resume.',
  },
  {
    q: 'How do the AI Live Mock Interviews work?',
    a: 'You can practice answering real technical and behavioral interview questions out loud. Our friendly AI evaluates your speech pace, technical vocabulary, and clarity in real time, giving you encouraging feedback after every question.',
  },
  {
    q: 'How does the 100% Club QR verified certificate work?',
    a: 'When you achieve a top score in a proctored mock interview, you unlock an official verified digital certificate with a unique QR code and public verification URL that recruiters can instantly scan to confirm your skills.',
  },
  {
    q: 'Will recruiters really reach out to me through CareerShala?',
    a: 'Yes! If you opt into our talent showcase, verified hiring managers and technical recruiters can search candidates by skill stack and interview score, giving you direct interview invitations without cold messaging.',
  },
]

// ── Testimonials ─────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    initials: 'RS',
    name: 'Rohan Sharma',
    role: 'Full-Stack Developer',
    quote: "I couldn't believe the portfolio builder was actually free. It synced my GitHub projects in seconds and looked better than anything I'd built myself.",
    company: 'Series A FinTech',
  },
  {
    initials: 'PM',
    name: 'Priya Mehta',
    role: 'Frontend Engineer',
    quote: 'Scored 100% in the mock interview and unlocked my verified badge. A recruiter reviewed my application and invited me directly to a final round.',
    company: 'Enterprise SaaS',
  },
  {
    initials: 'AK',
    name: 'Aditya Kumar',
    role: 'Backend Architect',
    quote: 'The AI ATS matcher showed me exactly which system design keywords were missing from my resume. Got 3 interview callbacks in one week!',
    company: 'Cloud Infrastructure Startup',
  },
]

// ── Comparison Matrix Data ──────────────────────────────────────────────────
const COMPARISON_DATA = [
  { feature: 'AI Semantic ATS Optimization', us: true, traditional: false, ChatGPT: 'Basic' },
  { feature: 'Vision & Speech AI Proctored Mock Interviews', us: true, traditional: false, ChatGPT: false },
  { feature: 'Free GitHub-Synced Developer Portfolio', us: true, traditional: false, ChatGPT: false },
  { feature: 'Tamper-Proof QR Verified Certificates', us: true, traditional: false, ChatGPT: false },
  { feature: 'Automated Recruiter Outreach Dispatch', us: true, traditional: false, ChatGPT: false },
  { feature: 'Recruiter Candidate Ranking Portal', us: true, traditional: false, ChatGPT: false },
  { feature: 'Real-time Speech Pace & Clarity Coaching', us: true, traditional: false, ChatGPT: false },
  { feature: 'Instant Public Verification ID Search', us: true, traditional: false, ChatGPT: false },
]

export default function CareerPilotLanding() {
  const { user } = useAuth()

  // State
  const [isAnnual, setIsAnnual] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  const handleNewsletterSubmit = (e) => {
    e.preventDefault()
    if (!newsletterEmail) return
    setSubscribing(true)
    setTimeout(() => {
      toast.success('Subscribed to CareerShala insights! ✨')
      setNewsletterEmail('')
      setSubscribing(false)
    }, 800)
  }

  const isMobile = isMobileViewport()

  return (
    <MotionConfig reducedMotion={isMobile ? 'always' : 'user'}>
      <div className="min-h-screen w-full bg-slate-50 text-slate-900 font-sans relative overflow-x-hidden selection:bg-[#2E9BDA]/20 selection:text-[#2E9BDA] pt-14 sm:pt-16">
        {/* Background Ambient Lighting & Mesh (Lazy Loaded with Instant Fallback) */}
        <Suspense fallback={<AmbientFallback />}>
          <AmbientMotionBg />
        </Suspense>

        {/* 1. Header Navigation Bar (Fixed & Sticky) */}
        <LandingNavbar
          user={user}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />

        {/* 2. Static Hero Section (LCP Optimized with SaaS Dashboard Showcase) */}
        <LandingHeroSection user={user} />

        {/* 3. Core Feature Suite Section (Asymmetric Bento Grid) */}
        <LandingFeaturesSection fadeInUp={fadeInUp} />

        {/* 4. Verifiable Skill Certificate Showcase Section (3D Stacked Pedestal) */}
        <LandingCertificateSection user={user} fadeInUp={fadeInUp} />

        {/* 5. Enterprise Recruiter & Talent Portal Section */}
        <LandingEnterpriseSection user={user} />

        {/* 6. Step-by-Step Workflow Journey Section */}
        <LandingWorkflowSection activeStep={activeStep} setActiveStep={setActiveStep} />

        {/* 6. Comparison Matrix Table Section */}
        <LandingComparisonSection data={COMPARISON_DATA} />

        {/* 7. Developer Testimonials Section */}
        <LandingTestimonialsSection testimonials={TESTIMONIALS} />

        {/* 8. Transparent Pricing Section (with Recruiter ROI Framing) */}
        <LandingPricingSection isAnnual={isAnnual} setIsAnnual={setIsAnnual} />

        {/* 9. FAQ Accordion Section */}
        <LandingFaqSection items={FAQ_ITEMS} openFaq={openFaq} setOpenFaq={setOpenFaq} />

        {/* 10. Final Closing High-Conversion CTA Banner */}
        <LandingFinalCtaSection user={user} />

        {/* 11. Mega Footer */}
        <LandingFooter
          newsletterEmail={newsletterEmail}
          setNewsletterEmail={setNewsletterEmail}
          subscribing={subscribing}
          handleNewsletterSubmit={handleNewsletterSubmit}
        />
      </div>
    </MotionConfig>
  )
}