import React, { useState, useEffect } from 'react';
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
  Flame,
  Check,
  ExternalLink,
  Layers,
  Bot,
  BarChart3,
  Cpu,
  Lock,
  Globe,
  Users,
  Send,
  HelpCircle,
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

const hoverCard = {
  hover: {
    y: -8,
    scale: 1.02,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
};

// ── FAQ Items ─────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'How does CareerShala analyze ATS resume compatibility?',
    a: 'We combine Transformer-based semantic models (BERT) with TF-IDF keyword extraction to calculate deep contextual similarity between your resume and target Job Descriptions, rather than simple keyword matching.',
  },
  {
    q: 'How does the Live AI Interview practice work?',
    a: 'Our Live Interviewer uses real-time WebRTC audio processing and computer vision to assess speech pace, vocabulary precision, and delivery confidence, providing actionable feedback after every answer.',
  },
  {
    q: 'Are certificates issued by CareerShala verifiable?',
    a: 'Yes! Every certificate issued generates a tamper-proof digital ID with a unique verification link and QR code, allowing recruiters and employers to verify your skill badge instantly.',
  },
  {
    q: 'Can I upload resumes in DOCX or PDF format?',
    a: 'Yes, CareerShala supports standard PDF, DOCX, and text resume formats with high-fidelity formatting preservation.',
  },
];

export default function CareerPilotLanding() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [activeTab, setActiveTab] = useState('ats');
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
      toast.success('Certificate verified successfully! 🏆');
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
      
      {/* ── Background ambient glowing orbs ─────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-gradient-to-br from-[#2E9BDA]/20 to-[#6366F1]/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-1/3 -left-40 w-[550px] h-[550px] bg-gradient-to-tr from-[#3B82F6]/15 to-[#8B5CF6]/15 rounded-full blur-[140px] animate-pulse delay-1000" />
        <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-gradient-to-t from-[#06B6D4]/15 to-[#2E9BDA]/10 rounded-full blur-[130px]" />
        
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
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0A0F1D]/80 border-b border-slate-800/80 transition-all">
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
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#features" className="hover:text-[#2E9BDA] transition-colors">Features</a>
            <a href="#demo" className="hover:text-[#2E9BDA] transition-colors">Live Preview</a>
            <a href="#pricing" className="hover:text-[#2E9BDA] transition-colors">Pricing</a>
            <a href="#verify" className="hover:text-[#2E9BDA] transition-colors">Verify Certificate</a>
            <a href="#faq" className="hover:text-[#2E9BDA] transition-colors">FAQ</a>
          </nav>

          {/* Auth Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white font-bold text-sm shadow-md shadow-[#2E9BDA]/25 hover:shadow-lg hover:shadow-[#2E9BDA]/40 hover:-translate-y-0.5 transition-all"
              >
                Go to Dashboard
                <ArrowRight size={16} />
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2.5 text-sm font-bold text-slate-300 hover:text-white transition-colors"
                >
                  Log In
                </Link>
                <button
                  onClick={() => navigate('/signup')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white font-bold text-sm shadow-md shadow-[#2E9BDA]/25 hover:shadow-lg hover:shadow-[#2E9BDA]/40 hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  Get Started Free
                  <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ────────────────────────────────────────────────────── */}
      <section className="relative z-10 pt-16 pb-24 md:pt-24 md:pb-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="text-center max-w-4xl mx-auto space-y-8"
        >
          {/* Announcement Pill */}
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/80 border border-[#2E9BDA]/40 backdrop-blur-md shadow-inner text-xs font-bold text-[#2E9BDA]">
            <Sparkles size={14} className="text-[#2E9BDA] animate-pulse" />
            <span>AI CAREER COPILOT 3.0 IS LIVE</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#2E9BDA] animate-ping" />
          </motion.div>

          {/* Main Title */}
          <motion.h1 
            variants={fadeInUp}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]"
          >
            Supercharge Your Job Search with{' '}
            <span className="bg-gradient-to-r from-[#2E9BDA] via-[#6366F1] to-[#EC4899] bg-clip-text text-transparent">
              AI Career Intelligence
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p variants={fadeInUp} className="text-lg sm:text-xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            Score ATS resume compatibility with deep Transformer semantic AI, practice live video interviews with AI speech analysis, and earn verified skill certificates.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={() => user ? navigate('/dashboard') : navigate('/signup')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#2E9BDA] via-[#3B82F6] to-[#6366F1] text-white font-extrabold text-base shadow-xl shadow-[#2E9BDA]/30 hover:shadow-[#2E9BDA]/50 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <Zap size={18} fill="currentColor" />
              {user ? 'Launch Dashboard' : 'Start Free Trial — No Credit Card'}
              <ArrowRight size={18} />
            </button>

            <a
              href="#demo"
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-bold text-base border border-slate-700/80 hover:border-slate-600 transition-all flex items-center justify-center gap-2"
            >
              <Video size={18} className="text-[#2E9BDA]" />
              Explore Interactive Preview
            </a>
          </motion.div>

          {/* Key Metric Chips */}
          <motion.div variants={fadeInUp} className="pt-8 flex flex-wrap items-center justify-center gap-6 text-slate-400 text-xs sm:text-sm font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>98.4% ATS Parsing Accuracy</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>10k+ Mock Interviews</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Verified Digital Certificates</span>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Interactive Live ATS & AI Preview Demo Window ───────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          id="demo"
          className="mt-16 sm:mt-20 max-w-5xl mx-auto rounded-3xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(46,155,218,0.25)] overflow-hidden"
        >
          {/* Mock Browser Titlebar */}
          <div className="h-12 bg-slate-950/80 px-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono">
              <Lock size={12} className="text-emerald-400" />
              <span>careershala.tech/live-analysis</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#2E9BDA]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Simulation
            </div>
          </div>

          {/* Interactive Demo Content */}
          <div className="p-6 sm:p-10 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <h3 className="text-xl font-extrabold text-white">Senior Full-Stack Engineer Match Analysis</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Hybrid BERT Transformer + TF-IDF Semantic Match Engine</p>
              </div>

              {/* Match Score Badge */}
              <div className="flex items-center gap-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 px-5 py-3 rounded-2xl">
                <div className="text-3xl font-black text-emerald-400">88%</div>
                <div className="leading-tight">
                  <p className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest">ATS Match Score</p>
                  <p className="text-[11px] font-semibold text-slate-400">High Match Potential</p>
                </div>
              </div>
            </div>

            {/* Keyword Matches Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">Python & Backend</span>
                  <span className="text-emerald-400 font-black">95%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full w-[95%]" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">System Architecture</span>
                  <span className="text-[#2E9BDA] font-black">90%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-[#2E9BDA] rounded-full w-[90%]" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">Cloud Infrastructure</span>
                  <span className="text-indigo-400 font-black">82%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full w-[82%]" />
                </div>
              </div>
            </div>

            {/* AI Recommendation Banner */}
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-4 text-xs font-medium text-indigo-200">
              <Bot size={20} className="text-[#2E9BDA] shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-white block mb-0.5">AI Copilot Recommendation:</span>
                Add metrics for microservices scalability (e.g., &quot;handled 10M requests/day&quot;) to boost score by +7%.
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── CORE FEATURES GRID ─────────────────────────────────────────────── */}
      <section id="features" className="relative z-10 py-24 bg-slate-950/60 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#2E9BDA]">Comprehensive Career Suite</h2>
            <p className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Everything You Need to Win High-Paying Roles
            </p>
            <p className="text-slate-400 text-base font-medium">
              Engineered with advanced NLP, video analysis, and verifiable skill certification.
            </p>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {/* Feature 1 */}
            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -6, scale: 1.015 }}
              className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-[#2E9BDA]/50 transition-all shadow-xl group relative overflow-hidden"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2E9BDA]/20 to-blue-600/20 border border-[#2E9BDA]/40 flex items-center justify-center text-[#2E9BDA] mb-6 group-hover:scale-110 transition-transform">
                <FileText size={26} strokeWidth={2.2} />
              </div>
              <h3 className="text-xl font-extrabold text-white mb-3">Hybrid ATS Resume Matcher</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                Uses BERT semantic embeddings + TF-IDF to compare your resume against target Job Descriptions with line-by-line feedback.
              </p>
              <Link to="/results" className="inline-flex items-center gap-2 text-xs font-bold text-[#2E9BDA] hover:text-white transition-colors">
                Try ATS Matcher <ChevronRight size={14} />
              </Link>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -6, scale: 1.015 }}
              className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-[#2E9BDA]/50 transition-all shadow-xl group relative overflow-hidden"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                <Video size={26} strokeWidth={2.2} />
              </div>
              <h3 className="text-xl font-extrabold text-white mb-3">Live AI Video Interviewer</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                Practice technical & behavioral questions in real-time with an AI interviewer, camera integrity verification, and speech evaluation.
              </p>
              <Link to="/live-interview" className="inline-flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-white transition-colors">
                Start Mock Session <ChevronRight size={14} />
              </Link>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -6, scale: 1.015 }}
              className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-[#2E9BDA]/50 transition-all shadow-xl group relative overflow-hidden"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                <Trophy size={26} strokeWidth={2.2} />
              </div>
              <h3 className="text-xl font-extrabold text-white mb-3">Rewards & Skill Badges</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                Earn XP, maintain daily check-in streaks, level up your developer rank, and unlock exclusive 100% Club skill badges.
              </p>
              <Link to="/gamification" className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-white transition-colors">
                View Rewards Hub <ChevronRight size={14} />
              </Link>
            </motion.div>

            {/* Feature 4 */}
            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -6, scale: 1.015 }}
              className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-[#2E9BDA]/50 transition-all shadow-xl group relative overflow-hidden"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                <Award size={26} strokeWidth={2.2} />
              </div>
              <h3 className="text-xl font-extrabold text-white mb-3">Verified Digital Certificates</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                Generate official, tamper-proof digital certificates complete with unique IDs and QR codes shareable on LinkedIn and portfolios.
              </p>
              <a href="#verify" className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-white transition-colors">
                Verify Sample Cert <ChevronRight size={14} />
              </a>
            </motion.div>

            {/* Feature 5 */}
            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -6, scale: 1.015 }}
              className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-[#2E9BDA]/50 transition-all shadow-xl group relative overflow-hidden"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck size={26} strokeWidth={2.2} />
              </div>
              <h3 className="text-xl font-extrabold text-white mb-3">7-Factor Authenticity Checker</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                Fraud detection suite analyzing employment timelines, skill claims, and credentials to protect candidates & recruiters.
              </p>
              <Link to="/fake-detect" className="inline-flex items-center gap-2 text-xs font-bold text-rose-400 hover:text-white transition-colors">
                Run Authenticity Check <ChevronRight size={14} />
              </Link>
            </motion.div>

            {/* Feature 6 */}
            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -6, scale: 1.015 }}
              className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-[#2E9BDA]/50 transition-all shadow-xl group relative overflow-hidden"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2E9BDA]/20 to-cyan-600/20 border border-[#2E9BDA]/40 flex items-center justify-center text-[#2E9BDA] mb-6 group-hover:scale-110 transition-transform">
                <Bot size={26} strokeWidth={2.2} />
              </div>
              <h3 className="text-xl font-extrabold text-white mb-3">AI Application Assistant</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                Auto-generate customized cover letters, cold emails for hiring managers, and tailored LinkedIn outreach messages.
              </p>
              <Link to="/apply-assistant" className="inline-flex items-center gap-2 text-xs font-bold text-[#2E9BDA] hover:text-white transition-colors">
                Use Apply Assistant <ChevronRight size={14} />
              </Link>
            </motion.div>
          </motion.div>
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
              <Award size={14} />
              Tamper-Proof Verification
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
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white font-bold text-sm shadow-md shadow-[#2E9BDA]/25 hover:shadow-lg transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
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
            {/* Free */}
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-extrabold text-white">Starter Free</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">Perfect for trying ATS scans & quick practice.</p>
                </div>
                <div className="text-4xl font-black text-white">
                  ₹0 <span className="text-xs font-semibold text-slate-400">/ forever</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300 font-medium border-t border-slate-800 pt-6">
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> 3 ATS Resume Scans / month</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> 1 Live AI Mock Session</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> Basic Score Insights</li>
                </ul>
              </div>
              <button
                onClick={() => user ? navigate('/dashboard') : navigate('/signup')}
                className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Get Started Free
              </button>
            </div>

            {/* Pro Tier (Popular) */}
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
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> Unlimited ATS Scans</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> Unlimited Live AI Interviews</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> Verified Skill Certificates</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> AI Application Assistant</li>
                </ul>
              </div>
              <button
                onClick={() => user ? navigate('/billing') : navigate('/signup')}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white font-bold text-xs shadow-md shadow-[#2E9BDA]/25 hover:shadow-lg transition-all cursor-pointer"
              >
                Upgrade to Pro
              </button>
            </div>

            {/* Premium / Enterprise */}
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-extrabold text-white">Premium Executive</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">For senior roles, 1-on-1 coaching & priority SLA.</p>
                </div>
                <div className="text-4xl font-black text-white">
                  {isAnnual ? '₹799' : '₹999'} <span className="text-xs font-semibold text-slate-400">/ month</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300 font-medium border-t border-slate-800 pt-6">
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> Everything in Pro</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> 100% Club Verified Badge</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> Priority Recruiter Visibility</li>
                  <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400 shrink-0" /> 24/7 Priority Support</li>
                </ul>
              </div>
              <button
                onClick={() => user ? navigate('/billing') : navigate('/signup')}
                className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Get Premium Executive
              </button>
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
                AI Career Co-Pilot providing BERT ATS resume engineering, live video interview coaching, and verifiable skill certification.
              </p>
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                All CareerShala systems operational
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-white uppercase tracking-widest text-[11px]">Platform</h4>
              <ul className="space-y-2">
                <li><Link to="/results" className="hover:text-white transition-colors">ATS Resume Matcher</Link></li>
                <li><Link to="/live-interview" className="hover:text-white transition-colors">Live AI Interview</Link></li>
                <li><Link to="/gamification" className="hover:text-white transition-colors">Rewards & Badges</Link></li>
                <li><a href="#verify" className="hover:text-white transition-colors">Certificate Verifier</a></li>
              </ul>
            </div>

            {/* Recruiter & Support */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-white uppercase tracking-widest text-[11px]">Enterprise & Help</h4>
              <ul className="space-y-2">
                <li><Link to="/recruiter" className="hover:text-white transition-colors">Recruiter Portal</Link></li>
                <li><Link to="/support" className="hover:text-white transition-colors">Support Center</Link></li>
                <li><a href="#verify" className="hover:text-white transition-colors">Verify Credentials</a></li>
                <li><Link to="/billing" className="hover:text-white transition-colors">Pricing & Plans</Link></li>
              </ul>
            </div>

            {/* Newsletter */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-white uppercase tracking-widest text-[11px]">Stay Ahead</h4>
              <p className="leading-relaxed">Subscribe for AI resume engineering tips and ATS updates.</p>
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
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-[#1d6fa5] text-white font-bold text-xs shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  {subscribing ? 'Subscribing...' : 'Subscribe'}
                </button>
              </form>
            </div>
          </div>

          <div className="border-t border-slate-800/60 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© {new Date().getFullYear()} CareerShala. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
              <a href="#terms" className="hover:text-slate-400 transition-colors">Terms of Service</a>
              <a href="#security" className="hover:text-slate-400 transition-colors">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}