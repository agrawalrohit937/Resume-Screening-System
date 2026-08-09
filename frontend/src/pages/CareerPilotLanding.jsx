import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import toast from 'react-hot-toast';
import { isMobileViewport } from '../utils/motionUtils';

const AmbientMotionBg = lazy(() => import('../components/landing/AmbientMotionBg'));

const AmbientFallback = () => (
  <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden hidden md:flex justify-center">
    <div className="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-gradient-to-br from-[#2E9BDA]/10 to-[#6366F1]/10 rounded-full blur-[120px] opacity-60" />
    <div className="absolute top-[40%] -left-[10%] w-[600px] h-[600px] bg-gradient-to-tr from-[#3B82F6]/10 to-[#8B5CF6]/10 rounded-full blur-[140px] opacity-60" />
    <div
      className="absolute inset-0 opacity-[0.3]"
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.05) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
      }}
    />
  </div>
)
import {
  Sparkles,
  CheckCircle2,
  Zap,
  ShieldCheck,
  FileText,
  Video,
  Trophy,
  Award,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Search,
  Star,
  Check,
  ExternalLink,
  Bot,
  BarChart3,
  Lock,
  Globe,
  Users,
  Send,
  HelpCircle,
  Clock,
  Briefcase,
  Flame,
  Code,
  CheckSquare,
  XSquare,
  Cpu,
  Layers,
  Activity,
  Terminal,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Twitter,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ── Motion Animation Variants ───────────────────────────────────────────────
const customEasing = [0.16, 1, 0.3, 1];

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: customEasing } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const scaleUp = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: customEasing } }
};

// ── FAQ Items ─────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'How does CareerShala analyze ATS resume compatibility?',
    a: 'We combine advanced AI semantic matching with contextual keyword analysis to calculate deep compatibility between your resume and target Job Descriptions, ensuring high ATS match scores.',
  },
  {
    q: 'How does the 100% Club verified certificate work?',
    a: 'Complete a proctored AI mock interview and score a perfect score across confidence, clarity and technical precision, and we issue an official certificate with a unique QR code and public verification ID that recruiters can scan.',
  },
  {
    q: 'Is the developer portfolio builder really free forever?',
    a: 'Yes! You can generate your personal developer portfolio (portfolio.careershala.com/yourname) syncing your GitHub projects and ATS resume in seconds, completely free forever.',
  },
  {
    q: 'How does the Live AI Video Interviewer evaluate responses?',
    a: 'Our AI speech and vision engine evaluates speech pace, technical vocabulary accuracy, and delivery confidence in real-time, delivering detailed post-question feedback.',
  },
];

// ── Testimonials ─────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    initials: 'RS',
    name: 'Rohan Sharma',
    role: 'Full-Stack Developer',
    quote: "I couldn't believe the portfolio builder was actually free. It synced my GitHub projects in seconds and looked better than anything I'd built myself.",
    company: 'Fintech Startup',
  },
  {
    initials: 'PM',
    name: 'Priya Mehta',
    role: 'Frontend Engineer',
    quote: 'Scored 100% in the mock interview and unlocked my verified badge. A recruiter found my profile through talent search and invited me directly to a final round.',
    company: 'SaaS Enterprise',
  },
  {
    initials: 'AK',
    name: 'Aditya Kumar',
    role: 'Backend Architect',
    quote: 'The AI ATS matcher showed me exactly which system design keywords were missing from my resume. Got 3 interview callbacks in one week!',
    company: 'Cloud Corp',
  },
];

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
];

export default function CareerPilotLanding() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [isAnnual, setIsAnnual] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [activeCockpitTab, setActiveCockpitTab] = useState('ats');
  const [playgroundRole, setPlaygroundRole] = useState('Full-Stack Engineer');
  const [playgroundSkills, setPlaygroundSkills] = useState('React, Python, Docker, Node.js');
  const [analyzingPlayground, setAnalyzingPlayground] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    if (!newsletterEmail) return;
    setSubscribing(true);
    setTimeout(() => {
      toast.success('Subscribed to CareerShala insights! ✨');
      setNewsletterEmail('');
      setSubscribing(false);
    }, 800);
  };

  const handlePlaygroundSubmit = (e) => {
    e.preventDefault();
    if (!playgroundSkills.trim()) return;
    setAnalyzingPlayground(true);
    setTimeout(() => {
      const skillsArr = playgroundSkills.split(',').map((s) => s.trim().toLowerCase());
      const hasDocker = skillsArr.includes('docker') || skillsArr.includes('kubernetes');
      const hasSystemDesign = skillsArr.includes('system design') || skillsArr.includes('redis');
      const score = 75 + (hasDocker ? 12 : 0) + (hasSystemDesign ? 10 : 0);

      setPlaygroundResult({
        score: Math.min(score, 96),
        matched: skillsArr.map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
        missing: ['System Architecture', 'Redis Caching', 'CI/CD Pipelines', 'Kubernetes'],
        recommendation: 'Add quantitative impact metrics and include Redis/CI-CD keywords to reach 95%+ match score.',
      });
      setAnalyzingPlayground(false);
    }, 900);
  };

  const isMobile = isMobileViewport();

  return (
    <MotionConfig reducedMotion={isMobile ? "always" : "user"}>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative overflow-x-hidden selection:bg-[#2E9BDA]/20 selection:text-[#2E9BDA]">
      
      {/* ── Background Ambient Lighting & Mesh (Lazy Loaded with Instant Fallback) ────────────────────── */}
      <Suspense fallback={<AmbientFallback />}>
        <AmbientMotionBg />
      </Suspense>

      {/* ── Header Navigation Bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-slate-200/80 shadow-sm transition-all duration-300">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-8 lg:px-12 h-16 sm:h-20 flex items-center justify-between gap-3">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center group-hover:shadow-md group-hover:scale-105 transition-all duration-300 p-1 sm:p-1.5">
              <img src="/logo_t.png" alt="CareerShala Logo" width={40} height={40} decoding="async" loading="eager" className="w-full h-full object-contain" />
            </div>
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 group-hover:opacity-80 transition-opacity">
              Career<span className="text-[#2E9BDA]">Shala</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-3.5 xl:gap-6 text-[11px] xl:text-xs font-extrabold uppercase tracking-wider text-slate-500 whitespace-nowrap">
            <a href="#ats-suite" className="hover:text-[#2E9BDA] transition-colors">ATS Scanner</a>
            <a href="#interviews" className="hover:text-[#2E9BDA] transition-colors">AI Interview</a>
            <a href="#portfolio" className="hover:text-emerald-500 transition-colors text-emerald-600 relative group">
              Free Portfolio
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500 transition-all group-hover:w-full"></span>
            </a>
            <a href="#100-club" className="hover:text-[#2E9BDA] transition-colors">100% Club</a>
            <a href="#recruiter-portal" className="hover:text-[#2E9BDA] transition-colors">For Recruiters</a>
            <Link to="/careers" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 text-amber-600 hover:text-amber-700 hover:border-amber-500/50 transition-all shadow-sm">
              <Flame size={13} className="text-amber-500 animate-pulse fill-amber-500" />
              <span>We're Hiring!</span>
            </Link>
            <a href="#pricing" className="hover:text-[#2E9BDA] transition-colors">Pricing</a>
          </nav>

          {/* Top Bar Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#165a88] text-white font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all whitespace-nowrap"
              >
                <span>Dashboard</span>
                <ArrowRight size={14} className="hidden sm:inline" />
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline-flex px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  Log In
                </Link>
                <button
                  onClick={() => navigate('/signup')}
                  className="flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#165a88] text-white font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all whitespace-nowrap shrink-0"
                >
                  <span>Get Started<span className="hidden sm:inline"> Free</span></span>
                  <ArrowRight size={14} className="hidden sm:inline" />
                </button>
              </>
            )}

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(prev => !prev)}
              className="lg:hidden p-2.5 rounded-xl text-slate-800 bg-slate-100/90 hover:bg-slate-200/90 active:scale-95 transition-all focus:outline-none flex items-center justify-center border border-slate-200/80 shadow-sm"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
            </button>
          </div>
        </div>

        {/* ── Mobile Navigation Drawer / Dropdown ────────────────────────────── */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="lg:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-4 pt-4 pb-6 space-y-4 max-h-[calc(100vh-80px)] overflow-y-auto">
                <nav className="flex flex-col space-y-1">
                  <a
                    href="#ats-suite"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-[#2E9BDA] hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <FileText size={16} className="text-[#2E9BDA]" />
                      ATS Scanner
                    </span>
                    <ChevronRight size={15} className="text-slate-400" />
                  </a>

                  <a
                    href="#interviews"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-[#2E9BDA] hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Video size={16} className="text-indigo-500" />
                      AI Interview
                    </span>
                    <ChevronRight size={15} className="text-slate-400" />
                  </a>

                  <a
                    href="#portfolio"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider text-emerald-700 hover:bg-emerald-50/50 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Briefcase size={16} className="text-emerald-500" />
                      Free Portfolio
                      <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-100 text-emerald-700 font-extrabold ml-1">FREE</span>
                    </span>
                    <ChevronRight size={15} className="text-emerald-500" />
                  </a>

                  <a
                    href="#100-club"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-[#2E9BDA] hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Trophy size={16} className="text-amber-500" />
                      100% Club
                    </span>
                    <ChevronRight size={15} className="text-slate-400" />
                  </a>

                  <a
                    href="#recruiter-portal"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-[#2E9BDA] hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Users size={16} className="text-purple-500" />
                      For Recruiters
                    </span>
                    <ChevronRight size={15} className="text-slate-400" />
                  </a>

                  <Link
                    to="/careers"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50/60 border border-amber-200/60 hover:bg-amber-100/60 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Flame size={16} className="text-amber-500 fill-amber-500 animate-pulse" />
                      We're Hiring!
                    </span>
                    <ChevronRight size={15} className="text-amber-500" />
                  </Link>

                  <a
                    href="#pricing"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-[#2E9BDA] hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Zap size={16} className="text-sky-500" />
                      Pricing
                    </span>
                    <ChevronRight size={15} className="text-slate-400" />
                  </a>
                </nav>

                <div className="pt-3 border-t border-slate-200/80 flex flex-col gap-2.5">
                  {user ? (
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false)
                        navigate('/dashboard')
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-[#2E9BDA] to-[#165a88] text-white font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
                    >
                      <span>Go to Dashboard</span>
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <Link
                        to="/login"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full flex items-center justify-center py-3 px-4 rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider hover:bg-slate-100 transition-colors text-center shadow-sm"
                      >
                        Log In
                      </Link>
                      <button
                        onClick={() => {
                          setIsMobileMenuOpen(false)
                          navigate('/signup')
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#2E9BDA] to-[#165a88] text-white text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all text-center"
                      >
                        <span>Get Started Free</span>
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO SECTION ────────────────────────────────────────────────────── */}
      <section className="relative z-10 pt-10 pb-12 md:pt-14 md:pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Ambient Gradient Mesh Background Glows (GPU Accelerated) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none -z-10 overflow-hidden transform-gpu">
          <div className="absolute -top-10 left-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-gradient-to-tr from-sky-400/25 via-cyan-300/20 to-blue-500/20 rounded-full blur-2xl md:blur-[110px] animate-pulse" />
          <div className="absolute top-10 right-1/4 w-[280px] sm:w-[450px] h-[280px] sm:h-[450px] bg-gradient-to-br from-indigo-400/25 via-purple-300/20 to-pink-400/20 rounded-full blur-2xl md:blur-[110px]" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[600px] h-[200px] sm:h-[320px] bg-sky-300/30 rounded-full blur-2xl md:blur-[130px]" />
        </div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="text-center max-w-4xl mx-auto space-y-6 relative"
        >
          {/* Announcement Pill */}
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/90 backdrop-blur-xl border border-sky-300/70 shadow-[0_4px_25px_rgba(46,155,218,0.18)] text-xs font-black text-slate-800 hover:border-[#2E9BDA] transition-all cursor-default">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#2E9BDA] text-white shadow-sm">
              <Sparkles size={11} className="animate-spin-slow" />
            </span>
            <span className="tracking-widest uppercase bg-gradient-to-r from-[#2E9BDA] via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              AI Career Co-Pilot 3.0 · Complete Intelligence
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          </motion.div>

          {/* Hero Headline */}
          <motion.h1 
            variants={fadeInUp}
            className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 leading-[1.08]"
          >
            Beat Strict ATS Scanners & <br className="hidden lg:block"/>
            Master Interviews with <br className="hidden lg:block"/>
            <span className="bg-gradient-to-r from-[#2E9BDA] via-indigo-600 to-violet-600 bg-clip-text text-transparent drop-shadow-sm">
              End-to-End Flight Control
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p variants={fadeInUp} className="text-base sm:text-xl text-slate-600 font-medium max-w-3xl mx-auto leading-relaxed">
            The all-in-one suite: Instant ATS resume score optimization, real-time AI mock interview coaching, free developer portfolio builder, and direct recruiter discovery.
          </motion.p>

          {/* Tech Badges Row */}
          <motion.div variants={fadeInUp} className="flex flex-wrap items-center justify-center gap-2.5 pt-2 text-xs text-slate-700 font-extrabold">
            {[
              { name: 'AI Resume Matcher', color: 'text-sky-700 bg-sky-50/90 border-sky-200/80' },
              { name: 'Live AI Interview Coach', color: 'text-indigo-700 bg-indigo-50/90 border-indigo-200/80' },
              { name: 'Free Developer Portfolio', color: 'text-emerald-700 bg-emerald-50/90 border-emerald-200/80' },
              { name: '100% Club Skill Badges', color: 'text-violet-700 bg-violet-50/90 border-violet-200/80' },
              { name: 'Verified Talent Search', color: 'text-amber-700 bg-amber-50/90 border-amber-200/80' },
            ].map((badge) => (
              <span key={badge.name} className={`px-4 py-2 rounded-2xl ${badge.color} border backdrop-blur-md shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-default`}>
                {badge.name}
              </span>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <button
              onClick={() => user ? navigate('/dashboard') : navigate('/signup')}
              className="group w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#2E9BDA] via-[#3B82F6] to-indigo-600 text-white font-extrabold text-sm uppercase tracking-widest shadow-xl shadow-[#2E9BDA]/30 hover:shadow-2xl hover:shadow-[#2E9BDA]/50 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-3 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <Zap size={18} fill="currentColor" className="relative z-10" />
              <span className="relative z-10">{user ? 'Launch Dashboard' : 'Launch CareerShala — Free'}</span>
              <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
            </button>

            <a
              href="#playground"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/90 backdrop-blur-md hover:bg-white text-slate-800 font-extrabold text-sm border border-slate-300 shadow-sm hover:shadow-lg hover:border-[#2E9BDA] transition-all duration-300 flex items-center justify-center gap-2 group"
            >
              <Cpu size={18} className="text-[#2E9BDA] group-hover:rotate-12 transition-transform duration-300" />
              Try Interactive Playground
            </a>
          </motion.div>
        </motion.div>

        {/* ── HERO TELEMETRY INSTRUMENT CLUSTER ──────────────────────────────── */}
        <motion.div
          variants={scaleUp}
          initial="hidden"
          animate="visible"
          id="demo"
          className="mt-10 md:mt-12 max-w-5xl mx-auto rounded-[2.5rem] border border-slate-200/90 bg-white/80 backdrop-blur-2xl shadow-[0_25px_70px_-15px_rgba(46,155,218,0.15)] overflow-hidden relative"
        >
          {/* subtle inside glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent pointer-events-none" />

          {/* Cockpit Header */}
          <div className="relative z-10 bg-slate-50/80 backdrop-blur-md px-5 py-4 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-rose-400 shadow-sm border border-rose-500/20" />
              <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm border border-amber-500/20" />
              <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm border border-emerald-500/20" />
              <span className="text-xs font-mono font-medium text-slate-500 ml-3">telemetry.careershala.tech</span>
            </div>

            {/* Interactive Module Tabs */}
            <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm text-xs font-bold">
              {[
                { id: 'ats', label: '1. ATS Telemetry' },
                { id: 'interview', label: '2. AI Video Coach' },
                { id: 'portfolio', label: '3. Free Portfolio' },
                { id: 'recruiter', label: '4. Recruiter View' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveCockpitTab(tab.id)}
                  className={`px-4 py-2 rounded-lg transition-all duration-300 cursor-pointer ${
                    activeCockpitTab === tab.id 
                      ? 'bg-[#2E9BDA] text-white shadow-md' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Cockpit Content Body */}
          <div className="relative z-10 p-5 sm:p-7 min-h-[260px] bg-white/40">
            <AnimatePresence mode="wait">
              {activeCockpitTab === 'ats' && (
                <motion.div key="ats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <FileText size={22} className="text-[#2E9BDA]" /> Candidate ATS Telemetry
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">Target JD: Senior Full-Stack Engineer @ FinTech</p>
                    </div>
                    <div className="flex items-center gap-3 bg-emerald-50/90 backdrop-blur-sm border border-emerald-200 px-5 py-3 rounded-2xl shadow-sm">
                      <div className="text-3xl font-black text-emerald-600">88%</div>
                      <div className="leading-tight text-xs font-bold text-emerald-800">
                        OPTIMAL MATCH
                        <p className="text-[11px] font-medium text-emerald-600/80 mt-0.5">Passed ATS Screener Audit</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {[
                      { title: 'Semantic Keyword Match', value: '90%', color: 'bg-[#2E9BDA]', sub: 'React, Node, Python, PostgreSQL' },
                      { title: 'Format & Column Safety', value: '100%', color: 'bg-emerald-500', sub: '100% ATS Format Compliant' },
                    ].map(stat => (
                      <div key={stat.title} className="p-5 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow space-y-3">
                        <p className="text-xs font-bold text-slate-700">{stat.title}</p>
                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden shadow-inner">
                          <motion.div initial={{ width: 0 }} animate={{ width: stat.value }} transition={{ duration: 1, delay: 0.2 }} className={`h-full ${stat.color}`} />
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">{stat.sub}</p>
                      </div>
                    ))}
                    <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-sm space-y-3">
                      <p className="text-xs font-bold text-slate-700">Missing High-Impact Terms</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold shadow-sm">Redis</span>
                        <span className="px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold shadow-sm">System Design</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeCockpitTab === 'interview' && (
                <motion.div key="int" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <Video size={22} className="text-indigo-500" /> AI Speech & Vision Coach Telemetry
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">Proctored session: System Design Interview</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-4 py-2.5 rounded-xl shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      LIVE 04:28 / 15:00
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-sm space-y-3">
                      <p className="text-[10px] font-extrabold text-[#2E9BDA] uppercase tracking-widest">AI Question:</p>
                      <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                        &quot;How do you handle data partitioning and replication in a distributed cache?&quot;
                      </p>
                    </div>
                    <div className="p-5 rounded-2xl bg-indigo-50/80 backdrop-blur-md border border-indigo-200/80 shadow-sm space-y-3">
                      <p className="text-[10px] font-extrabold text-indigo-900 uppercase tracking-widest">Live Response Evaluation:</p>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 bg-white/80 p-2 rounded-lg">
                        <span>Pace: 142 WPM (Optimal)</span>
                        <span className="text-emerald-600">Clarity: 94%</span>
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium pt-1">Great structural delivery and vocabulary precision.</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeCockpitTab === 'portfolio' && (
                <motion.div key="port" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-5">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <Globe size={20} className="text-emerald-600" /> Developer Portfolio Live Sync
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">portfolio.careershala.com/rohan-sharma</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black uppercase shadow-sm">
                      100% Free Forever
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">GH</div>
                      <div>
                        <p className="text-xs font-extrabold text-slate-900">GitHub Auto-Sync Active</p>
                        <p className="text-[11px] text-slate-500">12 repositories synced with live star badges</p>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-sm flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#2E9BDA]/10 text-[#2E9BDA] flex items-center justify-center font-bold text-xs">PDF</div>
                      <div>
                        <p className="text-xs font-extrabold text-slate-900">One-Click ATS PDF Embed</p>
                        <p className="text-[11px] text-slate-500">Recruiters can download optimized resume instantly</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeCockpitTab === 'recruiter' && (
                <motion.div key="rec" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-5">
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                        <Briefcase size={20} className="text-[#2E9BDA]" /> Recruiter Shortlist Dashboard
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">Top candidate pool for: Senior Software Engineer</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-[#2E9BDA] text-xs font-bold shadow-sm">
                      AI Talent Ranker Active
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-extrabold text-slate-900">Rohan S. — Full-Stack Architect</p>
                        <p className="text-[11px] text-slate-500">94% Match · 100% Club Verified Badge</p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">Top Shortlist</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="text-xs font-extrabold text-slate-900">Priya M. — Frontend Lead</p>
                        <p className="text-[11px] text-slate-500">89% Match · Verified Certificate ID</p>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-sky-50 text-[#2E9BDA] border border-sky-200 text-xs font-bold">Strong Match</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Terminal Log Ticker Bar */}
          <div className="relative z-10 bg-slate-900/95 backdrop-blur-xl px-5 py-3 text-slate-300 text-[11px] font-mono flex items-center justify-between border-t border-slate-800">
            <div className="flex items-center gap-2.5 truncate">
              <Terminal size={14} className="text-emerald-400 shrink-0" />
              <span className="text-emerald-400 font-bold">sys.log &gt;</span>
              <span className="truncate opacity-80">ATS resume score verified · Live video stream active · Security verified</span>
            </div>
            <span className="text-slate-500 shrink-0 hidden sm:inline">v3.4.0-stable</span>
          </div>
        </motion.div>
      </section>

      {/* ── INTERACTIVE ATS PLAYGROUND WIDGET ─────────────────────────────── */}
      <motion.section 
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeInUp}
        id="playground" className="relative z-10 py-12 md:py-16 bg-white/50 border-y border-slate-200/60 backdrop-blur-2xl"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-50 border border-sky-200/80 text-[#2E9BDA] text-xs font-extrabold uppercase tracking-widest shadow-sm">
              <Cpu size={14} /> Interactive Playground
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Test ATS Keyword Optimization
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              See our AI resume scoring engine in action. Select a role and input your skills to generate simulated telemetry.
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-[2rem] bg-white/90 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/50 space-y-6">
            <form onSubmit={handlePlaygroundSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest pl-1">Target Job Role</label>
                  <select
                    value={playgroundRole}
                    onChange={(e) => setPlaygroundRole(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#2E9BDA]/20 focus:border-[#2E9BDA] transition-all cursor-pointer shadow-sm hover:shadow-md appearance-none"
                  >
                    <option value="Full-Stack Engineer">Full-Stack Engineer</option>
                    <option value="Backend Architect">Backend Architect</option>
                    <option value="Frontend Developer">Frontend Developer</option>
                    <option value="Data Scientist">Data Scientist</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest pl-1">Your Technical Skills</label>
                  <input
                    type="text"
                    value={playgroundSkills}
                    onChange={(e) => setPlaygroundSkills(e.target.value)}
                    placeholder="e.g. React, Python, Docker, Node.js"
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-900 text-sm font-bold placeholder:font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E9BDA]/20 focus:border-[#2E9BDA] transition-all shadow-sm hover:shadow-md"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={analyzingPlayground}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white font-extrabold text-xs uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:shadow-slate-900/40 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-2"
              >
                {analyzingPlayground ? (
                  <><RefreshCw size={16} className="animate-spin text-[#2E9BDA]" /> Analyzing Skills...</>
                ) : (
                  <>Run Analysis Engine <Zap size={16} className="text-[#2E9BDA]" /></>
                )}
              </button>
            </form>

            <AnimatePresence>
              {playgroundResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="overflow-hidden"
                >
                  <div className="p-6 rounded-2xl bg-slate-50/80 border border-slate-200/80 shadow-inner space-y-5 mt-4">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
                      <span className="text-xs font-bold text-slate-500">Analysis Result:</span>
                      <span className="text-xl font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 shadow-sm">{playgroundResult.score}% Match</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                      <div className="space-y-3">
                        <p className="font-extrabold text-emerald-700 flex items-center gap-2 text-xs uppercase tracking-wider">
                          <CheckCircle2 size={16} /> High-Value Matches
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {playgroundResult.matched.map((m) => (
                            <span key={m} className="px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-700 font-bold text-xs shadow-sm">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="font-extrabold text-rose-700 flex items-center gap-2 text-xs uppercase tracking-wider">
                          <XSquare size={16} /> Flagged Missing
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {playgroundResult.missing.map((m) => (
                            <span key={m} className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 font-bold text-xs shadow-sm opacity-90">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.section>

      {/* ── SECTION 1: STRICT ATS RESUME SCANNER ────────────────────────────── */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer} id="ats-suite" className="relative z-10 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 md:space-y-10">
          <motion.div variants={fadeInUp} className="text-center max-w-3xl mx-auto space-y-5">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#2E9BDA]">ATS Optimization Engine</h2>
            <p className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Beat Blind ATS Filters with Semantic AI
            </p>
            <p className="text-slate-500 text-lg font-medium leading-relaxed">
              Generic resumes end up in the void. CareerShala scans JDs, finds vector gaps, and guarantees PDF parsing compliance.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { id: '01', title: 'AI Semantic Matcher', desc: 'Advanced contextual analysis and high-value keyword extraction for maximum ATS match rates.', icon: Layers, color: 'text-[#2E9BDA]', bg: 'bg-[#2E9BDA]/10' },
              { id: '02', title: 'Missing Keyword Detector', desc: 'Instantly flags frameworks and technical specs missing from your resume before you hit apply.', icon: Search, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
              { id: '03', title: 'Format & Layout Guard', desc: 'Ensures clean PDF parsing without invisible column traps that cause ATS screeners to drop you.', icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
            ].map((feature) => (
              <motion.div key={feature.id} variants={fadeInUp} className="group p-6 sm:p-7 rounded-[2rem] bg-white/80 backdrop-blur-lg border border-white shadow-lg hover:shadow-2xl hover:shadow-[#2E9BDA]/10 hover:-translate-y-1.5 transition-all duration-500 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10 space-y-6">
                  <div className={`w-14 h-14 rounded-2xl ${feature.bg} ${feature.color} flex items-center justify-center font-black text-xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-inner`}>
                    <feature.icon size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 mb-3">{feature.title}</h3>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── SECTION 2: EMOTION & SPEECH AI MOCK COACH ───────────────────────── */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeInUp} id="interviews" className="relative z-10 py-12 md:py-16 bg-white/50 border-y border-slate-200/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 text-[10px] font-black uppercase tracking-widest shadow-sm">
                <Video size={14} /> Proctored AI Coach
              </div>
              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                Practice Live Interviews with Instant Telemetry
              </h2>
              <p className="text-slate-500 text-lg font-medium leading-relaxed">
                Stop practicing in the mirror. Our AI interviewer asks role-specific questions, monitors your speech pace, and gives actionable feedback instantly.
              </p>
              <ul className="space-y-4 text-sm font-bold text-slate-700">
                {['Real-time Speech-to-Text & Voice Synthesis', 'Facial posture & integrity monitoring', 'Role-specific technical depth scaling'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 shadow-inner">
                      <CheckCircle2 size={14} className="text-indigo-600" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="pt-4">
                <button
                  onClick={() => user ? navigate('/live-interview') : navigate('/signup')}
                  className="group px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/50 hover:-translate-y-1 transition-all duration-300 inline-flex items-center gap-3"
                >
                  Start Live Session <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Video Coach Preview Box */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-[#2E9BDA] rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-700" />
              <div className="p-6 sm:p-8 rounded-[2.5rem] bg-white/90 backdrop-blur-xl border border-white shadow-xl relative overflow-hidden space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-5">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </span>
                    <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Recording Active</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400">04:28 / 15:00</span>
                </div>
                <div className="p-6 rounded-2xl bg-slate-50/80 shadow-inner border border-slate-200/60 space-y-3">
                  <p className="text-[10px] font-black text-[#2E9BDA] uppercase tracking-widest">AI Interviewer Asks:</p>
                  <p className="text-base font-bold text-slate-800 leading-relaxed">
                    &quot;Walk me through designing a real-time notification engine for 10M active users. Address consistency and latency.&quot;
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-indigo-50/80 border border-indigo-200/60 flex items-center justify-between text-xs font-bold shadow-sm">
                  <span className="text-indigo-900">Speech Pace: 142 WPM</span>
                  <span className="text-emerald-600 bg-white px-3 py-1 rounded-lg shadow-sm">Clarity 94%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── HOW IT WORKS: STEP-BY-STEP WORKFLOW ───────────────────────────── */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer} id="how-it-works" className="relative z-10 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 md:space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-5">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#2E9BDA]">Seamless Flight Plan</h2>
            <p className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Four Steps to Verified Discovery
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {/* Connection Line (Desktop only) */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-slate-200 to-transparent -translate-y-1/2 z-0" />

            {[
              { title: 'Upload & Scan', desc: 'AI Scanner flags missing terms.', color: 'bg-[#2E9BDA]', shadow: 'hover:shadow-[#2E9BDA]/20', border: 'border-[#2E9BDA]' },
              { title: 'AI Interviews', desc: 'Live speech & vision proctored sessions.', color: 'bg-indigo-500', shadow: 'hover:shadow-indigo-500/20', border: 'border-indigo-500' },
              { title: 'Free Portfolio', desc: 'Auto-sync GitHub and launch your site.', color: 'bg-emerald-500', shadow: 'hover:shadow-emerald-500/20', border: 'border-emerald-500' },
              { title: 'Get Discovered', desc: 'Claim your 100% Club badge for recruiters.', color: 'bg-amber-500', shadow: 'hover:shadow-amber-500/20', border: 'border-amber-500' }
            ].map((step, idx) => (
              <motion.div
                key={step.title}
                variants={fadeInUp}
                onClick={() => setActiveStep(idx)}
                className={`group relative z-10 p-6 rounded-3xl backdrop-blur-xl transition-all duration-500 cursor-pointer text-center space-y-4 ${
                  activeStep === idx 
                    ? `bg-white border-2 ${step.border} shadow-xl shadow-slate-200` 
                    : `bg-white/70 border border-white/80 hover:bg-white shadow-lg ${step.shadow} hover:-translate-y-2`
                }`}
              >
                <div className={`w-14 h-14 mx-auto rounded-2xl ${step.color} text-white flex items-center justify-center font-black text-lg shadow-inner group-hover:scale-110 transition-transform duration-500`}>
                  0{idx + 1}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── SECTION 3: FREE DEVELOPER PORTFOLIO BUILDER ─────────────────────── */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeInUp} id="portfolio" className="relative z-10 py-12 md:py-16 bg-white/50 border-y border-slate-200/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            
            {/* Left Preview Box */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-[#2E9BDA] rounded-[2.5rem] blur-2xl opacity-10 group-hover:opacity-30 transition-opacity duration-700" />
              <div className="p-6 sm:p-8 rounded-[2.5rem] bg-white/90 backdrop-blur-xl border border-white shadow-xl relative overflow-hidden space-y-6">
                <div className="flex flex-wrap items-center justify-between border-b border-slate-200/80 pb-5 gap-3">
                  <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">portfolio.careershala.com/yourname</span>
                  <span className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-sm">100% Free Forever</span>
                </div>

                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-white border border-slate-200/80 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black shadow-inner">GH</div>
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">GitHub Projects Sync</p>
                      <p className="text-xs text-slate-500 font-medium">Auto-populates repos, star counts, and language badges</p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-slate-200/80 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-xl bg-[#2E9BDA]/10 text-[#2E9BDA] flex items-center justify-center font-black shadow-inner">ATS</div>
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">ATS Resume Integration</p>
                      <p className="text-xs text-slate-500 font-medium">Embeds optimized PDF resume link with one-click recruiter download</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-widest shadow-sm">
                <Globe size={14} /> Free Portfolio Site
              </div>

              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                Deploy Your Developer Portfolio Site Free
              </h2>

              <p className="text-slate-500 text-lg font-medium leading-relaxed">
                Transform your projects, resume, and skills into a sleek, mobile-responsive developer portfolio website in seconds — 100% free, forever.
              </p>

              <ul className="space-y-4 text-sm font-bold text-slate-700">
                {['One-click GitHub & project sync', 'Instant shareable link (portfolio.careershala.com/yourname)', 'Shareable with recruiters & LinkedIn'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 shadow-inner">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </motion.section>

      {/* ── SECTION 4: 100% CLUB & VERIFIED CERTIFICATES ────────────────────── */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer} id="100-club" className="relative z-10 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 md:space-y-10">
          <motion.div variants={fadeInUp} className="text-center max-w-3xl mx-auto space-y-5">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-widest shadow-sm">
              <Trophy size={14} /> 100% Club Badges
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Unlock Verified 100% Club Certificates
            </h2>
            <p className="text-slate-500 text-lg font-medium">
              Complete proctored AI mock sessions and claim official certificates embedded with digital QR verification codes.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { id: 1, title: 'Score High Precision', desc: 'Complete a proctored AI assessment session in your specialized engineering domain.', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
              { id: 2, title: 'Unlock Verified Badge', desc: 'Claim your official 100% Club skill badge and generate a shareable PDF certificate.', color: 'text-[#2E9BDA]', bg: 'bg-sky-50', border: 'border-sky-200' },
              { id: 3, title: 'Public Verification', desc: 'Recruiters can scan your QR code or search your Certificate ID to verify credentials.', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' }
            ].map((club) => (
              <motion.div key={club.id} variants={fadeInUp} className="group p-6 sm:p-7 rounded-[2rem] bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-lg hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 text-center space-y-5">
                <div className={`w-20 h-20 rounded-2xl ${club.bg} ${club.color} ${club.border} border flex items-center justify-center mx-auto text-3xl font-black shadow-inner group-hover:scale-110 transition-transform duration-500`}>
                  {club.id}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 mb-3">{club.title}</h3>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed">{club.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── SECTION 5: RECRUITER TALENT SUITE ───────────────────────────────── */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeInUp} id="recruiter-portal" className="relative z-10 py-12 md:py-16 bg-white/50 border-y border-slate-200/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#2E9BDA]/10 border border-[#2E9BDA]/30 text-[#2E9BDA] text-[10px] font-black uppercase tracking-widest shadow-sm">
                <Briefcase size={14} /> Recruiter Suite
              </div>

              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                Built for Candidates & Recruiters Alike
              </h2>

              <p className="text-slate-500 text-lg font-medium leading-relaxed">
                Hiring teams can post target JDs, rank candidate resumes instantly with AI scoring, and inspect verified 100% Club skill badges.
              </p>

              <ul className="space-y-4 text-sm font-bold text-slate-700">
                {['JD candidate ranking portal', 'Verified 100% Club talent search pool', 'Priority SLA & direct candidate outreach'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center shrink-0 shadow-inner">
                      <CheckCircle2 size={14} className="text-[#2E9BDA]" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="pt-4">
                <Link
                  to="/recruiter"
                  className="group px-8 py-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-black text-xs uppercase tracking-widest transition-all shadow-lg hover:shadow-xl border border-slate-200 inline-flex items-center gap-3"
                >
                  Access Recruiter Portal <ExternalLink size={16} className="text-slate-400 group-hover:text-[#2E9BDA] transition-colors" />
                </Link>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#2E9BDA] to-indigo-500 rounded-[2.5rem] blur-2xl opacity-10 group-hover:opacity-30 transition-opacity duration-700" />
              <div className="p-6 sm:p-8 rounded-[2.5rem] bg-white/90 backdrop-blur-xl border border-white shadow-xl relative overflow-hidden space-y-5">
                <h3 className="text-xl font-black text-slate-900 border-b border-slate-200/80 pb-5">
                  Recruiter Shortlist Dashboard
                </h3>
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow cursor-default">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">Rohan S. — Full-Stack Engineer</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">94% JD Match · 100% Club Verified</p>
                    </div>
                    <span className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-sm">Top Candidate</span>
                  </div>
                  <div className="p-5 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow cursor-default">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">Priya M. — Frontend Lead</p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">89% JD Match · Verified Certificate</p>
                    </div>
                    <span className="px-4 py-2 rounded-xl bg-sky-50 text-[#2E9BDA] border border-sky-200 text-xs font-bold shadow-sm">Strong Match</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </motion.section>

      {/* ── FEATURE COMPARISON MATRIX TABLE ───────────────────────────────── */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={fadeInUp} id="comparison" className="relative z-10 py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 md:space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-5">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#2E9BDA]">Feature Matrix</h2>
            <p className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Why Engineers Choose CareerShala
            </p>
            <p className="text-slate-500 text-lg font-medium">
              Compare CareerShala against basic resume builders and generic AI chatbots.
            </p>
          </div>

          <div className="overflow-x-auto rounded-[2rem] bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/50">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-900 border-b border-slate-200/80 font-black uppercase tracking-widest text-[11px]">
                <tr>
                  <th className="px-4 py-3.5 sm:px-6 sm:py-4">Platform Feature</th>
                  <th className="px-4 py-3.5 sm:px-6 sm:py-4 bg-sky-50/50 text-[#2E9BDA] border-x border-sky-100">CareerShala AI</th>
                  <th className="px-4 py-3.5 sm:px-6 sm:py-4 text-slate-500">Traditional Builders</th>
                  <th className="px-4 py-3.5 sm:px-6 sm:py-4 text-slate-500">Generic ChatGPT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {COMPARISON_DATA.map((row, idx) => (
                  <tr key={row.feature} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5 sm:px-6 sm:py-4 font-extrabold text-slate-900">{row.feature}</td>
                    <td className="px-4 py-3.5 sm:px-6 sm:py-4 bg-sky-50/30 border-x border-sky-100 font-black text-[#2E9BDA]">
                      {row.us ? (
                        <span className="flex items-center gap-2 text-emerald-600 bg-emerald-50 w-max px-3 py-1 rounded-lg border border-emerald-100 shadow-sm">
                          <CheckSquare size={16} /> Included
                        </span>
                      ) : (
                        row.us
                      )}
                    </td>
                    <td className="px-4 py-3.5 sm:px-6 sm:py-4 text-slate-500 font-medium">
                      {row.traditional === false ? (
                        <span className="flex items-center gap-2 text-slate-400">
                          <XSquare size={16} /> Not Available
                        </span>
                      ) : (
                        row.traditional
                      )}
                    </td>
                    <td className="px-4 py-3.5 sm:px-6 sm:py-4 text-slate-500 font-medium">
                      {row.ChatGPT === false ? (
                        <span className="flex items-center gap-2 text-slate-400">
                          <XSquare size={16} /> Not Available
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs shadow-sm font-bold">
                          {row.ChatGPT}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.section>

      {/* ── SECTION 6: CANDIDATE TESTIMONIALS ────────────────────────────────── */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer} className="relative z-10 py-12 md:py-16 bg-white/50 border-y border-slate-200/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 md:space-y-10">
          <motion.div variants={fadeInUp} className="text-center max-w-3xl mx-auto space-y-5">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#2E9BDA]">Success Stories</h2>
            <p className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Trusted by Engineers Landing Top Roles
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t) => (
              <motion.div
                key={t.name}
                variants={fadeInUp}
                className="group p-6 sm:p-7 rounded-[2rem] bg-white/90 backdrop-blur-xl border border-white shadow-lg hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500 flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex gap-1 text-amber-400">
                    {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                  </div>
                  <p className="text-slate-700 text-sm font-medium leading-relaxed italic">&quot;{t.quote}&quot;</p>
                </div>
                <div className="flex items-center gap-4 pt-6 border-t border-slate-100">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2E9BDA] to-[#165a88] text-white font-black flex items-center justify-center text-sm shadow-md group-hover:scale-110 transition-transform duration-500">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{t.name}</p>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">{t.role} · {t.company}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── PRICING SECTION ─────────────────────────────────────────────────── */}
      <motion.section initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer} id="pricing" className="relative z-10 pt-16 pb-12 md:pt-20 md:pb-16 bg-slate-900 text-white rounded-t-[2.5rem] sm:rounded-t-[3.5rem] mt-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1e3a5f] via-slate-900 to-slate-900 rounded-t-[2.5rem] sm:rounded-t-[3.5rem]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-5">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#2E9BDA]">Simple Pricing</h2>
            <p className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              Invest in Your Career Engine
            </p>

            <div className="flex items-center justify-center gap-4 pt-6">
              <span className={`text-xs font-bold ${!isAnnual ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
              <button
                type="button"
                onClick={() => setIsAnnual(!isAnnual)}
                className="w-16 h-8 rounded-full bg-slate-800 p-1 relative border border-slate-700 transition-colors cursor-pointer focus:outline-none"
              >
                <motion.div animate={{ x: isAnnual ? 32 : 0 }} className="w-6 h-6 rounded-full bg-[#2E9BDA] shadow-[0_0_10px_rgba(46,155,218,0.5)]" />
              </button>
              <span className={`text-xs font-bold flex items-center gap-2 ${isAnnual ? 'text-white' : 'text-slate-500'}`}>
                Annual 
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-black uppercase tracking-widest">20% Off</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Free Starter */}
            <motion.div variants={fadeInUp} className="p-6 sm:p-7 rounded-[2rem] bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between space-y-6 group">
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-black">Starter Free</h3>
                  <p className="text-xs text-slate-400 font-medium mt-2">Try ATS scans & quick practice.</p>
                </div>
                <div className="text-5xl font-black">
                  ₹0 <span className="text-sm font-bold text-slate-500">/ forever</span>
                </div>
                <ul className="space-y-4 text-sm font-medium border-t border-white/10 pt-6">
                  <li className="flex items-center gap-3"><Check size={16} className="text-emerald-400" /> 5 Strict ATS Resume Scans / month</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-emerald-400" /> Free Developer Portfolio Builder</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-emerald-400" /> 1 Live AI Mock Session</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-emerald-400" /> 3 Auto-draft Application Messages</li>
                </ul>
              </div>
              <button
                onClick={() => user ? navigate('/dashboard') : navigate('/signup')}
                className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/20 font-bold text-xs uppercase tracking-widest transition-colors"
              >
                Get Started Free
              </button>
            </motion.div>

            {/* Pro Candidate (Popular) */}
            <motion.div variants={fadeInUp} className="relative p-6 sm:p-7 rounded-[2rem] bg-gradient-to-b from-[#2E9BDA]/20 to-[#4F46E5]/10 border border-[#2E9BDA]/50 backdrop-blur-xl flex flex-col justify-between space-y-6 transform md:-translate-y-2 shadow-[0_0_40px_rgba(46,155,218,0.2)]">
              <div className="absolute -top-4 right-8 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#2E9BDA] to-[#4F46E5] text-white text-[10px] font-black uppercase tracking-widest shadow-lg">
                Most Popular
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-black text-white">Pro Candidate</h3>
                  <p className="text-xs text-slate-300 font-medium mt-2">For serious active job seekers.</p>
                </div>
                <div className="text-5xl font-black text-white">
                  {isAnnual ? '₹399' : '₹499'} <span className="text-sm font-bold text-slate-400">/ mo</span>
                </div>
                <ul className="space-y-4 text-sm font-medium border-t border-white/10 pt-6">
                  <li className="flex items-center gap-3"><Check size={16} className="text-[#2E9BDA]" /> Unlimited ATS Scans & Enhancements</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-[#2E9BDA]" /> Free Portfolio + Custom Domain</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-[#2E9BDA]" /> Unlimited Live AI Interviews</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-[#2E9BDA]" /> Instant Post-Question Tutor Coaching</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-[#2E9BDA]" /> Automated HR Application Agent</li>
                </ul>
              </div>
              <button
                onClick={() => user ? navigate('/billing') : navigate('/signup')}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#2E9BDA] to-[#4F46E5] text-white font-black text-xs uppercase tracking-widest shadow-lg hover:shadow-[0_0_20px_rgba(46,155,218,0.4)] transition-all"
              >
                Upgrade to Pro
              </button>
            </motion.div>

            {/* Recruiter Suite */}
            <motion.div variants={fadeInUp} className="p-6 sm:p-7 rounded-[2rem] bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-black">Recruiter Suite</h3>
                  <p className="text-xs text-slate-400 font-medium mt-2">For teams ranking tech talent.</p>
                </div>
                <div className="text-5xl font-black">
                  {isAnnual ? '₹799' : '₹999'} <span className="text-sm font-bold text-slate-500">/ mo</span>
                </div>
                <ul className="space-y-4 text-sm font-medium border-t border-white/10 pt-6">
                  <li className="flex items-center gap-3"><Check size={16} className="text-emerald-400" /> JD Talent Search Portal</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-emerald-400" /> Instant Candidate JD Ranking</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-emerald-400" /> View Verified 100% Club Badges</li>
                  <li className="flex items-center gap-3"><Check size={16} className="text-emerald-400" /> 24/7 Priority Recruiter SLA</li>
                </ul>
              </div>
              <Link
                to="/recruiter"
                className="w-full py-4 rounded-2xl bg-white text-slate-900 hover:bg-slate-200 font-black text-xs uppercase tracking-widest transition-colors text-center block"
              >
                Recruiter Portal
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ── FAQ SECTION (Light Theme Modern Accordion) ────────────────────────── */}
      <section id="faq" className="relative z-10 py-12 md:py-16 bg-white/50 border-y border-slate-200/60 backdrop-blur-2xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#2E9BDA]">Got Questions?</h2>
            <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Frequently Asked Questions
            </p>
          </div>

          <div className="space-y-4">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 focus:outline-none group"
                  >
                    <span className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-[#2E9BDA] transition-colors">{item.q}</span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 shrink-0 ${isOpen ? 'bg-sky-50 text-[#2E9BDA]' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>
                      <ChevronDown size={18} className={`transition-transform duration-500 ${isOpen ? 'rotate-180 text-[#2E9BDA]' : 'text-slate-400'}`} />
                    </div>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: customEasing }}>
                        <div className="px-6 pb-6 text-sm text-slate-600 font-medium leading-relaxed">
                          {item.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── EXPANDED ENLARGED PROFESSIONAL MEGA-FOOTER ───────────────────────────── */}
      <footer className="relative z-10 bg-slate-950 text-slate-400 pt-20 pb-12 rounded-t-[2.5rem] sm:rounded-t-[3.5rem] mt-6 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          {/* Top Contact & Office Helpline Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 sm:p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#2E9BDA]/15 text-[#2E9BDA] flex items-center justify-center shrink-0 border border-[#2E9BDA]/20 shadow-inner">
                <Mail size={22} />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-300">Email Contact</p>
                <p className="text-sm font-bold text-white mt-0.5">admin@careershala.tech</p>
                <p className="text-[11px] text-slate-500 font-medium">admin@careershala.tech</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-inner">
                <Phone size={22} />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-300">Helpline Phone</p>
                <p className="text-sm font-bold text-white mt-0.5">+91 8279414117</p>
                <p className="text-[11px] text-slate-500 font-medium">Mon-Fri 9:00 AM - 7:00 PM IST</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-inner">
                <MapPin size={22} />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-300">Headquarters</p>
                <p className="text-sm font-bold text-white mt-0.5">HSR Tech Park, Sector 1</p>
                <p className="text-[11px] text-slate-500 font-medium">Bengaluru, Karnataka 560102</p>
              </div>
            </div>
          </div>

          {/* Main 5-Column Navigation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 text-sm">
            
            {/* Column 1: Brand & Social Connect */}
            <div className="space-y-6 lg:col-span-2 pr-0 lg:pr-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-lg p-2">
                  <img src="/logo_t.png" alt="CareerShala" width={44} height={44} decoding="async" loading="lazy" className="w-full h-full object-contain" />
                </div>
                <span className="text-2xl font-black text-white tracking-tight">Career<span className="text-[#2E9BDA]">Shala</span></span>
              </div>
              <p className="leading-relaxed font-medium text-slate-400 text-xs sm:text-sm">
                The premier AI career co-pilot platform. Optimizing resumes against strict ATS screeners, coaching live speech & posture in mock video interviews, generating free GitHub developer portfolios, and connecting verified candidates with top tech recruiters.
              </p>

              {/* Social Media Buttons */}
              <div className="space-y-3">
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-300">Connect With Us</p>
                <div className="flex items-center gap-3">
                  <a href="https://www.linkedin.com/company/careershala-in/" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-[#2E9BDA] text-slate-400 hover:text-white border border-white/10 flex items-center justify-center transition-all shadow-sm">
                    <Linkedin size={18} />
                  </a>
                  <a href="https://github.com" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10 flex items-center justify-center transition-all shadow-sm">
                    <Github size={18} />
                  </a>
                  <a href="https://twitter.com" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-sky-500 text-slate-400 hover:text-white border border-white/10 flex items-center justify-center transition-all shadow-sm">
                    <Twitter size={18} />
                  </a>
                  <a href="#support" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-emerald-500 text-slate-400 hover:text-white border border-white/10 flex items-center justify-center transition-all shadow-sm">
                    <HelpCircle size={18} />
                  </a>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-[11px] uppercase tracking-widest bg-emerald-500/10 px-3.5 py-1.5 rounded-full border border-emerald-500/20 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  Systems 100% Operational
                </div>
                <div className="flex items-center gap-2 text-sky-400 font-extrabold text-[11px] uppercase tracking-widest bg-sky-500/10 px-3.5 py-1.5 rounded-full border border-sky-500/20 shadow-sm">
                  <ShieldCheck size={14} />
                  SOC2 & GDPR Compliant
                </div>
              </div>
            </div>

            {/* Column 2: Candidates Platform */}
            <div className="space-y-5">
              <h4 className="font-black text-white uppercase tracking-widest text-xs flex items-center gap-2">
                <Layers size={14} className="text-[#2E9BDA]" /> Candidate Tools
              </h4>
              <ul className="space-y-3 font-medium text-xs text-slate-400">
                <li><a href="#ats-suite" className="hover:text-white transition-colors flex items-center gap-1.5"><ChevronRight size={12} className="text-[#2E9BDA]" /> ATS Resume Scanner</a></li>
                <li><a href="#interviews" className="hover:text-white transition-colors flex items-center gap-1.5"><ChevronRight size={12} className="text-[#2E9BDA]" /> AI Video Speech Coach</a></li>
                <li><a href="#portfolio" className="text-[#2E9BDA] hover:text-sky-300 transition-colors flex items-center gap-1.5"><ChevronRight size={12} className="text-[#2E9BDA]" /> Free Developer Portfolio</a></li>
                <li><a href="#100-club" className="hover:text-white transition-colors flex items-center gap-1.5"><ChevronRight size={12} className="text-[#2E9BDA]" /> 100% Club Verified Badges</a></li>
                <li><a href="#playground" className="hover:text-white transition-colors flex items-center gap-1.5"><ChevronRight size={12} className="text-[#2E9BDA]" /> Interactive Playground</a></li>
                <li><Link to="/apply-assistant" className="hover:text-white transition-colors flex items-center gap-1.5"><ChevronRight size={12} className="text-[#2E9BDA]" /> Auto Outreach Agent</Link></li>
                <li><Link to="/results" className="hover:text-white transition-colors flex items-center gap-1.5"><ChevronRight size={12} className="text-[#2E9BDA]" /> ATS Analysis Reports</Link></li>
                <li><Link to="/careers" className="text-amber-400 font-extrabold hover:text-amber-300 transition-colors flex items-center gap-1.5"><Flame size={12} className="text-amber-400 animate-pulse fill-amber-400" /> Careers (We're Hiring!)</Link></li>
              </ul>
            </div>

            {/* Column 3: Recruiters & Employers */}
            <div className="space-y-5">
              <h4 className="font-black text-white uppercase tracking-widest text-xs flex items-center gap-2">
                <Briefcase size={14} className="text-indigo-400" /> Recruiter Suite
              </h4>
              <ul className="space-y-3 font-medium text-xs text-slate-400">
                <li><Link to="/recruiter" className="hover:text-white transition-colors flex items-center gap-1.5"><ChevronRight size={12} className="text-indigo-400" /> Talent Shortlist Dashboard</Link></li>
                <li><a href="#comparison" className="hover:text-white transition-colors flex items-center gap-1.5"><ChevronRight size={12} className="text-indigo-400" /> Feature Matrix</a></li>
                <li><Link to="/support" className="hover:text-white transition-colors flex items-center gap-1.5"><ChevronRight size={12} className="text-indigo-400" /> Enterprise Hiring SLA</Link></li>
                <li><Link to="/billing" className="hover:text-white transition-colors flex items-center gap-1.5"><ChevronRight size={12} className="text-indigo-400" /> Recruiter Billing Plans</Link></li>
                <li><a href="#recruiter-portal" className="hover:text-white transition-colors flex items-center gap-1.5"><ChevronRight size={12} className="text-indigo-400" /> JD Candidate Ranker</a></li>
              </ul>
            </div>

            {/* Column 4: Resources & Stay Connected */}
            <div className="space-y-5">
              <h4 className="font-black text-white uppercase tracking-widest text-xs flex items-center gap-2">
                <Send size={14} className="text-emerald-400" /> Stay Informed
              </h4>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Get weekly career telemetry reports, top interview prompts, and recruiter hiring trends directly to your inbox.
              </p>
              <form onSubmit={handleNewsletterSubmit} className="space-y-3">
                <div className="relative">
                  <input
                    type="email" required
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#2E9BDA] focus:ring-1 focus:ring-[#2E9BDA] transition-all shadow-inner"
                  />
                </div>
                <button type="submit" disabled={subscribing} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#3B82F6] hover:from-[#3B82F6] hover:to-indigo-600 text-white font-extrabold text-xs uppercase tracking-widest transition-all shadow-lg hover:shadow-[#2E9BDA]/30 flex items-center justify-center gap-2">
                  {subscribing ? 'Subscribing...' : 'Subscribe Free'} <Send size={13} />
                </button>
              </form>
              <p className="text-[11px] text-slate-500 font-medium">For press & partnerships: admin@careershala.tech</p>
            </div>
          </div>

          {/* Platform Capabilities Banner Row */}
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-400">
            <span className="text-white font-extrabold flex items-center gap-2">
              <Cpu size={16} className="text-[#2E9BDA]" /> Platform Capabilities:
            </span>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
              <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">AI Resume Matcher</span>
              <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">Live Video Coach</span>
              <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">Developer Portfolios</span>
              <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">Verified Skill Badges</span>
              <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">Enterprise Security</span>
              <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">Instant Recruiter Search</span>
            </div>
          </div>

          {/* Bottom Legal & Copyright Bar */}
          <div className="border-t border-slate-800/80 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs font-medium gap-4 text-slate-500">
            <div className="flex items-center gap-3">
              <p>© {new Date().getFullYear()} CareerShala Technologies Pvt. Ltd. All rights reserved.</p>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <a href="#privacy" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#terms" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#security" className="hover:text-white transition-colors">Security & Trust</a>
              <a href="#cookies" className="hover:text-white transition-colors">Cookie Preferences</a>
              <Link to="/support" className="hover:text-white transition-colors text-[#2E9BDA] font-bold">Help & Support</Link>
            </div>
          </div>

        </div>
      </footer>
    </div>
    </MotionConfig>
  );
}