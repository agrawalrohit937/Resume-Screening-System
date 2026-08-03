import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { verifyCertificate } from '../services/certificateApi';

// ── Motion Animation Variants ───────────────────────────────────────────────
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

// ── FAQ Items ─────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'How does CareerShala analyze ATS resume compatibility?',
    a: 'We combine Transformer-based semantic models (BERT) with TF-IDF keyword extraction to calculate deep contextual similarity between your resume and target Job Descriptions, rather than simple keyword matching.',
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
    q: 'How does the Automated Direct Recruiter Outreach Agent work?',
    a: 'Paste a target job description and our agent drafts a tailored cover letter and outreach email, then connects with your authorized account to send your resume directly to hiring recruiters.',
  },
  {
    q: 'Are candidate mock interview sessions private?',
    a: 'Yes. Mock sessions and transcripts are strictly private by default. A 100% Club badge can be made public on the recruiter talent search portal only if you choose to be discovered.',
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
    quote: 'The hybrid BERT + TF-IDF ATS matcher showed me exactly which system design keywords were missing from my resume. Got 3 interview callbacks in one week!',
    company: 'Cloud Corp',
  },
];

export default function CareerPilotLanding() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [isAnnual, setIsAnnual] = useState(true);
  const [certQuery, setCertQuery] = useState('');
  const [certResult, setCertResult] = useState(null);
  const [verifyingCert, setVerifyingCert] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  // Verification Search Handler
  const handleVerifyCert = async (e) => {
    e.preventDefault();
    if (!certQuery.trim()) return;
    setVerifyingCert(true);
    setCertResult(null);

    try {
      const data = await verifyCertificate(certQuery.trim());
      setCertResult({ success: true, data });
      toast.success('Certificate verified valid! 🏆');
    } catch (err) {
      setCertResult({
        success: false,
        error: err.response?.data?.detail || 'Certificate ID not found or invalid.',
      });
      toast.error('Verification failed');
    } finally {
      setVerifyingCert(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-slate-100 font-sans selection:bg-[#2E9BDA] selection:text-white relative overflow-x-hidden">
      
      {/* ── Background Ambient Lighting & Tech Grid ───────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[650px] h-[650px] bg-gradient-to-br from-[#2E9BDA]/20 to-[#6366F1]/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-1/3 -left-40 w-[600px] h-[600px] bg-gradient-to-tr from-[#3B82F6]/15 to-[#8B5CF6]/15 rounded-full blur-[140px] animate-pulse delay-1000" />
        <div className="absolute bottom-10 right-10 w-[550px] h-[550px] bg-gradient-to-t from-[#06B6D4]/15 to-[#2E9BDA]/10 rounded-full blur-[130px]" />
        
        {/* Subtle grid background */}
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.4) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* ── Header Navigation Bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0A0F1D]/85 border-b border-slate-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#2E9BDA] to-[#1d6fa5] flex items-center justify-center shadow-lg shadow-[#2E9BDA]/25 group-hover:scale-105 transition-transform">
              <img src="/logo_t.png" alt="CareerShala Logo" className="w-6 h-6 object-contain" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">
              Career<span className="text-[#2E9BDA]">Shala</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-bold uppercase tracking-wider text-slate-300">
            <a href="#ats-suite" className="hover:text-[#2E9BDA] transition-colors">ATS Scanner</a>
            <a href="#interviews" className="hover:text-[#2E9BDA] transition-colors">AI Interview</a>
            <a href="#portfolio" className="hover:text-[#2E9BDA] transition-colors text-emerald-400">Free Portfolio</a>
            <a href="#100-club" className="hover:text-[#2E9BDA] transition-colors">100% Club</a>
            <a href="#recruiter-portal" className="hover:text-[#2E9BDA] transition-colors">For Recruiters</a>
            <a href="#pricing" className="hover:text-[#2E9BDA] transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-[#2E9BDA] transition-colors">FAQ</a>
          </nav>

          {/* Auth Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-[#2E9BDA]/25 hover:shadow-lg hover:shadow-[#2E9BDA]/40 hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                Go to Dashboard
                <ArrowRight size={15} />
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-colors"
                >
                  Log In
                </Link>
                <button
                  onClick={() => navigate('/signup')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-[#2E9BDA]/25 hover:shadow-lg hover:shadow-[#2E9BDA]/40 hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  Get Started Free
                  <ArrowRight size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ────────────────────────────────────────────────────── */}
      <section className="relative z-10 pt-16 pb-20 md:pt-24 md:pb-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="text-center max-w-4xl mx-auto space-y-8"
        >
          {/* Announcement Pill */}
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-800/80 border border-[#2E9BDA]/40 backdrop-blur-md shadow-inner text-xs font-bold text-[#2E9BDA]">
            <Sparkles size={14} className="text-[#2E9BDA] animate-pulse" />
            <span>AI CAREER COPILOT 3.0 — FLIGHT DECK ACTIVE</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E9BDA] animate-ping" />
          </motion.div>

          {/* Hero Headline */}
          <motion.h1 
            variants={fadeInUp}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]"
          >
            Beat ATS Algorithms &amp; Master Real Interviews with{' '}
            <span className="bg-gradient-to-r from-[#2E9BDA] via-[#6366F1] to-[#EC4899] bg-clip-text text-transparent">
              AI Career Intelligence
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p variants={fadeInUp} className="text-base sm:text-xl text-slate-300 font-medium max-w-3xl mx-auto leading-relaxed">
            We tune your resume to beat strict ATS scanners, coach your speech &amp; confidence in live mock interviews, build your developer portfolio for free, and dispatch direct recruiter outreach.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={() => user ? navigate('/dashboard') : navigate('/signup')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#2E9BDA] via-[#3B82F6] to-[#6366F1] text-white font-extrabold text-sm uppercase tracking-wider shadow-xl shadow-[#2E9BDA]/30 hover:shadow-[#2E9BDA]/50 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <Zap size={18} fill="currentColor" />
              {user ? 'Launch Dashboard' : 'Launch CareerShala — Free'}
              <ArrowRight size={18} />
            </button>

            <a
              href="#demo"
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-bold text-sm border border-slate-700/80 hover:border-slate-600 transition-all flex items-center justify-center gap-2"
            >
              <Video size={18} className="text-[#2E9BDA]" />
              Explore Instrument Cluster
            </a>
          </motion.div>

          {/* Stats Bar */}
          <motion.div variants={fadeInUp} className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <p className="text-2xl sm:text-3xl font-black text-white">98.4%</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-1">ATS Match Accuracy</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <p className="text-2xl sm:text-3xl font-black text-emerald-400">Free</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-1">Portfolio Builder</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <p className="text-2xl sm:text-3xl font-black text-[#2E9BDA]">Direct</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-1">Recruiter Outreach</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <p className="text-2xl sm:text-3xl font-black text-amber-400">Verified</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-1">100% Skill Badges</p>
            </div>
          </motion.div>
        </motion.div>

        {/* ── HERO TELEMETRY INSTRUMENT CLUSTER ───────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          id="demo"
          className="mt-16 sm:mt-20 max-w-5xl mx-auto rounded-3xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(46,155,218,0.25)] overflow-hidden"
        >
          {/* Mock Cockpit Window Header */}
          <div className="h-12 bg-slate-950 px-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono">
              <Lock size={12} className="text-emerald-400" />
              <span>telemetry.careershala.tech/cockpit</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#2E9BDA]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Telemetry
            </div>
          </div>

          {/* Telemetry Dashboard Grid */}
          <div className="p-6 sm:p-10 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <h3 className="text-xl font-extrabold text-white">Live Candidate Instrument Cluster</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Real-time candidate evaluation telemetry and flight status</p>
              </div>

              <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/30 px-5 py-3 rounded-2xl">
                <div className="text-3xl font-black text-emerald-400">88%</div>
                <div className="leading-tight">
                  <p className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest">ATS Match Score</p>
                  <p className="text-[11px] font-semibold text-slate-400">Optimal Target Match</p>
                </div>
              </div>
            </div>

            {/* Instrument Dials */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300 flex items-center gap-2"><BarChart3 size={16} className="text-[#2E9BDA]" /> Speech Pace Telemetry</span>
                  <span className="text-[#2E9BDA] font-mono font-bold">142 wpm</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-[#2E9BDA] rounded-full w-[85%]" />
                </div>
                <p className="text-[11px] text-slate-400">Optimal pace range for tech interviews</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300 flex items-center gap-2"><Trophy size={16} className="text-amber-400" /> 100% Club Badge</span>
                  <span className="text-amber-400 font-mono font-bold">UNLOCKED</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full w-[100%]" />
                </div>
                <p className="text-[11px] text-slate-400">Verified by proctored AI evaluation</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300 flex items-center gap-2"><Globe size={16} className="text-emerald-400" /> Portfolio Site</span>
                  <span className="text-emerald-400 font-mono font-bold">LIVE</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full w-[100%]" />
                </div>
                <p className="text-[11px] text-slate-400">portfolio.careershala.com/rohan</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── SECTION 1: STRICT ATS RESUME SCANNER ────────────────────────────── */}
      <section id="ats-suite" className="relative z-10 py-24 bg-slate-950/70 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#2E9BDA]">Strict ATS Resume Scanner</h2>
            <p className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Beat Blind ATS Filters with Semantic Matching
            </p>
            <p className="text-slate-400 text-base font-medium">
              Don&apos;t send the same generic resume to every employer. CareerShala scans target JDs, identifies missing keywords, and optimizes bullet points.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-[#2E9BDA]/50 transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#2E9BDA]/20 text-[#2E9BDA] flex items-center justify-center font-bold">01</div>
              <h3 className="text-xl font-extrabold text-white">Hybrid BERT + TF-IDF</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Uses Transformer-based semantic vectors alongside TF-IDF keyword extraction to calculate deep contextual similarity scores.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-[#2E9BDA]/50 transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">02</div>
              <h3 className="text-xl font-extrabold text-white">Missing Keyword Detector</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Instantly flags hard skills, frameworks, and technical qualifications missing from your resume before you apply.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-[#2E9BDA]/50 transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">03</div>
              <h3 className="text-xl font-extrabold text-white">Format &amp; Layout Guard</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Ensures clean PDF parsing without unreadable column traps or broken font encoding that causes ATS screeners to drop applications.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: EMOTION & SPEECH AI MOCK COACH ───────────────────────── */}
      <section id="interviews" className="relative z-10 py-24 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-extrabold uppercase tracking-widest">
                <Video size={14} /> AI Speech &amp; Vision Coach
              </div>

              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Practice Live Interviews with Real-Time Feedback
              </h2>

              <p className="text-slate-300 text-base leading-relaxed">
                Master technical &amp; behavioral interviews. Our AI interviewer asks questions, monitors speech pace and delivery, and provides post-question coaching.
              </p>

              <ul className="space-y-4 text-sm font-semibold text-slate-300">
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-[#2E9BDA]" /> Real-time Speech-to-Text &amp; Voice Synthesis
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-[#2E9BDA]" /> Facial posture &amp; integrity monitoring
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-[#2E9BDA]" /> Role-specific technical questions (React, Python, System Design)
                </li>
              </ul>

              <div className="pt-2">
                <button
                  onClick={() => user ? navigate('/live-interview') : navigate('/signup')}
                  className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  Start Live Session <ArrowRight size={15} />
                </button>
              </div>
            </div>

            {/* Video Coach Preview Box */}
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Session Active</span>
                </div>
                <span className="text-xs font-mono text-slate-400">04:28 / 15:00</span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <p className="text-xs font-extrabold text-[#2E9BDA] uppercase tracking-wider">AI Interviewer Asks:</p>
                <p className="text-sm font-semibold text-slate-200">
                  &quot;Walk me through designing a real-time notification engine for 10M active users. Address consistency and latency.&quot;
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between text-xs">
                <span className="font-bold text-indigo-300">Speech Pace: 142 WPM (Optimal)</span>
                <span className="text-emerald-400 font-black">Clarity 94%</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 3: FREE DEVELOPER PORTFOLIO BUILDER ─────────────────────── */}
      <section id="portfolio" className="relative z-10 py-24 bg-slate-950/80 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Preview Box */}
            <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-xs font-mono text-emerald-400 font-bold">portfolio.careershala.com/yourname</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">100% Free Forever</span>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">GH</div>
                  <div>
                    <p className="text-xs font-extrabold text-white">GitHub Projects Sync</p>
                    <p className="text-[11px] text-slate-400">Auto-populates repos, star counts, and language badges</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#2E9BDA]/20 text-[#2E9BDA] flex items-center justify-center font-bold">ATS</div>
                  <div>
                    <p className="text-xs font-extrabold text-white">ATS Resume Integration</p>
                    <p className="text-[11px] text-slate-400">Embeds optimized PDF resume link with one-click recruiter download</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold uppercase tracking-widest">
                <Globe size={14} /> Free Portfolio Site
              </div>

              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Deploy Your Developer Portfolio Site Free
              </h2>

              <p className="text-slate-300 text-base leading-relaxed">
                Transform your projects, resume, and skills into a sleek, mobile-responsive developer portfolio website in seconds — 100% free, forever.
              </p>

              <ul className="space-y-4 text-sm font-semibold text-slate-300">
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-emerald-400" /> One-click GitHub &amp; project sync
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-emerald-400" /> Instant shareable link (portfolio.careershala.com/yourname)
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-emerald-400" /> Shareable with recruiters &amp; LinkedIn
                </li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 4: 100% CLUB & VERIFIED CERTIFICATES ────────────────────── */}
      <section id="100-club" className="relative z-10 py-24 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold uppercase tracking-widest">
              <Trophy size={14} /> 100% Club Badges
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Unlock Verified 100% Club Certificates
            </h2>
            <p className="text-slate-400 text-base font-medium">
              Complete proctored AI mock sessions and claim official certificates embedded with digital QR verification codes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto text-2xl font-black">1</div>
              <h3 className="text-lg font-extrabold text-white">Score High Precision</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Complete a proctored AI assessment session in your specialized engineering domain.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#2E9BDA]/20 text-[#2E9BDA] border border-[#2E9BDA]/40 flex items-center justify-center mx-auto text-2xl font-black">2</div>
              <h3 className="text-lg font-extrabold text-white">Unlock Verified Badge</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Claim your official 100% Club skill badge and generate a shareable PDF certificate.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto text-2xl font-black">3</div>
              <h3 className="text-lg font-extrabold text-white">Public Verification</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Recruiters can scan your QR code or search your Certificate ID to verify credentials on the spot.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: RECRUITER TALENT SUITE ───────────────────────────────── */}
      <section id="recruiter-portal" className="relative z-10 py-24 bg-slate-950/80 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#2E9BDA]/10 border border-[#2E9BDA]/30 text-[#2E9BDA] text-xs font-extrabold uppercase tracking-widest">
                <Briefcase size={14} /> Recruiter Suite
              </div>

              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Built for Candidates &amp; Recruiters Alike
              </h2>

              <p className="text-slate-300 text-base leading-relaxed">
                Hiring teams can post target JDs, rank candidate resumes instantly with hybrid NLP scoring, and inspect verified 100% Club skill badges.
              </p>

              <ul className="space-y-4 text-sm font-semibold text-slate-300">
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-[#2E9BDA]" /> JD candidate ranking portal
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-[#2E9BDA]" /> Verified 100% Club talent search pool
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-[#2E9BDA]" /> Priority SLA &amp; direct candidate outreach
                </li>
              </ul>

              <div className="pt-2">
                <Link
                  to="/recruiter"
                  className="px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-2 border border-slate-700"
                >
                  Access Recruiter Portal <ExternalLink size={14} />
                </Link>
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
              <h3 className="text-lg font-extrabold text-white border-b border-slate-800 pb-4">
                Recruiter Shortlist Dashboard
              </h3>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-extrabold text-white">Rohan S. — Full-Stack Engineer</p>
                    <p className="text-[11px] text-slate-400">94% JD Match · 100% Club Verified</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">Top Candidate</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-extrabold text-white">Priya M. — Frontend Lead</p>
                    <p className="text-[11px] text-slate-400">89% JD Match · Verified Certificate</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#2E9BDA]/20 text-[#2E9BDA] text-xs font-bold">Strong Match</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 6: CANDIDATE TESTIMONIALS ────────────────────────────────── */}
      <section className="relative z-10 py-24 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#2E9BDA]">Success Stories</h2>
            <p className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Trusted by Engineers Landing Top Roles
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-6"
              >
                <p className="text-slate-300 text-sm leading-relaxed italic">&quot;{t.quote}&quot;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2E9BDA] to-[#1d6fa5] text-white font-extrabold flex items-center justify-center text-xs">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-white">{t.name}</p>
                    <p className="text-[11px] text-slate-400">{t.role} · {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INSTANT CERTIFICATE VERIFIER WIDGET ──────────────────────────────── */}
      <section id="verify" className="relative z-10 py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#2E9BDA]/10 rounded-full blur-3xl" />

          <div className="relative z-10 space-y-6 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold uppercase tracking-widest">
              <Award size={14} /> Tamper-Proof Verification
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Verify Any CareerShala Certificate
            </h2>

            <p className="text-slate-400 text-sm font-medium leading-relaxed">
              Employers, hiring managers, and recruiters can enter any official CareerShala Certificate ID below to verify its authenticity in real time.
            </p>

            <form onSubmit={handleVerifyCert} className="flex flex-col sm:flex-row gap-3 pt-2">
              <input
                type="text"
                value={certQuery}
                onChange={(e) => setCertQuery(e.target.value)}
                placeholder="e.g. CERT-PY-88219"
                className="flex-1 px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#2E9BDA] transition-colors"
              />
              <button
                type="submit"
                disabled={verifyingCert}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-[#2E9BDA]/25 hover:shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                {verifyingCert ? 'Verifying...' : 'Verify Now'}
                <Search size={16} />
              </button>
            </form>

            {/* Result Display */}
            {certResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl border text-sm font-medium ${
                  certResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                }`}
              >
                {certResult.success ? (
                  <div className="space-y-1">
                    <p className="font-extrabold text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 size={16} /> Official Certificate Verified Valid
                    </p>
                    <p className="text-xs text-slate-300">
                      Issuer: CareerShala · Issued to candidate with verified ID: {certQuery}
                    </p>
                  </div>
                ) : (
                  <p>{certResult.error}</p>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </section>

      {/* ── PRICING SECTION ─────────────────────────────────────────────────── */}
      <section id="pricing" className="relative z-10 py-24 bg-slate-950/80 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#2E9BDA]">Simple Transparent Pricing</h2>
            <p className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Invest in Your Next Career Move
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <span className={`text-xs font-bold ${!isAnnual ? 'text-white' : 'text-slate-400'}`}>Monthly</span>
              <button
                type="button"
                onClick={() => setIsAnnual(!isAnnual)}
                className="w-14 h-8 rounded-full bg-slate-800 p-1 relative border border-slate-700 transition-colors cursor-pointer"
              >
                <motion.div
                  animate={{ x: isAnnual ? 24 : 0 }}
                  className="w-6 h-6 rounded-full bg-[#2E9BDA] shadow-md"
                />
              </button>
              <span className={`text-xs font-bold flex items-center gap-1.5 ${isAnnual ? 'text-white' : 'text-slate-400'}`}>
                Annual Billing
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">20% Off</span>
              </span>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Free Starter */}
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-extrabold text-white">Starter Free</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">Perfect for trying ATS scans &amp; quick practice.</p>
                </div>
                <div className="text-4xl font-black text-white">
                  ₹0 <span className="text-xs font-semibold text-slate-400">/ forever</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300 font-medium border-t border-slate-800 pt-6">
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> 5 Strict ATS Resume Scans / month</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> Free Developer Portfolio Builder</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> 1 Live AI Mock Session</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> 3 Auto-draft Application Messages</li>
                </ul>
              </div>
              <button
                onClick={() => user ? navigate('/dashboard') : navigate('/signup')}
                className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Get Started Free
              </button>
            </div>

            {/* Pro Candidate (Popular) */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-[#2E9BDA] shadow-[0_15px_40px_-15px_rgba(46,155,218,0.3)] flex flex-col justify-between space-y-8 relative">
              <div className="absolute -top-3.5 right-8 px-3.5 py-1 rounded-full bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white text-[10px] font-black uppercase tracking-widest shadow-md">
                Most Popular
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-extrabold text-white">Pro Candidate</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">For active job seekers preparing for interviews.</p>
                </div>
                <div className="text-4xl font-black text-white">
                  {isAnnual ? '₹399' : '₹499'} <span className="text-xs font-semibold text-slate-400">/ month</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-200 font-medium border-t border-slate-800 pt-6">
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> Unlimited ATS Scans &amp; Enhancements</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> Free Portfolio + Custom Domain</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> Unlimited Live AI Interviews</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> Instant Post-Question Tutor Coaching</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> Automated HR Application Agent</li>
                </ul>
              </div>
              <button
                onClick={() => user ? navigate('/billing') : navigate('/signup')}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-[#2E9BDA]/25 hover:shadow-lg transition-all cursor-pointer"
              >
                Upgrade to Pro
              </button>
            </div>

            {/* Recruiter Suite */}
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-extrabold text-white">Recruiter Suite</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">For hiring teams searching &amp; ranking tech talent.</p>
                </div>
                <div className="text-4xl font-black text-white">
                  {isAnnual ? '₹799' : '₹999'} <span className="text-xs font-semibold text-slate-400">/ month</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300 font-medium border-t border-slate-800 pt-6">
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> JD Talent Search Portal</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> Instant Candidate JD Ranking</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> View Verified 100% Club Badges</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> 24/7 Priority Recruiter SLA</li>
                </ul>
              </div>
              <Link
                to="/recruiter"
                className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-colors text-center block cursor-pointer"
              >
                Recruiter Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ SECTION ────────────────────────────────────────────────────── */}
      <section id="faq" className="relative z-10 py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#2E9BDA]">Got Questions?</h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Frequently Asked Questions
          </p>
        </div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={item.q}
                className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 text-white font-bold text-sm sm:text-base focus:outline-none cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    size={18}
                    className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#2E9BDA]' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="px-6 pb-6 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-slate-800/60 pt-4"
                    >
                      {item.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 bg-slate-950 border-t border-slate-800/80 pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 text-xs text-slate-400">
            {/* Brand */}
            <div className="space-y-4 md:col-span-1">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2E9BDA] to-[#1d6fa5] flex items-center justify-center shadow-md">
                  <img src="/logo_t.png" alt="CareerShala" className="w-5 h-5 object-contain" />
                </div>
                <span className="text-lg font-extrabold text-white">Career<span className="text-[#2E9BDA]">Shala</span></span>
              </div>
              <p className="leading-relaxed">
                The AI career co-pilot. Strict ATS resume engineering, vision-proctored mock interviews, and automated HR application dispatch — built for engineers.
              </p>
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                All CareerShala systems operational
              </div>
            </div>

            {/* Candidate Suite */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-white uppercase tracking-widest text-[11px]">Candidate Suite</h4>
              <ul className="space-y-2">
                <li><a href="#ats-suite" className="hover:text-white transition-colors">Strict ATS Scanner</a></li>
                <li><a href="#interviews" className="hover:text-white transition-colors">Speech &amp; Confidence Coach</a></li>
                <li><a href="#portfolio" className="hover:text-emerald-400 transition-colors font-bold text-emerald-400">Free Portfolio Builder</a></li>
                <li><a href="#100-club" className="hover:text-white transition-colors">100% Verified Certificates</a></li>
                <li><Link to="/apply-assistant" className="hover:text-white transition-colors">AI HR Application Agent</Link></li>
              </ul>
            </div>

            {/* Recruiter Suite */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-white uppercase tracking-widest text-[11px]">For Recruiters</h4>
              <ul className="space-y-2">
                <li><Link to="/recruiter" className="hover:text-white transition-colors">Talent Search Portal</Link></li>
                <li><Link to="/recruiter" className="hover:text-white transition-colors">JD Candidate Matching</Link></li>
                <li><a href="#verify" className="hover:text-white transition-colors">Verify Skill Badges</a></li>
                <li><Link to="/support" className="hover:text-white transition-colors">Enterprise Partner SLA</Link></li>
              </ul>
            </div>

            {/* Newsletter */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-white uppercase tracking-widest text-[11px]">Stay Ahead</h4>
              <p className="leading-relaxed">Tips on beating ATS algorithms &amp; remote technical interviews.</p>
              <form onSubmit={handleNewsletterSubmit} className="space-y-2 pt-1">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter email..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-[#2E9BDA]"
                />
                <button
                  type="submit"
                  disabled={subscribing}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  {subscribing ? 'Subscribing...' : 'Subscribe Free'}
                </button>
              </form>
            </div>
          </div>

          <div className="border-t border-slate-800/60 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© {new Date().getFullYear()} CareerShala. Your AI career co-pilot &amp; smart job outreach suite.</p>
            <div className="flex gap-6">
              <a href="#privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
              <a href="#terms" className="hover:text-slate-400 transition-colors">Terms of Service</a>
              <a href="#security" className="hover:text-slate-400 transition-colors">Security &amp; Trust</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}