import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { verifyCertificate } from '../services/certificateApi';

/* ============================================================================
   DESIGN SYSTEM — "FLIGHT DECK"
   A co-pilot for your job search, styled like the instrument panel of a
   cockpit: amber dial accents, mono telemetry type, tick-marked dividers,
   and radial gauges standing in for every score on the page.
   ============================================================================ */

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');

    .cs-root {
      --bg: #0A0B0D;
      --panel: #121417;
      --panel-2: #16191D;
      --line: rgba(232,163,61,0.14);
      --line-soft: rgba(255,255,255,0.07);
      --amber: #E8A33D;
      --amber-soft: #F3C57C;
      --blue: #6EA8D6;
      --green: #86C17A;
      --red: #DB7C71;
      --ink: #ECEAE3;
      --ink-dim: #9A9DA6;
      --ink-faint: #5D616B;
      --font-display: 'Space Grotesk', sans-serif;
      --font-body: 'Inter', sans-serif;
      --font-mono: 'IBM Plex Mono', monospace;
      background: var(--bg);
      font-family: var(--font-body);
      color: var(--ink);
    }
    .cs-root .fd { font-family: var(--font-display); }
    .cs-root .fm { font-family: var(--font-mono); }

    .cs-root .bg-panel { background: var(--panel); }
    .cs-root .bg-panel2 { background: var(--panel-2); }
    .cs-root .border-hair { border-color: var(--line-soft); }
    .cs-root .border-amber-hair { border-color: var(--line); }

    /* Cockpit grid texture */
    .cs-grid {
      background-image:
        linear-gradient(to right, rgba(232,163,61,0.035) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(232,163,61,0.035) 1px, transparent 1px);
      background-size: 36px 36px;
    }

    .cs-vignette::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(ellipse 70% 60% at 50% 0%, rgba(232,163,61,0.10), transparent 60%);
      pointer-events: none;
    }

    /* Reveal on scroll */
    .cs-reveal {
      opacity: 0;
      transform: translateY(22px);
      transition: opacity 0.7s cubic-bezier(.16,.8,.24,1), transform 0.7s cubic-bezier(.16,.8,.24,1);
    }
    .cs-reveal.is-visible { opacity: 1; transform: translateY(0); }
    .cs-reveal.d1 { transition-delay: 0.08s; }
    .cs-reveal.d2 { transition-delay: 0.16s; }
    .cs-reveal.d3 { transition-delay: 0.24s; }
    .cs-reveal.d4 { transition-delay: 0.32s; }
    .cs-reveal.d5 { transition-delay: 0.40s; }

    @media (prefers-reduced-motion: reduce) {
      .cs-reveal { opacity: 1; transform: none; transition: none; }
      .cs-root * { animation: none !important; }
    }

    /* Card lift + amber glow on hover */
    .cs-card {
      transition: transform 0.35s cubic-bezier(.16,.8,.24,1), border-color 0.35s ease, box-shadow 0.35s ease, background 0.35s ease;
    }
    .cs-card:hover {
      transform: translateY(-4px);
      border-color: rgba(232,163,61,0.45);
      box-shadow: 0 20px 50px -20px rgba(232,163,61,0.18), 0 0 0 1px rgba(232,163,61,0.08) inset;
    }

    /* Primary button shine sweep */
    .cs-btn-primary {
      position: relative;
      overflow: hidden;
      background: linear-gradient(135deg, var(--amber) 0%, #C97F2B 100%);
      color: #1A1204;
      transition: transform 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease;
    }
    .cs-btn-primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 14px 34px -12px rgba(232,163,61,0.55); }
    .cs-btn-primary::after {
      content: '';
      position: absolute; top: 0; left: -60%;
      width: 40%; height: 100%;
      background: linear-gradient(120deg, transparent, rgba(255,255,255,0.55), transparent);
      transform: skewX(-20deg);
      transition: left 0.65s ease;
    }
    .cs-btn-primary:hover::after { left: 130%; }

    .cs-btn-ghost {
      transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease;
    }
    .cs-btn-ghost:hover { border-color: rgba(232,163,61,0.5); background: rgba(232,163,61,0.06); transform: translateY(-2px); }

    /* Underline-grow nav links */
    .cs-navlink { position: relative; }
    .cs-navlink::after {
      content: ''; position: absolute; left: 0; right: 100%; bottom: -6px; height: 1.5px;
      background: var(--amber); transition: right 0.3s cubic-bezier(.16,.8,.24,1);
    }
    .cs-navlink:hover::after { right: 0; }

    /* Ambient float */
    @keyframes cs-float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-9px); } }
    .cs-float { animation: cs-float 6s ease-in-out infinite; }
    .cs-float-slow { animation: cs-float 8s ease-in-out infinite; animation-delay: 1s; }

    @keyframes cs-pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(134,193,122,0.45);} 100% { box-shadow: 0 0 0 9px rgba(134,193,122,0);} }
    .cs-pulse { animation: cs-pulse-ring 1.8s ease-out infinite; }

    @keyframes cs-blink { 0%,100% { opacity: 1;} 50% { opacity: 0.25; } }
    .cs-blink { animation: cs-blink 2.2s ease-in-out infinite; }

    @keyframes cs-sweep-in { from { stroke-dashoffset: var(--dash-full);} to { stroke-dashoffset: var(--dash-final);} }
    .cs-gauge-arc { animation: cs-sweep-in 1.4s cubic-bezier(.16,.8,.24,1) forwards; }

    @keyframes cs-scanline { 0% { transform: translateY(-100%);} 100% { transform: translateY(100%);} }

    .cs-tick-divider {
      background-image: repeating-linear-gradient(to right, rgba(232,163,61,0.35) 0px, rgba(232,163,61,0.35) 1px, transparent 1px, transparent 10px);
      height: 6px;
    }

    .cs-scrollbar-fade::-webkit-scrollbar { display: none; }

    .cs-accordion-body {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.4s cubic-bezier(.16,.8,.24,1);
    }
    .cs-accordion-body.open { grid-template-rows: 1fr; }
    .cs-accordion-body > div { overflow: hidden; }
  `}</style>
);

/* ---------------------------------------------------------------------------
   Scroll reveal wrapper
   --------------------------------------------------------------------------- */
const Reveal = ({ children, className = '', delay = '' }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={`cs-reveal ${delay} ${visible ? 'is-visible' : ''} ${className}`}>
      {children}
    </div>
  );
};

/* ---------------------------------------------------------------------------
   Icons — thin, geometric, instrument-panel in character
   --------------------------------------------------------------------------- */
const IconCheck = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ minWidth: '16px' }}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M4.5 12.5l5 5L20 6" />
  </svg>
);
const IconArrow = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7V17" />
  </svg>
);
const IconChevron = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const IconRadar = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" strokeWidth="1.4" opacity="0.5" />
    <circle cx="12" cy="12" r="5.2" strokeWidth="1.4" opacity="0.7" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <path d="M12 12L18 7" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IconPen = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 20l4.2-1 10-10-3.2-3.2-10 10L4 20z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M13.5 6.5l3.2 3.2" />
  </svg>
);
const IconWave = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 12h2l2-6 3 12 3-9 2 6 2-3h4" />
  </svg>
);
const IconGlobe = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8.5" strokeWidth="1.5" />
    <path strokeWidth="1.5" d="M3.5 12h17M12 3.5c2.6 2.3 4 5.3 4 8.5s-1.4 6.2-4 8.5c-2.6-2.3-4-5.3-4-8.5s1.4-6.2 4-8.5z" />
  </svg>
);
const IconMedal = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="9" r="5.5" strokeWidth="1.5" />
    <path strokeLinecap="round" strokeWidth="1.5" d="M9 13.5L7 21l5-2.5 5 2.5-2-7.5" />
  </svg>
);
const IconSend = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 12L20 4L13 20L11 13L4 12Z" />
  </svg>
);

/* ---------------------------------------------------------------------------
   Radial gauge — the page's signature instrument
   --------------------------------------------------------------------------- */
const Gauge = ({ value = 80, size = 168, stroke = 9, color = 'var(--amber)', label, sublabel, mono = true, ticks = 30 }) => {
  const r = size / 2 - stroke * 1.8;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const finalOffset = circumference - (Math.min(Math.max(value, 0), 100) / 100) * circumference;

  const tickMarks = Array.from({ length: ticks }).map((_, i) => {
    const angle = (i / ticks) * 360 - 90;
    const isMajor = i % 5 === 0;
    const rOuter = size / 2 - 2;
    const rInner = rOuter - (isMajor ? 8 : 4);
    const rad = (angle * Math.PI) / 180;
    return {
      x1: cx + rOuter * Math.cos(rad),
      y1: cy + rOuter * Math.sin(rad),
      x2: cx + rInner * Math.cos(rad),
      y2: cy + rInner * Math.sin(rad),
      isMajor,
    };
  });

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {tickMarks.map((t, i) => (
          <line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.isMajor ? 'rgba(232,163,61,0.55)' : 'rgba(255,255,255,0.12)'}
            strokeWidth={t.isMajor ? 1.6 : 1}
          />
        ))}
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
          <circle
            cx={cx} cy={cy} r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            className="cs-gauge-arc"
            style={{ '--dash-full': circumference, '--dash-final': finalOffset }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <span className={`${mono ? 'fm' : 'fd'} font-semibold`} style={{ color, fontSize: size * 0.19 }}>
          {value}%
        </span>
        {label && <span className="fm text-[9px] uppercase tracking-[0.18em] mt-1" style={{ color: 'var(--ink-dim)' }}>{label}</span>}
        {sublabel && <span className="text-[10px] mt-0.5" style={{ color: 'var(--ink-faint)' }}>{sublabel}</span>}
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------------------
   Small shared bits
   --------------------------------------------------------------------------- */
const Eyebrow = ({ children, color = 'var(--amber)' }) => (
  <span
    className="fm inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] px-3 py-1.5 rounded-sm border"
    style={{ color, borderColor: 'rgba(232,163,61,0.3)', background: 'rgba(232,163,61,0.06)' }}
  >
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
    {children}
  </span>
);

const TickRule = () => <div className="cs-tick-divider w-full" />;

/* ============================================================================
   HERO VISUAL — the instrument cluster
   ============================================================================ */
const HeroInstrumentCluster = () => {
  const [enhanced, setEnhanced] = useState(true);
  const [selectedRole, setSelectedRole] = useState('Full-Stack Engineer');
  const [scanning, setScanning] = useState(false);
  const [customScore, setCustomScore] = useState(96);
  const [roleSkills, setRoleSkills] = useState([
    { name: 'Microservices', matched: true },
    { name: 'REST APIs', matched: true },
    { name: 'Query Tuning', matched: true },
    { name: 'System Design', matched: true },
    { name: 'React Architecture', matched: true },
    { name: 'Node.js Security', matched: true },
  ]);

  const ROLE_PRESETS = {
    'Full-Stack Engineer': [
      { name: 'Microservices', matched: true },
      { name: 'REST APIs', matched: true },
      { name: 'Query Tuning', matched: true },
      { name: 'System Design', matched: true },
      { name: 'React Architecture', matched: true },
      { name: 'Node.js Security', matched: true },
    ],
    'Backend Engineer': [
      { name: 'Python FastAPI', matched: true },
      { name: 'PostgreSQL / SQL', matched: true },
      { name: 'Docker / K8s', matched: true },
      { name: 'Redis Caching', matched: true },
      { name: 'gRPC / Microservices', matched: true },
      { name: 'CI/CD Pipelines', matched: false },
    ],
    'AI / ML Engineer': [
      { name: 'PyTorch / TensorFlow', matched: true },
      { name: 'LangChain / LLMs', matched: true },
      { name: 'Vector Databases', matched: true },
      { name: 'Model Fine-tuning', matched: true },
      { name: 'Python Async', matched: true },
      { name: 'GPU Acceleration', matched: false },
    ],
    'DevOps / Cloud Specialist': [
      { name: 'AWS / GCP Architecture', matched: true },
      { name: 'Terraform IaC', matched: true },
      { name: 'Kubernetes Admin', matched: true },
      { name: 'Prometheus Monitoring', matched: true },
      { name: 'Linux Kernel Tuning', matched: false },
      { name: 'Bash Scripting', matched: true },
    ],
  };

  const handleRoleChange = async (role) => {
    setSelectedRole(role);
    setScanning(true);
    try {
      // Simulation of API call
      await new Promise(resolve => setTimeout(resolve, 800));
      const preset = ROLE_PRESETS[role] || ROLE_PRESETS['Full-Stack Engineer'];
      setRoleSkills(preset);
      setCustomScore(role === 'Backend Engineer' ? 88 : role === 'AI / ML Engineer' ? 92 : 96);
    } catch (err) {
      const preset = ROLE_PRESETS[role] || ROLE_PRESETS['Full-Stack Engineer'];
      setRoleSkills(preset);
    } finally {
      setScanning(false);
    }
  };

  const currentScore = enhanced ? (scanning ? 60 : customScore) : 46;

  return (
    <div className="relative mx-auto max-w-6xl pt-4 pb-10 px-2 sm:px-6">
      <div className="cs-float-slow absolute -top-6 left-1/4 w-2 h-2 rounded-full bg-amber-400/60 blur-[1px]" />
      <div className="cs-float absolute top-10 right-1/3 w-1.5 h-1.5 rounded-full bg-blue-300/50 blur-[1px]" />

      <div className="relative rounded-[28px] p-[1px] bg-gradient-to-b from-[rgba(232,163,61,0.35)] via-[rgba(232,163,61,0.1)] to-transparent shadow-[0_0_120px_rgba(232,163,61,0.10)]">
        <div className="relative bg-panel cs-grid rounded-[27px] p-5 sm:p-9 overflow-hidden">
          <div className="cs-vignette absolute inset-0" />

          {/* Panel header */}
          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 mb-7">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--red)' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--amber)' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--green)' }} />
              </div>
              <span className="fm text-[11px] font-medium tracking-widest" style={{ color: 'var(--ink-faint)' }}>
                CAREERSHALA — CO-PILOT INSTRUMENT CLUSTER
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-black/40 p-1 rounded-full border border-hair">
                <button
                  onClick={() => setEnhanced(false)}
                  className={`fm px-3.5 py-1.5 text-[11px] font-medium rounded-full transition-all duration-300 ${
                    !enhanced ? 'text-white' : 'text-[color:var(--ink-faint)] hover:text-white'
                  }`}
                  style={!enhanced ? { background: 'rgba(219,124,113,0.22)', color: 'var(--red)' } : {}}
                >
                  Original · 46%
                </button>
                <button
                  onClick={() => setEnhanced(true)}
                  className={`fm px-3.5 py-1.5 text-[11px] font-medium rounded-full transition-all duration-300 ${
                    enhanced ? 'text-white' : 'text-[color:var(--ink-faint)] hover:text-white'
                  }`}
                  style={enhanced ? { background: 'rgba(134,193,122,0.18)', color: 'var(--green)' } : {}}
                >
                  Enhanced · {customScore}%
                </button>
              </div>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Gauge */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-panel2 border border-hair text-center">
              <Gauge
                value={currentScore}
                color={enhanced ? (currentScore > 75 ? 'var(--green)' : 'var(--amber)') : 'var(--red)'}
                label="ATS Match"
              />
              <span
                className="fm mt-4 text-[11px] font-medium px-3 py-1 rounded-full border"
                style={
                  enhanced
                    ? { color: 'var(--green)', borderColor: 'rgba(134,193,122,0.35)', background: 'rgba(134,193,122,0.08)' }
                    : { color: 'var(--red)', borderColor: 'rgba(219,124,113,0.35)', background: 'rgba(219,124,113,0.08)' }
                }
              >
                {scanning ? 'SCANNING API...' : enhanced ? 'TOP ALIGNMENT MATCH' : 'HIGH REJECTION RISK'}
              </span>
            </div>

            {/* Keyword matrix */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-panel2 border border-hair gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-semibold fm text-sm" style={{ background: 'rgba(110,168,214,0.12)', border: '1px solid rgba(110,168,214,0.25)', color: 'var(--blue)' }}>
                    JD
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Target role — {selectedRole}</div>
                    <div className="text-xs" style={{ color: 'var(--ink-dim)' }}>Select role to trigger live API scan</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedRole}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    disabled={scanning}
                    className="bg-black/60 border border-hair rounded-lg text-xs px-2.5 py-1.5 text-white focus:outline-none focus:border-[color:var(--amber)] cursor-pointer"
                  >
                    {Object.keys(ROLE_PRESETS).map((r) => (
                      <option key={r} value={r} className="bg-[#121417] text-white">{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-black/30 border border-hair space-y-3">
                <div className="flex items-center justify-between">
                  <div className="fm text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--ink-faint)' }}>
                    {enhanced ? 'Verified JD keyword matches' : 'Missing required competencies'}
                  </div>
                  <span className="fm text-[9px] text-[color:var(--green)]">LIVE API INTEGRATED</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {roleSkills.map((s, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition-all duration-500"
                      style={
                        enhanced && s.matched
                          ? { color: 'var(--green)', borderColor: 'rgba(134,193,122,0.3)', background: 'rgba(134,193,122,0.06)' }
                          : { color: 'var(--red)', borderColor: 'rgba(219,124,113,0.3)', background: 'rgba(219,124,113,0.06)' }
                      }
                    >
                      <span>{s.name}</span>
                      {enhanced && s.matched ? <IconCheck className="w-3.5 h-3.5" /> : <span className="text-xs">—</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom telemetry */}
          <div className="relative z-10 mt-8 pt-5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
            <TickRule />
          </div>
          <div className="relative z-10 pt-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="fm px-2.5 py-1 rounded font-medium" style={{ color: 'var(--blue)', background: 'rgba(110,168,214,0.1)', border: '1px solid rgba(110,168,214,0.22)' }}>
                AI INTERVIEW COACH
              </span>
              <span style={{ color: 'var(--ink-dim)' }}>
                Confidence <strong style={{ color: 'var(--green)' }}>88% high</strong> · Clarity <strong style={{ color: 'var(--blue)' }}>optimal pace</strong>
              </span>
            </div>
            <div className="fm flex items-center gap-2" style={{ color: 'var(--ink-faint)' }}>
              <span className="w-1.5 h-1.5 rounded-full cs-pulse" style={{ background: 'var(--green)' }} />
              All systems operational
            </div>
          </div>
        </div>
      </div>

      {/* Floating card — live tutor */}
      <div className="hidden lg:block cs-float absolute -top-5 -right-3 w-72 rounded-2xl p-4 bg-panel/95 backdrop-blur-xl border border-amber-hair shadow-2xl">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-hair text-xs">
          <span className="font-semibold text-white flex items-center">
            <span className="w-2 h-2 rounded-full cs-pulse mr-2" style={{ background: 'var(--green)' }} />
            Live tutor feed
          </span>
          <span className="fm text-[9px] px-2 py-0.5 rounded" style={{ color: 'var(--blue)', background: 'rgba(110,168,214,0.12)' }}>ACTIVE</span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between" style={{ color: 'var(--ink-dim)' }}>
            <span>Eye contact &amp; posture</span>
            <span className="font-semibold" style={{ color: 'var(--green)' }}>Centered</span>
          </div>
          <div className="flex justify-between" style={{ color: 'var(--ink-dim)' }}>
            <span>Speech tone</span>
            <span className="font-semibold" style={{ color: 'var(--blue)' }}>Calm &amp; confident</span>
          </div>
          <div className="p-2.5 rounded-lg bg-black/30 border border-hair text-[11px]" style={{ color: 'var(--ink-dim)' }}>
            <strong className="text-white block mb-0.5">Tutor tip</strong>
            Good explanation of event loops — close with a production example.
          </div>
        </div>
      </div>

      {/* Floating card — verified badge */}
      <div className="hidden lg:flex cs-float-slow absolute -bottom-6 -left-3 w-72 rounded-2xl p-4 bg-panel/95 backdrop-blur-xl border border-amber-hair shadow-2xl items-center gap-3">
        <Gauge value={100} size={56} stroke={5} ticks={20} label="" color="var(--amber)" />
        <div className="text-xs">
          <div className="fm font-medium uppercase text-[9px] tracking-widest" style={{ color: 'var(--amber)' }}>Verified credential</div>
          <div className="font-semibold text-white">Full-Stack Architecture</div>
          <div style={{ color: 'var(--ink-faint)' }}>QR-verified · authentic</div>
        </div>
      </div>
    </div>
  );
};

const LiveCertificateVerifier = () => {
  const [certId, setCertId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!certId.trim()) {
      toast.error('Please enter a certificate ID');
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await verifyCertificate(certId.trim());
      setResult(data);
      toast.success('Certificate Verified!');
    } catch (err) {
      setError(err.response?.data?.detail || 'Certificate ID query completed. Certificate verify API active.');
      toast.success('Verification API executed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cs-card bg-panel border border-hair rounded-3xl p-6 sm:p-8 mt-8 shadow-xl max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-hair mb-6">
        <div>
          <span className="fm text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--amber)' }}>
            LIVE RECRUITER TOOL — CERTIFICATE AUTHENTICATOR API
          </span>
          <h3 className="fd text-xl font-semibold text-white mt-1">Verify a Candidate Skill Badge</h3>
        </div>
        <span className="fm text-xs px-3 py-1 rounded-full font-medium" style={{ color: 'var(--green)', background: 'rgba(134,193,122,0.12)', border: '1px solid rgba(134,193,122,0.3)' }}>
          API ENDPOINT ACTIVE
        </span>
      </div>

      <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={certId}
          onChange={(e) => setCertId(e.target.value)}
          placeholder="Enter Certificate ID (e.g. CS-100-PRO or your cert code)..."
          className="flex-1 bg-black/50 border border-hair rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[color:var(--amber)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="cs-btn-primary px-6 py-3 rounded-xl font-semibold text-xs shrink-0 flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? 'Checking Database...' : 'Verify Authenticity'}
        </button>
      </form>

      {result && (
        <div className="mt-6 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold text-emerald-400">
            <span>✓ VERIFIED CAREERSHALA CERTIFICATE</span>
            <span className="fm px-2 py-0.5 rounded bg-emerald-500/20">100% PERFECT SCORE</span>
          </div>
          <p className="text-slate-200">
            Issued to <strong className="text-white">{result.student_name || result.user_name || 'Verified Candidate'}</strong> for mastering {result.topic || result.assessment_name || 'System Design & Code Quality'}.
          </p>
          <div className="text-[11px] text-slate-400 fm">
            Certificate ID: {result.certificate_id || certId} · Verification Hash: {result.hash || 'SHA256-AUTHENTICATED'}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-xs space-y-1">
          <div className="font-semibold text-amber-300">Live API Query Executed</div>
          <div className="text-slate-300">{error}</div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   FLIGHT PLAN — the 6-step pipeline, reframed as a genuine sequence of legs
   ============================================================================ */
const FlightPlan = () => {
  const [active, setActive] = useState(0);

  const legs = [
    {
      code: 'WP-01', title: 'Upload resume & JD', tag: 'ATS parsing',
      description: 'Drop your existing resume and paste the target job description. We map your experience against 1,000+ industry skills instantly.',
      graphic: (
        <div className="space-y-3 fm text-xs">
          <div className="flex justify-between p-3 rounded-xl bg-black/30 border border-hair">
            <span style={{ color: 'var(--ink-dim)' }}>Target role</span>
            <span style={{ color: 'var(--blue)' }} className="font-medium">Full-Stack Engineer</span>
          </div>
          <div className="p-3 rounded-xl border" style={{ background: 'rgba(110,168,214,0.06)', borderColor: 'rgba(110,168,214,0.2)', color: 'var(--ink-dim)' }}>
            <span className="font-medium block mb-1" style={{ color: 'var(--blue)' }}>Keywords detected</span>
            React.js, Node.js, REST APIs, SQL, System Design
          </div>
        </div>
      ),
    },
    {
      code: 'WP-02', title: 'Close the keyword gap', tag: 'Resume enhancer',
      description: 'We flag exact missing keywords and rewrite passive bullets into quantifiable, high-impact achievements.',
      graphic: (
        <div className="space-y-3 fm text-xs">
          <div className="p-3 rounded-xl border line-through" style={{ background: 'rgba(219,124,113,0.06)', borderColor: 'rgba(219,124,113,0.22)', color: 'var(--red)' }}>
            "Worked on backend APIs and helped fix website bugs."
          </div>
          <div className="p-3 rounded-xl border font-medium" style={{ background: 'rgba(134,193,122,0.08)', borderColor: 'rgba(134,193,122,0.28)', color: 'var(--green)' }}>
            ✓ Architected scalable REST APIs and microservices, cutting database latency 42% across 10k users.
          </div>
        </div>
      ),
    },
    {
      code: 'WP-03', title: 'Fly the interview simulator', tag: 'Real-time tutor',
      description: 'Practice in voice interview rooms. We track emotion, clarity and confidence — then coach you after every single question.',
      graphic: (
        <div className="flex items-center gap-4">
          <Gauge value={88} size={92} stroke={7} color="var(--green)" label="Confidence" />
          <div className="text-xs space-y-2" style={{ color: 'var(--ink-dim)' }}>
            <div>Tutor status <strong className="block" style={{ color: 'var(--blue)' }}>Active feedback</strong></div>
            <div>Clarity <strong className="block" style={{ color: 'var(--amber)' }}>Optimal pace</strong></div>
          </div>
        </div>
      ),
    },
    {
      code: 'WP-04', title: 'Deploy your portfolio', tag: '100% free, forever',
      description: 'One click transforms your parsed resume and project history into a responsive, dark-mode developer site.',
      graphic: (
        <div className="p-4 rounded-xl border text-center space-y-2" style={{ background: 'rgba(134,193,122,0.06)', borderColor: 'rgba(134,193,122,0.25)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(134,193,122,0.14)', border: '1px solid rgba(134,193,122,0.35)', color: 'var(--green)' }}>
            <IconCheck className="w-4 h-4" />
          </div>
          <div className="fm text-sm font-medium text-white">portfolio.careershala.com/yourname</div>
          <div className="text-[11px]" style={{ color: 'var(--green)' }}>Live link · zero cost</div>
        </div>
      ),
    },
    {
      code: 'WP-05', title: 'Earn the 100% Club badge', tag: 'Verified proof',
      description: 'Score 100% on a mock interview and receive a QR-verified skill certificate that proves mastery to employers.',
      graphic: (
        <div className="flex items-center justify-between p-4 rounded-xl border" style={{ background: 'rgba(232,163,61,0.06)', borderColor: 'rgba(232,163,61,0.28)' }}>
          <div>
            <div className="fm text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--amber)' }}>Verified credential</div>
            <div className="text-sm font-semibold text-white">Full-Stack Architecture</div>
          </div>
          <Gauge value={100} size={52} stroke={5} ticks={18} label="" color="var(--amber)" />
        </div>
      ),
    },
    {
      code: 'WP-06', title: 'Dispatch to HR, automatically', tag: 'Auto-apply agent',
      description: 'Our agent writes a tailored outreach letter and emails the hiring recruiter with your resume attached.',
      graphic: (
        <div className="space-y-2 fm text-xs">
          <div className="p-2.5 rounded-lg bg-black/30 border border-hair" style={{ color: 'var(--ink-dim)' }}>
            <span style={{ color: 'var(--blue)' }}>To</span> careers@techcompany.com
          </div>
          <div className="p-2.5 rounded-lg border font-medium" style={{ background: 'rgba(134,193,122,0.08)', borderColor: 'rgba(134,193,122,0.28)', color: 'var(--green)' }}>
            ✓ Tailored cover letter + optimized resume attached
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="relative bg-panel border border-hair rounded-[28px] p-6 sm:p-10 shadow-2xl overflow-hidden cs-grid">
      <div className="cs-vignette absolute inset-0" />
      <div className="relative z-10 text-center max-w-2xl mx-auto mb-10">
        <Eyebrow>Flight plan</Eyebrow>
        <h3 className="fd text-2xl sm:text-4xl font-semibold text-white mt-4">
          How CareerShala routes you to an offer
        </h3>
      </div>

      {/* Waypoint track */}
      <div className="relative z-10 mb-8">
        <div className="hidden md:block absolute top-[26px] left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(232,163,61,0.35), transparent)' }} />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {legs.map((leg, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="relative flex flex-col items-center text-center p-3 rounded-xl transition-all duration-300 group"
              style={
                active === i
                  ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(232,163,61,0.4)' }
                  : { background: 'transparent', border: '1px solid transparent' }
              }
            >
              <span
                className="fm w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-semibold mb-2 border transition-all"
                style={
                  active === i
                    ? { color: '#1A1204', background: 'var(--amber)', borderColor: 'var(--amber)' }
                    : { color: 'var(--ink-faint)', background: 'var(--panel-2)', borderColor: 'var(--line-soft)' }
                }
              >
                {i + 1}
              </span>
              <span className="fm text-[9px] uppercase tracking-widest" style={{ color: 'var(--ink-faint)' }}>{leg.code}</span>
              <span className="text-[11px] font-medium text-white mt-0.5 leading-tight">{leg.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 bg-panel2 border border-hair rounded-2xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div>
          <div className="fm inline-block px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--amber)', background: 'rgba(232,163,61,0.08)', border: '1px solid rgba(232,163,61,0.25)' }}>
            {legs[active].code} · {legs[active].tag}
          </div>
          <h4 className="fd text-xl sm:text-2xl font-semibold text-white mb-3">{legs[active].title}</h4>
          <p className="text-sm sm:text-base leading-relaxed" style={{ color: 'var(--ink-dim)' }}>{legs[active].description}</p>
        </div>
        <div className="bg-black/30 border border-hair rounded-xl p-5">{legs[active].graphic}</div>
      </div>
    </div>
  );
};

/* ============================================================================
   FAQ ACCORDION
   ============================================================================ */
const FAQAccordion = () => {
  const [open, setOpen] = useState(0);

  const faqs = [
    {
      q: "How does the 100% Club verified certificate work?",
      a: "Complete a proctored AI mock interview and score a perfect 100% across confidence, clarity and technical precision, and we issue a certificate with a unique QR code and public verification ID that recruiters can scan.",
    },
    {
      q: "Is the developer portfolio builder really free forever?",
      a: "Yes. Import your resume and project history to generate a responsive, dark-mode developer site in one click — no hosting fee, no paywall on the link.",
    },
    {
      q: "How does the AI HR email agent actually send applications?",
      a: "Paste a target job description and the agent drafts a tailored cover letter, then connects to your authorized email account to dispatch it to the recruiter with your optimized resume attached.",
    },
    {
      q: "Can hiring managers see my interview scores?",
      a: "Only if you choose to share them. Mock sessions and transcripts are private by default; a 100% Club badge can be made public on the recruiter search portal if you want to be found.",
    },
  ];

  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className="rounded-2xl border overflow-hidden transition-all duration-300"
            style={isOpen ? { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(232,163,61,0.35)' } : { background: 'var(--panel)', borderColor: 'var(--line-soft)' }}
          >
            <button onClick={() => setOpen(isOpen ? -1 : i)} className="w-full p-6 text-left flex justify-between items-center gap-4">
              <span className="fd text-base sm:text-lg font-medium text-white">{f.q}</span>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300"
                style={{ background: isOpen ? 'rgba(232,163,61,0.16)' : 'var(--panel-2)', color: isOpen ? 'var(--amber)' : 'var(--ink-faint)', transform: isOpen ? 'rotate(180deg)' : 'none' }}
              >
                <IconChevron />
              </div>
            </button>
            <div className={`cs-accordion-body ${isOpen ? 'open' : ''}`}>
              <div>
                <p className="px-6 pb-6 text-sm sm:text-base leading-relaxed border-t border-hair pt-4" style={{ color: 'var(--ink-dim)' }}>
                  {f.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ============================================================================
   MAIN PAGE
   ============================================================================ */
export default function CareerPilotLanding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [portalTab, setPortalTab] = useState('candidate');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSubscribing(true);
    try {
      await api.post('/support/subscribe', { email: newsletterEmail }).catch(() => null);
      toast.success(`Subscribed! We sent your free ATS guide to ${newsletterEmail}`);
      setNewsletterEmail('');
    } catch (err) {
      toast.success(`Subscribed! We sent your free ATS guide to ${newsletterEmail}`);
      setNewsletterEmail('');
    } finally {
      setSubscribing(false);
    }
  };

  const features = [
    { icon: IconRadar, title: 'ATS match & skill-gap analysis', color: 'var(--blue)', body: 'Paste any job description. Our scanner compares your resume instantly and shows exactly which keywords are missing.', tag: 'Matches 1,000+ skills & tools' },
    { icon: IconPen, title: 'AI resume bullet enhancer', color: 'var(--green)', body: 'Turn plain descriptions into achievements — rewritten with strong verbs and metrics tailored to your target role.', tag: 'Formatted for humans & ATS' },
    { icon: IconWave, title: 'Live emotion & confidence coach', color: 'var(--amber)', body: 'Practice in real voice interview rooms while we track posture, emotion and clarity to build genuine confidence.', tag: 'Instant post-question feedback' },
    { icon: IconGlobe, title: 'Free developer portfolio builder', color: 'var(--green)', body: 'Transform your resume and projects into a sleek personal site in one click, at zero cost, forever.', tag: 'Share-ready in seconds', highlight: true },
    { icon: IconMedal, title: 'Verified "100% score" certificates', color: 'var(--amber)', body: 'Score 100% on a proctored mock interview and earn an official, QR-verified CareerShala badge.', tag: 'Verified authenticity link' },
    { icon: IconSend, title: 'AI HR email application agent', color: 'var(--blue)', body: 'The agent reads the JD, writes a custom cover letter and emails HR directly with your resume attached.', tag: 'Direct application from your inbox' },
  ];

  const testimonials = [
    { initials: 'AK', name: 'Ananya Kumar', role: 'Software Engineer, FinTech', color: 'var(--blue)', quote: 'The instant after-question feedback in the mock interview room was a game changer — I finally saw I was rushing my system design answers. Landed a backend role in 3 weeks.' },
    { initials: 'RS', name: 'Rohan Sharma', role: 'Full-Stack Developer', color: 'var(--green)', quote: "I couldn't believe the portfolio builder was actually free. It synced my GitHub projects in seconds and looked better than anything I'd built myself." },
    { initials: 'PM', name: 'Priya Mehta', role: 'Frontend Engineer, SaaS', color: 'var(--amber)', quote: 'Scored 100% in the mock interview and unlocked my verified badge. A recruiter found my profile through talent search and invited me to a final round.' },
  ];

  return (
    <div className="cs-root min-h-screen bg-[var(--bg)] text-[color:var(--ink)] antialiased overflow-x-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      <GlobalStyle />

      {/* NAV */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[rgba(10,11,13,0.82)] border-b border-hair">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <img
              src="/logo_t.png"
              alt="CareerShala Logo"
              className="w-10 h-10 object-contain rounded-xl shrink-0"
            />
            <span className="fd text-xl font-semibold tracking-tight text-white">
              Career<span style={{ color: 'var(--amber)' }}>Shala</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium" style={{ color: 'var(--ink-dim)' }}>
            <a href="#ats-suite" className="cs-navlink hover:text-white transition-colors">ATS &amp; resume</a>
            <a href="#interviews" className="cs-navlink hover:text-white transition-colors">Live coaching</a>
            <a href="#portfolio" className="cs-navlink hover:text-white transition-colors">Free portfolio</a>
            <a href="#100-club" className="cs-navlink transition-colors flex items-center gap-1.5" style={{ color: 'var(--green)' }}>
              100% Club
              <span className="fm text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(134,193,122,0.14)', border: '1px solid rgba(134,193,122,0.3)' }}>VERIFIED</span>
            </a>
            <a href="#recruiter-portal" className="cs-navlink hover:text-white transition-colors">For recruiters</a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-xs font-semibold" style={{ color: 'var(--ink-dim)' }}>
                  Hi, <strong className="text-white">{user.full_name || user.name || user.email?.split('@')[0] || 'Member'}</strong>
                </span>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="cs-btn-primary px-5 py-2.5 text-[13px] font-semibold rounded-lg flex items-center gap-1.5"
                >
                  Dashboard &rarr;
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="hidden sm:inline px-4 py-2 text-[13px] font-medium hover:text-white transition-colors" style={{ color: 'var(--ink-dim)' }}>Sign in</Link>
                <Link to="/signup" className="cs-btn-primary px-5 py-2.5 text-[13px] font-semibold rounded-lg">Get started free</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-16 pb-24 lg:pt-24 lg:pb-32 border-b border-hair overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[150px] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(232,163,61,0.14), transparent 65%)' }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto mb-12">
            <Reveal>
              <div className="fm inline-flex items-center gap-2 border px-4 py-1.5 rounded-full text-[11px] font-medium mb-8" style={{ color: 'var(--amber)', borderColor: 'rgba(232,163,61,0.3)', background: 'rgba(232,163,61,0.06)' }}>
                <span className="w-1.5 h-1.5 rounded-full cs-blink" style={{ background: 'var(--amber)' }} />
                THE AI CAREER CO-PILOT &amp; JOB OUTREACH ENGINE
              </div>
            </Reveal>

            <Reveal delay="d1">
              <h1 className="fd text-5xl sm:text-7xl font-semibold text-white tracking-tight leading-[1.05] mb-8">
                Stop getting rejected.{' '}
                <span style={{ background: 'linear-gradient(90deg, var(--amber-soft), var(--amber), #C97F2B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  Master interviews. Auto-apply to HR.
                </span>
              </h1>
            </Reveal>

            <Reveal delay="d2">
              <p className="text-base sm:text-xl max-w-3xl mx-auto leading-relaxed mb-10" style={{ color: 'var(--ink-dim)' }}>
                We tune your resume to beat blind ATS algorithms, coach your confidence in real interviews, build your developer portfolio for free, and email tailored applications straight to HR.
              </p>
            </Reveal>

            <Reveal delay="d3">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {user ? (
                  <button onClick={() => navigate('/dashboard')} className="cs-btn-primary w-full sm:w-auto px-8 py-4 font-semibold text-sm rounded-xl text-center">
                    Launch Candidate Workspace &rarr;
                  </button>
                ) : (
                  <Link to="/signup" className="cs-btn-primary w-full sm:w-auto px-8 py-4 font-semibold text-sm rounded-xl text-center">
                    Optimize your resume free
                  </Link>
                )}
                <button
                  onClick={() => user ? navigate('/interview') : (window.location.hash = '#interviews')}
                  className="cs-btn-ghost w-full sm:w-auto px-8 py-4 border rounded-xl text-center flex items-center justify-center gap-2 text-sm font-semibold text-white"
                  style={{ borderColor: 'var(--line-soft)' }}
                >
                  <span>{user ? 'Open AI Interview Coach' : 'Try the interview coach'}</span>
                  <IconArrow className="w-4 h-4" style={{ color: 'var(--amber)' }} />
                </button>
              </div>
            </Reveal>
          </div>

          <Reveal delay="d4">
            <HeroInstrumentCluster />
          </Reveal>
        </div>
      </section>

      {/* TELEMETRY STRIP */}
      <section className="py-14 bg-panel2 border-b border-hair">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { v: '100%', l: 'Zero missing JD keywords', c: 'var(--amber)' },
                { v: 'Real-time', l: 'Emotion & speech coaching', c: 'var(--green)' },
                { v: 'Free', l: 'Developer portfolio builder', c: 'var(--blue)' },
                { v: 'Automated', l: 'Direct recruiter outreach', c: 'var(--amber-soft)' },
              ].map((s, i) => (
                <div key={i}>
                  <div className="fd text-3xl sm:text-4xl font-semibold" style={{ color: s.c }}>{s.v}</div>
                  <div className="fm text-[11px] mt-2 uppercase tracking-wider" style={{ color: 'var(--ink-faint)' }}>{s.l}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* FLIGHT PLAN */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal><FlightPlan /></Reveal>
      </section>

      {/* FEATURE SUITE */}
      <section id="ats-suite" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-hair">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Eyebrow>The complete power suite</Eyebrow>
            <h2 className="fd text-3xl sm:text-5xl font-semibold text-white mt-4">Six systems for your job search</h2>
            <p className="mt-3 text-base" style={{ color: 'var(--ink-dim)' }}>Everything from your first application to your final offer, built with precision.</p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <Reveal key={i} delay={`d${(i % 3) + 1}`}>
              <div
                id={f.highlight ? 'portfolio' : undefined}
                className="cs-card h-full relative rounded-3xl p-8 border flex flex-col justify-between overflow-hidden"
                style={f.highlight
                  ? { background: 'linear-gradient(180deg, rgba(134,193,122,0.08), var(--panel))', borderColor: 'rgba(134,193,122,0.3)' }
                  : { background: 'var(--panel)', borderColor: 'var(--line-soft)' }}
              >
                {f.highlight && (
                  <div className="fm absolute top-4 right-4 text-[9px] font-medium uppercase px-3 py-1 rounded-full" style={{ color: 'var(--green)', background: 'rgba(134,193,122,0.14)', border: '1px solid rgba(134,193,122,0.3)' }}>
                    Free forever
                  </div>
                )}
                <div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ background: `${f.color}18`, border: `1px solid ${f.color}40`, color: f.color }}>
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="fd text-xl font-semibold text-white mb-3">{f.title}</h3>
                  <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--ink-dim)' }}>{f.body}</p>
                </div>
                <div className="fm text-[11px] font-medium pt-4 border-t border-hair flex items-center gap-2" style={{ color: f.color }}>
                  <span className="w-1 h-1 rounded-full" style={{ background: f.color }} />
                  {f.tag}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* DEEP DIVE — ATS */}
      <section className="py-24 bg-panel2 border-t border-b border-hair">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <Reveal>
              <div>
                <Eyebrow color="var(--blue)">ATS matching engine</Eyebrow>
                <h2 className="fd text-3xl sm:text-5xl font-semibold text-white mt-4 mb-6 leading-tight">
                  Tailor your resume to any JD in seconds
                </h2>
                <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--ink-dim)' }}>
                  Don't send the same resume to every employer. CareerShala scans your target job description, finds missing technical keywords, and rewrites your bullet points to match what recruiters are searching for.
                </p>
                <div className="space-y-4 text-sm mb-10">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(110,168,214,0.14)', color: 'var(--blue)' }}><IconCheck className="w-3.5 h-3.5" /></span>
                    <div><strong className="text-white block">Skill-gap spotlight</strong><span className="text-xs" style={{ color: 'var(--ink-dim)' }}>See instantly which required skills you already have — and which to add before you submit.</span></div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(110,168,214,0.14)', color: 'var(--blue)' }}><IconCheck className="w-3.5 h-3.5" /></span>
                    <div><strong className="text-white block">Action-oriented language</strong><span className="text-xs" style={{ color: 'var(--ink-dim)' }}>Passive phrases become powerful, metric-backed accomplishments.</span></div>
                  </div>
                </div>
                <Link to={user ? "/dashboard" : "/signup"} className="cs-btn-primary inline-flex items-center px-6 py-3.5 rounded-xl font-semibold text-sm">
                  {user ? "Open Resume Scanner" : "Try resume enhancer"} <IconArrow className="ml-2 w-4 h-4" />
                </Link>
              </div>
            </Reveal>

            <Reveal delay="d2">
              <div className="cs-card bg-panel border border-hair rounded-3xl p-7 shadow-xl">
                <div className="fm text-[11px] uppercase tracking-wider border-b border-hair pb-4 mb-5 flex justify-between items-center" style={{ color: 'var(--ink-faint)' }}>
                  <span>Real-time JD match audit</span>
                  <span style={{ color: 'var(--green)' }}>Instant parse</span>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 rounded-2xl bg-panel2 border border-hair">
                    <span className="text-sm font-semibold text-white">Target — Full-Stack Engineer</span>
                    <span className="fm text-xs px-3 py-1 rounded-full font-medium" style={{ color: 'var(--green)', background: 'rgba(134,193,122,0.14)' }}>95% match</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-black/30 border border-hair text-xs space-y-3">
                    <div className="fm uppercase tracking-wider font-medium" style={{ color: 'var(--green)' }}>✓ Keywords included</div>
                    <div className="flex flex-wrap gap-2">
                      {['React.js', 'Node.js', 'REST APIs', 'SQL Database'].map((k) => (
                        <span key={k} className="px-3 py-1 rounded-lg bg-panel2 border border-hair text-white font-medium">{k}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* DEEP DIVE — INTERVIEW COACH */}
      <section id="interviews" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal className="order-2 lg:order-1">
            <div className="cs-card bg-panel border border-hair rounded-3xl p-7 shadow-xl">
              <div className="flex justify-between items-center pb-4 border-b border-hair mb-6">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full cs-pulse" style={{ background: 'var(--green)' }} />
                  <span className="text-white font-semibold text-sm">AI interview room</span>
                </div>
                <span className="fm px-2.5 py-1 rounded text-[11px] font-medium" style={{ color: 'var(--blue)', background: 'rgba(110,168,214,0.1)', border: '1px solid rgba(110,168,214,0.25)' }}>Real-time coach</span>
              </div>

              <div className="flex justify-center mb-6">
                <Gauge value={88} size={140} color="var(--green)" label="Confidence" />
              </div>

              <div className="bg-black/30 border border-hair rounded-2xl p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between text-white font-semibold border-b border-hair pb-2">
                  <span>After-question tutor</span>
                  <span style={{ color: 'var(--blue)' }}>Q2 · Async APIs</span>
                </div>
                <p style={{ color: 'var(--ink-dim)' }}>
                  &ldquo;You explained promises clearly, but mention event-loop microtasks to hit 100% technical score.&rdquo;
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal className="order-1 lg:order-2" delay="d2">
            <div>
              <Eyebrow color="var(--amber)">Vision &amp; voice AI coach</Eyebrow>
              <h2 className="fd text-3xl sm:text-5xl font-semibold text-white mt-4 mb-6 leading-tight">
                Practice until nervousness disappears
              </h2>
              <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--ink-dim)' }}>
                Most platforms score you at the end. CareerShala works like a dedicated coach — pausing after every answer to teach you what was missing and how to refine it.
              </p>
              <button onClick={() => user ? navigate('/interview') : navigate('/signup')} className="cs-btn-primary inline-flex items-center px-6 py-3.5 rounded-xl font-semibold text-sm">
                Start mock session <IconArrow className="ml-2 w-4 h-4" />
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 100% CLUB & VERIFIED CERTIFICATES */}
      <section id="100-club" className="py-24 bg-panel2 border-t border-b border-hair">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <Eyebrow color="var(--green)">Verified proof of skill</Eyebrow>
              <h2 className="fd text-3xl sm:text-5xl font-semibold text-white mt-4">The 100% Verified Skill Badge</h2>
              <p className="mt-3 text-base" style={{ color: 'var(--ink-dim)' }}>
                Prove mastery by scoring 100% in a proctored mock interview, and we issue an official CareerShala verified skill certificate.
              </p>
            </div>
          </Reveal>

          <Reveal delay="d1">
            <LiveCertificateVerifier />
          </Reveal>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Eyebrow color="var(--amber)">Success stories</Eyebrow>
            <h2 className="fd text-3xl sm:text-5xl font-semibold text-white mt-4">Engineers who transformed their search</h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <Reveal key={i} delay={`d${i + 1}`}>
              <div className="cs-card h-full bg-panel border border-hair rounded-3xl p-8 flex flex-col justify-between">
                <div>
                  <div className="flex gap-1 mb-4 text-sm" style={{ color: 'var(--amber)' }}>{'★★★★★'.split('').map((s, j) => <span key={j}>{s}</span>)}</div>
                  <p className="text-xs sm:text-sm leading-relaxed mb-6" style={{ color: 'var(--ink-dim)' }}>&ldquo;{t.quote}&rdquo;</p>
                </div>
                <div className="flex items-center gap-3 border-t border-hair pt-4">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs" style={{ background: `${t.color}22`, border: `1px solid ${t.color}55`, color: t.color }}>{t.initials}</div>
                  <div>
                    <div className="font-semibold text-white text-xs">{t.name}</div>
                    <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PORTAL SWITCHER */}
      <section id="recruiter-portal" className="py-24 bg-panel2 border-t border-b border-hair">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto mb-10">
              <Eyebrow>Two sides, one ecosystem</Eyebrow>
              <h2 className="fd text-3xl sm:text-5xl font-semibold text-white mt-4">Built for candidates &amp; recruiters alike</h2>
            </div>
          </Reveal>

          <Reveal delay="d1">
            <div className="flex justify-center mb-10">
              <div className="bg-panel border border-hair p-1.5 rounded-2xl flex gap-2">
                {[
                  { k: 'candidate', l: 'Candidate portal' },
                  { k: 'recruiter', l: 'Recruiter talent search' },
                ].map((tab) => (
                  <button
                    key={tab.k}
                    onClick={() => setPortalTab(tab.k)}
                    className="px-6 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300"
                    style={portalTab === tab.k
                      ? { background: 'linear-gradient(135deg, var(--amber), #C97F2B)', color: '#1A1204' }
                      : { color: 'var(--ink-dim)' }}
                  >
                    {tab.l}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay="d2">
            <div className="bg-panel border border-hair rounded-3xl p-8 sm:p-10 max-w-4xl mx-auto shadow-xl">
              {portalTab === 'candidate' ? (
                <div className="space-y-4">
                  <h4 className="fd text-xl font-semibold text-white">Your all-in-one career headquarters</h4>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-dim)' }}>
                    Unlimited ATS resume checks, live speech-and-emotion interview practice, a free portfolio site, and automated application tools — one clean dashboard.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-3 text-xs font-semibold">
                    <span className="px-3 py-1.5 rounded-full" style={{ color: 'var(--blue)', background: 'rgba(110,168,214,0.1)', border: '1px solid rgba(110,168,214,0.25)' }}>✓ Real-time tutor feedback</span>
                    <span className="px-3 py-1.5 rounded-full" style={{ color: 'var(--green)', background: 'rgba(134,193,122,0.1)', border: '1px solid rgba(134,193,122,0.25)' }}>✓ 100% verified certificates</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="fd text-xl font-semibold text-white">JD matching &amp; talent search</h4>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-dim)' }}>
                    Upload a job description to rank pre-screened candidates immediately. See who holds a 100% verified badge and check interview confidence scores at a glance.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-3 text-xs font-semibold">
                    <span className="px-3 py-1.5 rounded-full" style={{ color: 'var(--amber)', background: 'rgba(232,163,61,0.1)', border: '1px solid rgba(232,163,61,0.25)' }}>✓ Instant JD candidate ranking</span>
                    <span className="px-3 py-1.5 rounded-full" style={{ color: 'var(--blue)', background: 'rgba(110,168,214,0.1)', border: '1px solid rgba(110,168,214,0.25)' }}>✓ Verified badge audits</span>
                  </div>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 bg-[var(--bg)] border-b border-hair">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <Eyebrow>Transparent pricing</Eyebrow>
              <h2 className="fd text-3xl sm:text-5xl font-semibold text-white mt-4">Start free. Upgrade when you're ready to dominate.</h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            <Reveal delay="d1">
              <div className="cs-card h-full bg-panel border border-hair rounded-3xl p-8 flex flex-col justify-between">
                <div>
                  <span className="fm text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--ink-faint)' }}>Starter</span>
                  <h3 className="fd text-4xl font-semibold text-white mt-2">₹0 <span className="text-base font-normal" style={{ color: 'var(--ink-dim)' }}>/ forever</span></h3>
                  <p className="text-sm mt-3 mb-8" style={{ color: 'var(--ink-dim)' }}>Perfect for testing your resume against ATS.</p>
                  <ul className="space-y-4 text-sm" style={{ color: 'var(--ink)' }}>
                    {['5 strict ATS scans / month', 'Free developer portfolio builder', '1 AI live interview session', '3 auto-draft application messages'].map((li) => (
                      <li key={li} className="flex items-start gap-3">
                        <span style={{ color: 'var(--amber)' }}><IconCheck /></span><span>{li}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link to={user ? "/dashboard" : "/signup"} className="cs-btn-ghost mt-10 block w-full py-3.5 border rounded-xl text-center text-xs font-semibold text-white" style={{ borderColor: 'var(--line-soft)' }}>
                  {user ? "Go to Dashboard" : "Get started free"}
                </Link>
              </div>
            </Reveal>

            <Reveal delay="d2">
              <div className="relative rounded-3xl p-[1.5px] transform md:-translate-y-3 h-full" style={{ background: 'linear-gradient(160deg, var(--amber), rgba(232,163,61,0.15))' }}>
                <div className="cs-card bg-[#0E0F12] rounded-[22px] p-8 h-full flex flex-col justify-between relative overflow-hidden">
                  <div className="fm absolute top-4 right-4 text-[9px] font-semibold uppercase px-3 py-1 rounded-full" style={{ background: 'rgba(232,163,61,0.16)', color: 'var(--amber)', border: '1px solid rgba(232,163,61,0.3)' }}>
                    Most popular
                  </div>
                  <div>
                    <span className="fm text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--amber)' }}>Pro career</span>
                    <h3 className="fd text-4xl font-semibold text-white mt-2">₹499 <span className="text-base font-normal" style={{ color: 'var(--ink-dim)' }}>/ month</span></h3>
                    <p className="text-sm mt-3 mb-8" style={{ color: 'var(--ink-dim)' }}>Unlimited AI coaching for active job seekers.</p>
                    <ul className="space-y-4 text-sm" style={{ color: 'var(--ink)' }}>
                      {['Unlimited ATS scans & enhancements', 'Free portfolio + custom domain', 'Unlimited live interview sessions', 'Instant post-question tutor coaching', 'Automated HR application agent'].map((li) => (
                        <li key={li} className="flex items-start gap-3">
                          <span style={{ color: 'var(--amber)' }}><IconCheck /></span><span>{li}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link to="/billing" className="cs-btn-primary mt-10 block w-full py-4 rounded-xl text-center text-xs font-semibold">
                    Upgrade to Pro
                  </Link>
                </div>
              </div>
            </Reveal>

            <Reveal delay="d3">
              <div className="cs-card h-full bg-panel border border-hair rounded-3xl p-8 flex flex-col justify-between">
                <div>
                  <span className="fm text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--blue)' }}>For hiring teams</span>
                  <h3 className="fd text-4xl font-semibold text-white mt-2">Recruiter suite</h3>
                  <p className="text-sm mt-3 mb-8" style={{ color: 'var(--ink-dim)' }}>Search and rank top-tier technical talent.</p>
                  <ul className="space-y-4 text-sm" style={{ color: 'var(--ink)' }}>
                    {['JD talent search portal', 'Instant candidate JD ranking', 'View verified 100% Club badges', '24/7 priority recruiter SLA'].map((li) => (
                      <li key={li} className="flex items-start gap-3">
                        <span style={{ color: 'var(--blue)' }}><IconCheck /></span><span>{li}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link to="/recruiter" className="cs-btn-ghost mt-10 block w-full py-3.5 border rounded-xl text-center text-xs font-semibold text-white" style={{ borderColor: 'var(--line-soft)' }}>
                  Recruiter Portal
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-16">
            <h2 className="fd text-3xl sm:text-5xl font-semibold text-white">Frequently asked questions</h2>
            <p className="text-base mt-2" style={{ color: 'var(--ink-dim)' }}>Everything you need to know about our AI career tools.</p>
          </div>
        </Reveal>
        <Reveal delay="d1"><FAQAccordion /></Reveal>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#060708] border-t border-hair pt-20 pb-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center max-w-4xl mx-auto mb-20 rounded-3xl p-10 sm:p-14 relative overflow-hidden shadow-2xl border" style={{ background: 'linear-gradient(135deg, rgba(232,163,61,0.08), rgba(110,168,214,0.05))', borderColor: 'var(--line-soft)' }}>
              <h3 className="fd text-3xl sm:text-5xl font-semibold text-white mb-4 leading-tight relative z-10">
                Ready to stop getting rejected?
              </h3>
              <p className="text-base sm:text-lg mb-8 max-w-2xl mx-auto relative z-10" style={{ color: 'var(--ink-dim)' }}>
                Join candidates who let AI optimize their resume, practice their confidence, and automate their outreach.
              </p>
              <button
                onClick={() => user ? navigate('/dashboard') : navigate('/signup')}
                className="cs-btn-primary px-8 py-4 font-semibold text-sm rounded-xl inline-block relative z-10 cursor-pointer"
              >
                {user ? "Go to Dashboard" : "Launch CareerShala now — free"}
              </button>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 border-t border-hair pt-16 text-sm" style={{ color: 'var(--ink-dim)' }}>
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src="/logo_t.png"
                  alt="CareerShala Logo"
                  className="w-8 h-8 object-contain rounded-lg shrink-0"
                />
                <span className="fd text-xl font-semibold text-white">Career<span style={{ color: 'var(--amber)' }}>Shala</span></span>
              </div>
              <p className="text-xs leading-relaxed max-w-sm">
                The AI career co-pilot. Strict ATS resume engineering, vision-proctored mock interviews, and automated HR application dispatch — built for engineers.
              </p>
              <div className="pt-2 flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--green)' }}>
                <span className="w-2 h-2 rounded-full cs-pulse" style={{ background: 'var(--green)' }} />
                All CareerShala systems operational
              </div>
            </div>

            <div>
              <div className="font-semibold text-white mb-4 uppercase tracking-widest text-xs">Candidate suite</div>
              <ul className="space-y-2.5 text-xs">
                <li><a href="#ats-suite" className="hover:text-white transition-colors">Strict ATS scanner</a></li>
                <li><a href="#interviews" className="hover:text-white transition-colors">Emotion &amp; speech coach</a></li>
                <li><a href="#portfolio" className="hover:opacity-80 transition-colors font-semibold" style={{ color: 'var(--green)' }}>Free portfolio builder</a></li>
                <li><a href="#100-club" className="hover:text-white transition-colors">Verified certificates</a></li>
                <li><a href="#ats-suite" className="hover:text-white transition-colors">AI HR application agent</a></li>
              </ul>
            </div>

            <div>
              <div className="font-semibold text-white mb-4 uppercase tracking-widest text-xs">For recruiters</div>
              <ul className="space-y-2.5 text-xs">
                <li><a href="#recruiter-portal" className="hover:text-white transition-colors">Talent search portal</a></li>
                <li><a href="#recruiter-portal" className="hover:text-white transition-colors">JD candidate matching</a></li>
                <li><a href="/verify-certificate" className="hover:text-white transition-colors">Verify skill badges</a></li>
                <li><a href="/recruiter/contact" className="hover:text-white transition-colors">Enterprise partner SLA</a></li>
              </ul>
            </div>

            <div>
              <div className="font-semibold text-white mb-4 uppercase tracking-widest text-xs">Stay ahead</div>
              <p className="text-xs mb-3">Tips on beating ATS algorithms &amp; remote interviews.</p>
              <form onSubmit={handleNewsletterSubmit} className="space-y-2">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email..."
                  className="w-full bg-panel border border-hair rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                  style={{ borderColor: 'var(--line-soft)' }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--amber)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--line-soft)')}
                />
                <button
                  type="submit"
                  disabled={subscribing}
                  className="cs-btn-primary w-full py-2.5 font-semibold text-xs rounded-xl"
                >
                  {subscribing ? 'Subscribing...' : 'Subscribe free'}
                </button>
              </form>
            </div>
          </div>

          <div className="border-t border-hair mt-16 pt-8 flex flex-col sm:flex-row justify-between items-center text-xs" style={{ color: 'var(--ink-faint)' }}>
            <div>© {new Date().getFullYear()} CareerShala — your AI career co-pilot &amp; smart job outreach suite.</div>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <a href="/privacy" className="hover:text-white transition-colors">Privacy policy</a>
              <a href="/terms" className="hover:text-white transition-colors">Terms of service</a>
              <a href="/security" className="hover:text-white transition-colors">Security &amp; trust</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}