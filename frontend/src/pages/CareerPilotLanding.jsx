import React, { useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
// import {
//   Sun,
//   Moon,
//   ArrowRight,
//   PlayCircle,
//   FileText,
//   Search,
//   MessageSquare,
//   Send,
//   Users,
//   BarChart3,
//   CheckCircle2,
//   Clock,
//   GitBranch,
//   Linkedin,
//   Mail,
//   Sparkles,
//   Menu,
//   X,
//   ArrowUpRight,
//   Plus,
//   Minus,
//   Crown,
// } from "lucide-react";
import {
  Sun,
  Moon,
  ArrowRight,
  PlayCircle,
  FileText,
  Search,
  MessageSquare,
  Send,
  Users,
  BarChart3,
  CheckCircle2,
  Clock,
  GitBranch,
  Mail,
  Sparkles,
  Menu,
  X,
  ArrowUpRight,
  Plus,
  Minus,
  Crown,
} from "lucide-react";

import {
  FaGithub,
  FaLinkedin
} from "react-icons/fa";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const PIPELINE_STAGES = [
  { key: "resume", label: "Resume", icon: FileText, value: "Ready" },
  { key: "applied", label: "Applied", icon: Send, value: "24" },
  { key: "screening", label: "Screening", icon: Search, value: "9" },
  { key: "interview", label: "Interview", icon: MessageSquare, value: "4" },
  { key: "offer", label: "Offer", icon: CheckCircle2, value: "1" },
];

const TRUST_ITEMS = [
  { icon: Send, label: "Human-reviewed outreach" },
  { icon: FileText, label: "ATS-tested formatting" },
  { icon: Search, label: "Matches updated daily" },
  { icon: MessageSquare, label: "Practice interviews anytime" },
];

const FEATURES = [
  {
    icon: FileText,
    title: "Resume intelligence",
    description:
      "We rewrite and format your resume section by section, so it clears ATS scans and still reads well to a human.",
  },
  {
    icon: Search,
    title: "Smart job matching",
    description:
      "We check new postings every day and only surface roles that genuinely fit your skills and goals.",
  },
  {
    icon: MessageSquare,
    title: "Mock interview coach",
    description:
      "Practice real interview questions out loud and get honest, specific feedback right after each answer.",
  },
  {
    icon: Send,
    title: "Outreach assistant",
    description:
      "We draft short, honest notes to hiring managers and founders. You read and approve every message before it sends.",
  },
  {
    icon: Users,
    title: "Recruiter workspace",
    description:
      "Recruiters can browse, filter, and shortlist candidates from one shared queue, no spreadsheet required.",
  },
  {
    icon: BarChart3,
    title: "Progress analytics",
    description:
      "See your resume score, match quality, and interview pace in one place, updated as you go.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Build your resume",
    description:
      "Import your existing resume or start from scratch. We format it section by section and flag anything that might trip up an ATS.",
  },
  {
    n: "02",
    title: "Get matched to roles",
    description:
      "We check new postings daily and rank them by real fit, not just keywords, so you spend time on roles worth pursuing.",
  },
  {
    n: "03",
    title: "Practice, then apply",
    description:
      "Run a mock interview for the role, sharpen your answers, then apply or send an outreach note when you're ready.",
  },
  {
    n: "04",
    title: "Track everything",
    description:
      "Every application, reply, and interview lands on one board, so nothing slips through a spreadsheet crack.",
  },
];

const OLD_WAY = [
  "Fifteen browser tabs and a spreadsheet you forget to update",
  "The same resume sent to every role, ATS or not",
  "No idea why an application went quiet",
  "Cold emails that read like a mail merge",
];

const NEW_WAY = [
  "One dashboard for your entire search",
  "A resume tuned to each role, checked before you send it",
  "A clear status for every application, always current",
  "Short, honest notes that you write and approve yourself",
];

const JOB_MATCHES = [
  { role: "Backend Engineer", company: "Nordstack", match: 96 },
  { role: "Platform Engineer", company: "Ridgeline", match: 91 },
  { role: "Infra Engineer", company: "Vaultwave", match: 88 },
  { role: "Backend Engineer", company: "Meridian Labs", match: 85 },
];

const OUTREACH_QUEUE = [
  { name: "Founder, Nordstack", status: "Sent" },
  { name: "Founder, Ridgeline", status: "Queued" },
  { name: "CTO, Vaultwave", status: "Queued" },
];

const PRICING_PLANS = [
  {
    name: "Free",
    price: "₹0",
    period: "month",
    tagline: "Enough to get moving.",
    features: [
      "One resume profile, fully formatted",
      "Job matches, refreshed daily",
      "One mock interview a month",
      "Community support",
    ],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "₹299",
    period: "month",
    tagline: "For an active search.",
    features: [
      "Unlimited resume profiles",
      "Priority job matching",
      "Unlimited mock interviews",
      "10 outreach drafts a month",
      "Email support",
    ],
    cta: "Upgrade to Pro",
    highlighted: true,
  },
  {
    name: "Premium",
    price: "₹499",
    period: "month",
    tagline: "For a focused final push.",
    features: [
      "Everything in Pro",
      "Unlimited outreach drafts",
      "Faster review turnaround",
      "Early access to new features",
      "Direct support line",
    ],
    cta: "Unlock Premium",
    highlighted: false,
  },
];

const FAQS = [
  {
    q: "Does CareerShala apply to jobs for me automatically?",
    a: "No. We surface roles that match your profile and let you decide what's worth applying to. You stay in control of every application, always.",
  },
  {
    q: "Will outreach messages go out without me seeing them first?",
    a: "Never. Every message we draft sits in a review queue. Nothing is sent until you've read it and approved it yourself.",
  },
  {
    q: "How is my resume score calculated?",
    a: "We check formatting, keyword alignment, and structure against common ATS rules, then explain what to fix in plain language, no black box.",
  },
  {
    q: "Can recruiters see my information without permission?",
    a: "Recruiters only see profiles that candidates choose to share. You control your visibility at all times, and can turn it off whenever you like.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your account settings whenever you like, you'll keep access until the end of your current billing period.",
  },
  {
    q: "Do you store my card details?",
    a: "No. Payments are handled by a PCI-compliant processor. We never see or store your card number directly.",
  },
];

function FaqItem({ item, isOpen, onToggle }) {
  return (
    <div className="cp-accordion-item">
      <button className="cp-accordion-btn cp-focusable" onClick={onToggle} aria-expanded={isOpen}>
        <span className="font-body">{item.q}</span>
        <span className="cp-icon-btn" style={{ width: 28, height: 28, flexShrink: 0 }}>
          {isOpen ? <Minus size={14} /> : <Plus size={14} />}
        </span>
      </button>
      <div className={`cp-accordion-panel ${isOpen ? "cp-open" : ""}`}>
        <div>
          <p className="cp-muted font-body text-sm leading-relaxed pb-5 pr-8">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

function PricingCard({ plan, isAuthenticated }) {

  return (
    <div

      className={`relative flex flex-col justify-between rounded-4xl p-7 cp-fade-up ${
        plan.highlighted ? "cp-pricing-highlighted" : "cp-card"
      }`}
    >
      {plan.highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-blue text-white px-4 py-1 rounded-full text-2xs font-bold uppercase tracking-widest shadow-blue">
          Most popular
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="font-display font-semibold text-lg">{plan.name}</span>
          {plan.highlighted && <Crown size={18} style={{ color: "var(--accent-strong)" }} />}
        </div>

        <div className="flex items-baseline gap-1 mb-2">
          <span className="font-display text-3xl font-bold">{plan.price}</span>
          <span className="cp-muted text-sm">/{plan.period}</span>
        </div>

        <p className="cp-muted font-body text-sm mb-6">{plan.tagline}</p>

        <div className="cp-divider mb-6" />

        <ul className="space-y-3.5 mb-8">
          {plan.features.map((feat) => (
            <li key={feat} className="flex items-start gap-3 font-body text-sm">
              <CheckCircle2 size={16} style={{ color: "var(--good)", marginTop: 1, flexShrink: 0 }} />
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        to={isAuthenticated ? "/dashboard" : "/signup"}
        className={`cp-btn cp-focusable justify-center ${plan.highlighted ? "cp-btn-primary" : "cp-btn-outline"}`}
      >
        {plan.cta} <ArrowRight size={15} />
      </Link>
    </div>
  );
}

export default function CareerPilotLanding() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState("light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState("Backend Engineer Profile");
  const dark = theme === "dark";

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <div className="cp min-h-screen font-body" data-theme={theme}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');

        .cp {
          --bg: #FFFFFF;
          --surface: #FFFFFF;
          --surface-2: #F8FAFF;
          --border: rgba(30,58,138,0.10);
          --text: #111827;
          --muted: #5B6478;
          --accent: #2563EB;
          --accent-strong: #1E40AF;
          --accent-soft: #EFF6FF;
          --good: #158A50;
          --good-soft: #E6F6EE;
          --warn: #B4650A;
          --warn-soft: #FCEEDD;
          --bad: #B42318;
          background: var(--bg);
          color: var(--text);
          transition: background 0.35s ease, color 0.35s ease;
        }
        .cp[data-theme='dark'] {
          --bg: #0A1120;
          --surface: #111A2E;
          --surface-2: #16213A;
          --border: rgba(147,197,253,0.14);
          --text: #F1F5F9;
          --muted: #93A0B8;
          --accent: #3B82F6;
          --accent-strong: #93C5FD;
          --accent-soft: rgba(59,130,246,0.16);
          --good: #34D399;
          --good-soft: rgba(52,211,153,0.12);
          --warn: #FBBF24;
          --warn-soft: rgba(251,191,36,0.12);
          --bad: #F87171;
        }

        /* ---- fontFamily (tailwind.config.js parity) ---- */
        .font-display { font-family: 'Poppins', system-ui, sans-serif; letter-spacing: -0.01em; }
        .font-body, .font-sans { font-family: 'Inter', system-ui, sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .text-2xs { font-size: 0.625rem; line-height: 1rem; }
        .rounded-4xl { border-radius: 2rem; }

        /* ---- boxShadow (tailwind.config.js parity) ---- */
        .shadow-card { box-shadow: 0 2px 8px rgba(30,58,138,0.05), 0 0 0 1px rgba(30,58,138,0.05); }
        .shadow-card-hover:hover { box-shadow: 0 8px 24px rgba(30,58,138,0.10), 0 0 0 1px rgba(59,130,246,0.15); }
        .shadow-blue { box-shadow: 0 4px 20px rgba(59,130,246,0.25); }
        .shadow-blue-lg { box-shadow: 0 8px 32px rgba(59,130,246,0.35); }
        [data-theme='dark'] .shadow-card { box-shadow: 0 2px 10px rgba(0,0,0,0.35), 0 0 0 1px rgba(147,197,253,0.10); }
        [data-theme='dark'] .shadow-card-hover:hover { box-shadow: 0 10px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(59,130,246,0.35); }

        /* ---- backgroundImage / backgroundSize (tailwind.config.js parity) ---- */
        .bg-gradient-blue { background-image: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); }
        .bg-gradient-hero { background-image: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #BFDBFE 100%); }
        [data-theme='dark'] .bg-gradient-hero { background-image: linear-gradient(135deg, #0A1120 0%, #101A30 55%, #0E1F3D 100%); }
        .bg-dots { background-image: radial-gradient(circle, #BFDBFE 1px, transparent 1px); background-size: 24px 24px; }
        [data-theme='dark'] .bg-dots { background-image: radial-gradient(circle, rgba(147,197,253,0.28) 1px, transparent 1px); }
        .bg-mesh { background-image: linear-gradient(to right bottom, rgba(59,130,246,0.03), rgba(59,130,246,0.02), rgba(37,99,235,0.03)); }

        /* ---- keyframes + animation (tailwind.config.js parity) ---- */
        @keyframes fadeUp { 0% { opacity: 0; transform: translateY(24px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-up { animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards; }
        @keyframes pulseSoft { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .animate-pulse-soft { animation: pulseSoft 2s ease-in-out infinite; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .animate-float { animation: float 5s ease-in-out infinite; }
        @keyframes bounceSubtle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .animate-bounce-subtle { animation: bounceSubtle 2s ease-in-out infinite; }
        @keyframes gradientShift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .animate-gradient-shift { animation: gradientShift 6s ease infinite; background-size: 200% 200%; }
        @keyframes spinSlow { to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spinSlow 3s linear infinite; }
        @keyframes cpFlow { 0% { left: -40%; } 100% { left: 100%; } }

        /* ---- structural helpers (not in tailwind config, layout only) ---- */
        .cp-muted { color: var(--muted); }
        .cp-divider { border-top: 1px solid var(--border); }
        .cp-header { background: color-mix(in srgb, var(--bg) 80%, transparent); border-bottom: 1px solid var(--border); backdrop-filter: blur(10px); }
        .cp-mobile-menu { background: var(--bg); border-bottom: 1px solid var(--border); }
        .cp-nav-link { color: var(--muted); font-size: 0.875rem; font-weight: 500; transition: color 0.2s ease; }
        .cp-nav-link:hover { color: var(--text); }
        .cp-chip { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 0.68rem; font-weight: 600; background: var(--accent-soft); color: var(--accent-strong); }
        .cp-chip-good { background: var(--good-soft); color: var(--good); }
        .cp-dot-live { width: 6px; height: 6px; border-radius: 999px; background: var(--good); display: inline-block; animation: pulseSoft 2s ease-in-out infinite; }
        .cp-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.4rem; border-radius: 0.7rem; font-weight: 600; font-size: 0.875rem; cursor: pointer; border: 1px solid transparent; transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, color 0.2s ease; }
        .cp-btn-primary { background-image: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: #fff; box-shadow: 0 10px 24px -8px rgba(59,130,246,0.5); }
        .cp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 30px -8px rgba(59,130,246,0.6); }
        .cp-btn-outline { background: transparent; border-color: var(--border); color: var(--text); }
        .cp-btn-outline:hover { border-color: var(--accent); color: var(--accent); }
        .cp-icon-btn { width: 36px; height: 36px; border-radius: 0.6rem; display: inline-flex; align-items: center; justify-content: center; background: var(--surface-2); border: 1px solid var(--border); color: var(--text); transition: border-color 0.2s ease, color 0.2s ease; }
        .cp-icon-btn:hover { border-color: var(--accent); color: var(--accent); }
        .cp-card { background: var(--surface); border: 1px solid var(--border); border-radius: 1.25rem; box-shadow: 0 2px 8px rgba(30,58,138,0.05), 0 0 0 1px rgba(30,58,138,0.05); transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease; }
        .cp-card-hover:hover { transform: translateY(-4px); border-color: var(--accent); }
        .cp-pricing-highlighted { background: var(--surface); border: 1.5px solid var(--accent); border-radius: 2rem; box-shadow: 0 16px 48px rgba(37,99,235,0.18); transform: scale(1.03); }
        .cp-node-circle { width: 40px; height: 40px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: var(--accent-soft); color: var(--accent-strong); border: 1px solid var(--border); }
        .cp-node-line { flex: 1; height: 2px; margin: 0 6px; background: var(--border); position: relative; overflow: hidden; top: -20px; }
        .cp-node-line::after { content: ''; position: absolute; left: -40%; top: 0; height: 100%; width: 40%; background: linear-gradient(90deg, transparent, var(--accent), transparent); animation: cpFlow 2.6s linear infinite; }
        .cp-progress-track { background: var(--surface-2); border-radius: 999px; height: 8px; overflow: hidden; }
        .cp-progress-fill { background-image: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); height: 100%; border-radius: 999px; }
        .cp-section { padding: 5.5rem 0; }
        .cp-blob { position: absolute; border-radius: 999px; filter: blur(70px); pointer-events: none; }
        .cp-step-num { font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 0.85rem; color: var(--accent-strong); background: var(--accent-soft); width: 34px; height: 34px; border-radius: 0.6rem; display: inline-flex; align-items: center; justify-content: center; }
        .cp-step-line { flex: 1; border-top: 1px dashed var(--border); margin-top: 17px; }
        .cp-field-label { font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; color: var(--muted); margin-bottom: 0.4rem; display: block; }
        .cp-input, .cp-select, .cp-textarea { width: 100%; font-size: 0.8rem; padding: 0.6rem 0.8rem; border-radius: 0.6rem; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-family: inherit; }
        .cp-input:disabled, .cp-textarea:disabled { background: var(--surface-2); color: var(--muted); }
        .cp-input:focus, .cp-select:focus, .cp-textarea:focus { outline: none; border-color: var(--accent); }
        .cp-compare-item { display: flex; align-items: flex-start; gap: 0.65rem; }
        .cp-accordion-item { border-bottom: 1px solid var(--border); }
        .cp-accordion-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.15rem 0; text-align: left; font-weight: 600; font-size: 0.95rem; background: transparent; border: none; color: var(--text); cursor: pointer; }
        .cp-accordion-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.3s ease; }
        .cp-accordion-panel.cp-open { grid-template-rows: 1fr; }
        .cp-accordion-panel > div { overflow: hidden; }
        .cp-focusable:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        @media (prefers-reduced-motion: reduce) {
          .cp *, .cp *::before, .cp *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* NAVIGATION */}
      <header className="cp-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-blue w-8 h-8 rounded-lg flex items-center justify-center shadow-blue">
              <Sparkles size={16} color="#fff" />
            </div>
            <span className="font-display font-bold text-lg bg-gradient-blue bg-clip-text text-transparent">
              CareerShala
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="cp-nav-link cp-focusable flex items-center gap-1.5">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(dark ? "light" : "dark")}
              className="cp-icon-btn cp-focusable"
              aria-label="Switch to the other color theme"
            >
              {dark ? <Sun size={16} className="animate-pulse-soft" /> : <Moon size={16} />}
            </button>

            {user ? (
              <>
                <Link to="/dashboard" className="cp-nav-link cp-focusable hidden sm:inline-block font-semibold">
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="cp-btn cp-btn-outline cp-focusable hidden sm:inline-flex"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="cp-nav-link cp-focusable hidden sm:inline-block font-semibold">
                  Sign in
                </Link>
                <Link to="/signup" className="cp-btn cp-btn-primary cp-focusable hidden sm:inline-flex">
                  Get started
                </Link>
              </>
            )}

            <button
              className="cp-icon-btn cp-focusable lg:hidden"
              aria-label="Open menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="cp-mobile-menu lg:hidden px-6 py-5 flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="cp-nav-link" onClick={() => setMenuOpen(false)}>
                {link.label}
              </a>
            ))}
            {user ? (
              <>
                <Link to="/dashboard" className="cp-nav-link font-semibold" onClick={() => setMenuOpen(false)}>
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    handleLogout()
                    setMenuOpen(false)
                  }}
                  className="cp-btn cp-btn-outline justify-center"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="cp-nav-link font-semibold" onClick={() => setMenuOpen(false)}>
                  Sign in
                </Link>
                <Link to="/signup" className="cp-btn cp-btn-primary justify-center" onClick={() => setMenuOpen(false)}>
                  Get started
                </Link>
              </>
            )}
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="bg-gradient-hero bg-dots relative overflow-hidden">
        <div className="cp-blob w-80 h-80 opacity-30 -top-10 left-10 animate-float" style={{ background: "#93C5FD" }} />
        <div className="cp-blob w-72 h-72 opacity-20 top-40 right-10 animate-float" style={{ background: "#60A5FA", animationDelay: "1.2s" }} />

        <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-16 md:pt-24 md:pb-20">
          <div className="grid lg:grid-cols-12 gap-14 items-center">
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              <div className="animate-fade-up inline-flex items-center gap-2 cp-chip">
                <Sparkles size={12} /> Built for engineers, by an engineer
              </div>

              <h1 className="font-display animate-fade-up font-bold text-4xl sm:text-5xl lg:text-[3.4rem] leading-[1.1]" style={{ animationDelay: "80ms" }}>
                Run your job search like a pipeline, not a chore.
              </h1>

              <p className="animate-fade-up cp-muted font-body text-base sm:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0" style={{ animationDelay: "160ms" }}>
                CareerShala builds your resume, finds roles worth applying to, and helps you
                reach out to the right people, so you can spend your time on interviews, not admin.
              </p>

              <div className="animate-fade-up flex flex-wrap items-center justify-center lg:justify-start gap-4" style={{ animationDelay: "240ms" }}>
                <Link to={user ? "/dashboard" : "/signup"} className="cp-btn cp-btn-primary cp-focusable">
                  Start free <ArrowRight size={16} />
                </Link>
                <a href="#how-it-works" className="cp-btn cp-btn-outline cp-focusable">
                  <PlayCircle size={16} /> See how it works
                </a>
              </div>

              <p className="animate-fade-up font-mono text-2xs cp-muted pt-2" style={{ animationDelay: "300ms" }}>
                24 applications tracked · 4 interviews booked · 1 offer in hand
              </p>
            </div>

            <div className="lg:col-span-6 animate-fade-up" style={{ animationDelay: "200ms" }}>
              <div className="cp-card rounded-4xl shadow-blue-lg p-6 sm:p-7">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <p className="font-mono text-2xs cp-muted uppercase tracking-wider">Live pipeline</p>
                    <h3 className="font-display font-semibold text-lg mt-1">Your job search, tracked</h3>
                  </div>
                  <span className="cp-chip cp-chip-good">
                    <span className="cp-dot-live" /> Active
                  </span>
                </div>

                <div className="flex items-start">
                  {PIPELINE_STAGES.map((stage, i) => (
                    <React.Fragment key={stage.key}>
                      <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                        <div className="cp-node-circle">
                          <stage.icon size={16} />
                        </div>
                        <span className="text-2xs cp-muted font-medium text-center">{stage.label}</span>
                        <span className="font-mono font-bold text-sm">{stage.value}</span>
                      </div>
                      {i < PIPELINE_STAGES.length - 1 && <div className="cp-node-line" />}
                    </React.Fragment>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-8 pt-6 cp-divider">
                  <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                    <p className="text-2xs cp-muted">Resume score</p>
                    <p className="font-display font-bold text-xl mt-1">92<span className="cp-muted text-sm font-normal"> / 100</span></p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                    <p className="text-2xs cp-muted">Messages in review</p>
                    <p className="font-display font-bold text-xl mt-1">3</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TRUST STRIP */}
          <div className="animate-fade-up grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 pt-10 cp-divider" style={{ animationDelay: "360ms" }}>
            {TRUST_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-3 justify-center lg:justify-start">
                <div className="cp-icon-btn" style={{ background: "var(--accent-soft)", borderColor: "transparent", color: "var(--accent-strong)" }}>
                  <item.icon size={15} />
                </div>
                <span className="font-body text-sm font-medium text-center lg:text-left">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="cp-section" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-14">
            <p className="font-mono text-2xs cp-muted uppercase tracking-widest">What CareerShala does</p>
            <h2 className="font-display font-bold text-3xl sm:text-4xl">Everything your search needs, in one place</h2>
            <p className="cp-muted font-body text-sm sm:text-base">
              No more juggling spreadsheets, browser tabs, and half-finished drafts. One tool, six jobs done well.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="cp-card cp-card-hover p-6">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
                >
                  <feature.icon size={20} />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="cp-muted font-body text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="cp-section">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
            <p className="font-mono text-2xs cp-muted uppercase tracking-widest">The process</p>
            <h2 className="font-display font-bold text-3xl sm:text-4xl">Four steps, start to offer</h2>
            <p className="cp-muted font-body text-sm sm:text-base">
              No hidden automation, no black box. Here's exactly what happens at each stage.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.n} className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="cp-step-num">{step.n}</span>
                  {i < STEPS.length - 1 && <div className="cp-step-line hidden md:block" />}
                </div>
                <h3 className="font-display font-semibold text-lg">{step.title}</h3>
                <p className="cp-muted font-body text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DASHBOARD PREVIEW */}
      <section id="dashboard" className="cp-section" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-10 items-end mb-12">
            <div className="lg:col-span-7 space-y-4 text-center lg:text-left mx-auto lg:mx-0">
              <p className="font-mono text-2xs cp-muted uppercase tracking-widest">Inside the dashboard</p>
              <h2 className="font-display font-bold text-3xl sm:text-4xl">See exactly where you stand</h2>
              <p className="cp-muted font-body text-sm sm:text-base max-w-xl mx-auto lg:mx-0">
                Every resume score, job match, and reply lands in one dashboard, updated automatically as things move.
              </p>
            </div>
          </div>

          <div className="cp-card p-6 lg:p-8 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Resume score */}
              <div className="md:col-span-4 rounded-xl p-5 flex flex-col justify-between" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="space-y-2">
                  <span className="text-2xs cp-muted uppercase tracking-widest font-semibold">Resume score</span>
                  <div className="font-display text-3xl font-bold">92 <span className="text-sm font-medium cp-muted">/ 100</span></div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="cp-progress-track">
                    <div className="cp-progress-fill" style={{ width: "92%" }} />
                  </div>
                  <p className="text-2xs cp-muted">Checked against real ATS rules, not guesswork.</p>
                </div>
              </div>

              {/* Job matches */}
              <div className="md:col-span-8 rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-2xs cp-muted uppercase tracking-widest font-semibold">New matches this week</span>
                  <span className="text-2xs font-medium flex items-center gap-1" style={{ color: "var(--accent-strong)" }}>
                    <Search size={12} /> Checked daily
                  </span>
                </div>
                <div className="font-body text-sm">
                  {JOB_MATCHES.map((job, i) => (
                    <div
                      key={job.company + job.role}
                      className="py-2.5 flex items-center justify-between"
                      style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
                    >
                      <div className="font-medium">
                        {job.role} <span className="cp-muted font-normal">at {job.company}</span>
                      </div>
                      <div className="cp-chip font-mono">{job.match}% match</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pipeline tracker */}
              <div className="md:col-span-7 rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <span className="text-2xs cp-muted uppercase tracking-widest font-semibold block mb-5">Your applications, tracked automatically</span>
                <div className="flex items-center justify-between gap-2">
                  {PIPELINE_STAGES.slice(1).map((stage, i, arr) => (
                    <React.Fragment key={stage.key}>
                      <div className="text-center flex-1 min-w-[50px]">
                        <div className="font-display text-xl font-bold" style={{ color: "var(--accent-strong)" }}>{stage.value}</div>
                        <div className="text-2xs cp-muted font-medium mt-1">{stage.label}</div>
                      </div>
                      {i < arr.length - 1 && <div className="h-px w-8 flex-shrink-0" style={{ background: "var(--border)" }} />}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Outreach queue */}
              <div className="md:col-span-5 rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <span className="text-2xs cp-muted uppercase tracking-widest font-semibold block mb-4">Messages waiting for your approval</span>
                <div className="space-y-3 font-body text-sm">
                  {OUTREACH_QUEUE.map((q) => (
                    <div key={q.name} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        {q.status === "Sent" ? (
                          <CheckCircle2 size={14} style={{ color: "var(--good)" }} />
                        ) : (
                          <Clock size={14} style={{ color: "var(--accent-strong)" }} />
                        )}
                        <span className="truncate">{q.name}</span>
                      </div>
                      <span className={`cp-chip ${q.status === "Sent" ? "cp-chip-good" : ""}`}>{q.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Outreach composer */}
          <div className="cp-card p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display font-semibold text-lg">Outreach composer</h3>
                <p className="text-2xs cp-muted mt-1">Drafts land in your review queue. Nothing sends without your approval.</p>
              </div>
              <span className="cp-chip">
                <Mail size={12} /> Draft mode
              </span>
            </div>

            <div className="grid md:grid-cols-12 gap-6">
              <div className="md:col-span-7 space-y-4">
                <div>
                  <label className="cp-field-label">Resume profile</label>
                  <select
                    className="cp-select"
                    value={selectedProfile}
                    onChange={(e) => setSelectedProfile(e.target.value)}
                  >
                    <option>Backend Engineer Profile</option>
                    <option>Data Science & ML Profile</option>
                    <option>Full-Stack Profile</option>
                  </select>
                </div>
                <div>
                  <label className="cp-field-label">Recipient</label>
                  <input className="cp-input" disabled value="founders@nordstack.io" readOnly />
                </div>
                <div>
                  <label className="cp-field-label">Job description</label>
                  <textarea
                    className="cp-textarea"
                    rows="3"
                    disabled
                    readOnly
                    value="Looking for a Backend Engineer comfortable with FastAPI, async patterns, and clean API design..."
                  />
                </div>
                <button type="button" className="cp-btn cp-btn-primary cp-focusable w-full justify-center">
                  <Sparkles size={14} /> Draft a message
                </button>
              </div>

              <div className="md:col-span-5">
                <div
                  className="h-full rounded-xl p-5 flex flex-col justify-center items-center text-center"
                  style={{ background: "var(--surface-2)", border: "1px dashed var(--border)" }}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--accent-soft)" }}>
                    <Mail size={18} style={{ color: "var(--accent-strong)" }} />
                  </div>
                  <span className="font-body text-sm font-semibold">Review queue</span>
                  <p className="text-2xs cp-muted max-w-[190px] mt-1">
                    Two drafts are ready. Read each one and approve it yourself before it goes out.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY CAREERPILOT */}
      <section id="why" className="cp-section">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-14">
            <p className="font-mono text-2xs cp-muted uppercase tracking-widest">Why it's different</p>
            <h2 className="font-display font-bold text-3xl sm:text-4xl">Less busywork, more signal</h2>
            <p className="cp-muted font-body text-sm sm:text-base">A side-by-side look at searching on your own versus searching with CareerShala.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="cp-card p-6 sm:p-8">
              <h3 className="font-display font-semibold text-lg mb-5 cp-muted">Doing it alone</h3>
              <div className="space-y-4">
                {OLD_WAY.map((item) => (
                  <div key={item} className="cp-compare-item">
                    <X size={16} style={{ color: "var(--bad)", marginTop: 2, flexShrink: 0 }} />
                    <span className="font-body text-sm cp-muted">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="cp-card p-6 sm:p-8" style={{ borderColor: "var(--accent)" }}>
              <h3 className="font-display font-semibold text-lg mb-5">With CareerShala</h3>
              <div className="space-y-4">
                {NEW_WAY.map((item) => (
                  <div key={item} className="cp-compare-item">
                    <CheckCircle2 size={16} style={{ color: "var(--good)", marginTop: 2, flexShrink: 0 }} />
                    <span className="font-body text-sm font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="cp-section" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
            <p className="font-mono text-2xs cp-muted uppercase tracking-widest">Pricing</p>
            <h2 className="font-display font-bold text-3xl sm:text-4xl">Pay for what you actually use</h2>
            <p className="cp-muted font-body text-sm sm:text-base">
              Start free. Upgrade when you're actively searching and want more room to move.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-stretch max-w-5xl mx-auto">
            {PRICING_PLANS.map((plan) => (
              <PricingCard key={plan.name} plan={plan} isAuthenticated={Boolean(user)} />
            ))}
          </div>

          <p className="text-center text-2xs cp-muted font-mono mt-10">
            Prices shown in INR. Cancel anytime, no questions asked.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="cp-section">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center space-y-4 mb-12">
            <p className="font-mono text-2xs cp-muted uppercase tracking-widest">Questions</p>
            <h2 className="font-display font-bold text-3xl sm:text-4xl">Straight answers, no fine print</h2>
          </div>

          <div className="cp-card px-6 sm:px-8">
            {FAQS.map((item, i) => (
              <FaqItem
                key={item.q}
                item={item}
                isOpen={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-hero cp-section">
        <div className="max-w-3xl mx-auto px-6 text-center space-y-7">
          <div className="bg-gradient-blue w-12 h-12 rounded-2xl flex items-center justify-center mx-auto shadow-blue-lg animate-bounce-subtle">
            <Sparkles size={20} color="#fff" />
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-4xl">Your next role is closer than it feels.</h2>
          <p className="cp-muted font-body text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Build a resume that gets read, find roles worth your time, and start real conversations,
            all before your coffee gets cold.
          </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {user ? (
                <>
                  <Link to="/dashboard" className="cp-btn cp-btn-primary cp-focusable">Dashboard</Link>
                </>
              ) : (
                <>
                  <Link to="/signup" className="cp-btn cp-btn-primary cp-focusable">Create free account</Link>
                  <Link to="/login" className="cp-btn cp-btn-outline cp-focusable">Sign in</Link>
                </>
              )}
            </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">
          <div className="grid grid-cols-2 md:grid-cols-12 gap-10 pb-12">
            <div className="col-span-2 md:col-span-4 space-y-4">
              <div className="flex items-center gap-2">
                <div className="bg-gradient-blue w-7 h-7 rounded-md flex items-center justify-center shadow-blue">
                  <Sparkles size={13} color="#fff" />
                </div>
                <span className="font-display font-bold text-lg">CareerShala</span>
              </div>
              <p className="cp-muted font-body text-sm leading-relaxed max-w-xs">
                One place to build your resume, find roles worth applying to, and reach the right people, without the busywork.
              </p>
            </div>

            <div className="col-span-1 md:col-span-2 space-y-3">
              <h4 className="text-2xs font-bold uppercase tracking-widest">Product</h4>
              <ul className="space-y-2.5 font-body text-sm cp-muted">
                <li><a href="#features" className="cp-focusable hover:underline">Resume builder</a></li>
                <li><a href="#features" className="cp-focusable hover:underline">Job matching</a></li>
                <li><a href="#features" className="cp-focusable hover:underline">Interview practice</a></li>
                <li><a href="#dashboard" className="cp-focusable hover:underline">Outreach assistant</a></li>
              </ul>
            </div>

            <div className="col-span-1 md:col-span-2 space-y-3">
              <h4 className="text-2xs font-bold uppercase tracking-widest">Company</h4>
              <ul className="space-y-2.5 font-body text-sm cp-muted">
                <li><a href="#why" className="cp-focusable hover:underline">Why CareerShala</a></li>
                <li><a href="#pricing" className="cp-focusable hover:underline">Pricing</a></li>
                <li><a href="#faq" className="cp-focusable hover:underline">FAQ</a></li>
                <li><a href="#privacy" className="cp-focusable hover:underline">Privacy policy</a></li>
                <li><a href="#terms" className="cp-focusable hover:underline">Terms of service</a></li>
              </ul>
            </div>

            <div className="col-span-2 md:col-span-4 space-y-3">
              <h4 className="text-2xs font-bold uppercase tracking-widest">Connect</h4>
              <p className="cp-muted font-body text-sm">Questions or feedback? Reach out through any of these.</p>
              <div className="flex items-center gap-2 pt-1">
                <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="cp-icon-btn cp-focusable" aria-label="LinkedIn">
                  {/* <Linkedin size={14} /> */}
                  <FaLinkedin size={14} />
                </a>
                <a href="https://github.com" target="_blank" rel="noreferrer" className="cp-icon-btn cp-focusable" aria-label="GitHub">
                  {/* <Github size={14} /> */}
                  <FaGithub size={14} />
                </a>
                <a href="mailto:hello@careershala.com" className="cp-icon-btn cp-focusable" aria-label="Email">
                  <Mail size={14} />
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-2xs cp-muted font-mono cp-divider">
            <span>© {new Date().getFullYear()} CareerShala. All rights reserved.</span>
            <span className="flex items-center gap-1">Built with care <ArrowUpRight size={12} /></span>
          </div>
        </div>
      </footer>
    </div>
  );
}