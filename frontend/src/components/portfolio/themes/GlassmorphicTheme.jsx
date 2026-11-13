import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  ExternalLink, 
  Github, 
  Linkedin, 
  Download, 
  Send, 
  ChevronRight, 
  MapPin, 
  User, 
  Menu, 
  X,
  Briefcase,
  GraduationCap,
  Layers,
  ArrowRight,
  Code2,
  Cpu,
  Clock,
  Check,
  Copy,
  Maximize2,
  Mail,
  Zap,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GlassmorphicTheme({
  profile,
  username,
  handleResumeDownload,
  handleContactSubmit,
  contactForm,
  setContactForm,
  sending
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [roleIdx, setRoleIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [activeProjectModal, setActiveProjectModal] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const canvasRef = useRef(null);

  const typingWords = (profile.typing_roles && profile.typing_roles.length > 0)
    ? profile.typing_roles
    : [profile.headline || 'Full-Stack Engineer', 'Systems Architect', 'AI Solutions Developer'];

  useEffect(() => {
    const currentWord = typingWords[roleIdx % typingWords.length];
    let timer;
    if (!isDeleting) {
      if (typedText.length < currentWord.length) {
        timer = setTimeout(() => setTypedText(currentWord.slice(0, typedText.length + 1)), 60);
      } else {
        timer = setTimeout(() => setIsDeleting(true), 2500);
      }
    } else {
      if (typedText.length > 0) {
        timer = setTimeout(() => setTypedText(currentWord.slice(0, typedText.length - 1)), 30);
      } else {
        setIsDeleting(false);
        setRoleIdx((prev) => (prev + 1) % typingWords.length);
      }
    }
    return () => clearTimeout(timer);
  }, [typedText, isDeleting, roleIdx, typingWords]);

  // Particle Refraction Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      radius: Math.random() * 2 + 1,
      color: Math.random() > 0.5 ? '168, 85, 247' : '34, 211, 238'
    }));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, 0.5)`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(168, 85, 247, ${0.2 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      });

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyEmail = () => {
    if (profile.email) {
      navigator.clipboard.writeText(profile.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2200);
    }
  };

  const allProjects = profile.projects || [];
  const projectCategories = ['ALL', ...Array.from(new Set(allProjects.map(p => (p.category || 'FEATURED').toUpperCase()).filter(Boolean)))];
  
  const filteredProjects = activeCategory === 'ALL'
    ? allProjects
    : allProjects.filter(p => (p.category || '').toUpperCase() === activeCategory);

  return (
    <div className="min-h-screen bg-[#070A13] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black relative antialiased">
      
      {/* ── Background Canvas & Aurora Meshes ── */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0 opacity-40" />
      <div className="absolute top-[-20%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-indigo-600/20 via-purple-600/15 to-transparent blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[65vw] h-[65vw] rounded-full bg-gradient-to-tl from-cyan-600/20 via-blue-600/15 to-transparent blur-[180px] pointer-events-none" />

      {/* ── TOP GLASS NAV ── */}
      <header className="sticky top-0 left-0 w-full z-40 pt-4 px-4 sm:px-6 pointer-events-none">
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-7xl mx-auto h-16 bg-slate-900/60 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50 rounded-full flex items-center justify-between px-6 lg:px-8 pointer-events-auto"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-cyan-500/25">
              {(profile.full_name || 'G')[0]}
            </div>
            <div className="flex flex-col">
              <span className="font-black text-white text-sm tracking-tight hidden sm:block">
                {profile.full_name}
              </span>
              <span className="text-[10px] font-mono text-cyan-400 hidden sm:block">
                LUMINA SAAS SUITE
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-slate-400">
            <a href="#about" className="hover:text-cyan-400 transition-colors">Overview</a>
            <a href="#skills" className="hover:text-cyan-400 transition-colors">Arsenal</a>
            <a href="#projects" className="hover:text-cyan-400 transition-colors">Deployments</a>
            <a href="#experience" className="hover:text-cyan-400 transition-colors">Trajectory</a>
            <a href="#contact" className="hover:text-cyan-400 transition-colors">Connect</a>
          </nav>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleResumeDownload}
              className="hidden sm:flex px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-full items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
            >
              <Download size={14} /> Resume
            </motion.button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-300 bg-white/10 rounded-full cursor-pointer"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </motion.div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="md:hidden pointer-events-auto max-w-sm mx-auto mt-3 bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              {['Overview', 'Arsenal', 'Deployments', 'Trajectory', 'Connect'].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase() === 'overview' ? 'about' : item.toLowerCase() === 'arsenal' ? 'skills' : item.toLowerCase() === 'deployments' ? 'projects' : item.toLowerCase() === 'connect' ? 'contact' : item.toLowerCase()}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-sm font-bold text-slate-200 hover:text-cyan-400 uppercase tracking-wider"
                >
                  {item}
                </a>
              ))}
              <button
                onClick={handleResumeDownload}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
              >
                <Download size={14} /> Download Resume
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-32 space-y-16 sm:space-y-24 md:space-y-32 relative z-10">
        
        {/* ── HERO SECTION ── */}
        <section id="about" className="min-h-[70vh] flex flex-col justify-center border-b border-white/10 pb-14 sm:pb-20">
          
          <div className="flex flex-wrap items-center justify-between gap-3 pb-6 sm:pb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-[11px] sm:text-xs font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="truncate max-w-[220px] sm:max-w-none">{profile.hero_badge || 'Available for Strategic Engagements'}</span>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-slate-400">
              <Clock size={13} className="text-cyan-400" />
              <span>LIVE TELEMETRY: {currentTime || '07:30 UTC'}</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">ONLINE</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
            
            <div className="lg:col-span-8 space-y-5 sm:space-y-8">
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-black text-white tracking-tight leading-[1.05] break-words">
                Architecting <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400">
                  Intelligent Systems
                </span>
              </h1>

              <div className="min-h-[28px] sm:min-h-[36px] flex items-center text-lg sm:text-2xl font-bold text-slate-300">
                <span className="text-slate-400 font-normal">Specialized in &nbsp;</span>
                <span className="text-cyan-400 border-r-2 border-cyan-400 pr-1 animate-pulse font-mono">
                  {typedText}
                </span>
              </div>

              <p className="text-sm sm:text-lg text-slate-300 leading-relaxed max-w-2xl font-normal">
                {profile.bio || profile.headline || 'Senior systems engineer dedicated to building high-concurrency cloud infrastructure and AI pipelines.'}
              </p>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2 sm:pt-4">
                <a
                  href="#contact"
                  className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  Initiate Project <ArrowRight size={14} />
                </a>
                <button
                  onClick={handleCopyEmail}
                  className="w-full sm:w-auto px-5 sm:px-6 py-3.5 sm:py-4 bg-white/5 hover:bg-white/10 border border-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {copiedEmail ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-400" />}
                  <span>{copiedEmail ? 'Copied to Clipboard!' : 'Copy Direct Email'}</span>
                </button>
              </div>
            </div>

            {/* Glass Orb Avatar Frame */}
            <div className="lg:col-span-4 flex justify-center lg:justify-end">
              <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-tr from-cyan-500/30 to-purple-600/30 rounded-3xl blur-2xl opacity-60 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative w-56 h-72 sm:w-80 sm:h-96 rounded-3xl overflow-hidden border border-white/20 bg-slate-900/80 backdrop-blur-2xl shadow-2xl flex items-center justify-center">
                  {profile.avatar_url && !avatarFailed ? (
                    <img 
                      src={profile.avatar_url} 
                      alt={profile.full_name} 
                      onError={() => setAvatarFailed(true)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="text-6xl sm:text-7xl font-black text-cyan-400">
                      {(profile.full_name || 'G')[0]}
                    </div>
                  )}

                  <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 bg-slate-900/90 backdrop-blur-xl px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl border border-white/15 text-white flex items-center justify-between text-[11px] sm:text-xs font-mono">
                    <span className="text-slate-400">LOCATION</span>
                    <span className="text-cyan-300 font-bold truncate max-w-[140px]">{profile.location || 'GLOBAL REMOTE'}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Metric Glass Strip */}
          {profile.hero_metrics && profile.hero_metrics.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 pt-10 sm:pt-16 mt-10 sm:mt-16 border-t border-white/10">
              {profile.hero_metrics.map((m, idx) => (
                <div key={idx} className="p-4 sm:p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-1">
                  <div className="text-2xl sm:text-4xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-indigo-300">
                    {m.value}
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 truncate">
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          )}

        </section>

        {/* ── ARSENAL / SKILLS MATRIX ── */}
        <section id="skills" className="space-y-10">
          <div className="flex items-center justify-between border-b border-white/10 pb-6">
            <div>
              <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-widest">Competencies</span>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Technology Stack</h2>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
              <Layers size={20} className="text-cyan-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(profile.skills || {}).map(([category, list], idx) => {
              const skillList = Array.isArray(list) ? list : [];
              return (
                <div 
                  key={idx}
                  className="p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-2xl shadow-xl hover:border-cyan-400/40 transition-all duration-300 space-y-5 group"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <h3 className="font-mono font-bold text-sm uppercase tracking-wider text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      {category}
                    </h3>
                    <span className="text-xs font-mono text-cyan-300 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800">
                      {skillList.length} Units
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {skillList.map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-medium text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-200 hover:border-cyan-400/40 transition-colors cursor-default"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── CURATED DEPLOYMENTS (PROJECTS WITH MACOS CHROME) ── */}
        <section id="projects" className="space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-6">
            <div>
              <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-widest">Deployments</span>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">Production Architectures</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {projectCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCategory(c)}
                  className={`px-4 py-2 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
                    activeCategory === c
                      ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/25'
                      : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white hover:border-white/20'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-16">
            {filteredProjects.map((proj, idx) => (
              <motion.div
                key={idx}
                layout
                className="rounded-3xl bg-slate-900/70 border border-white/10 backdrop-blur-2xl shadow-2xl overflow-hidden hover:border-cyan-400/30 transition-all duration-500 group"
              >
                {/* macOS Window Chrome Header */}
                <div className="px-6 py-4 bg-slate-950/80 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                    <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                    <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
                    <span className="ml-3 text-xs font-mono text-slate-400 hidden sm:inline">
                      https://runtime.{proj.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.cloud
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-white/10 text-cyan-300 border border-cyan-400/20">
                    {proj.category || 'LIVE SYSTEM'}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                  {proj.image_url && (
                    <div className="lg:col-span-6 bg-slate-950/50 border-b lg:border-b-0 lg:border-r border-white/10 overflow-hidden min-h-[320px] relative group/img">
                      <img 
                        src={proj.image_url} 
                        alt={proj.title} 
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-700 ease-out"
                        loading="lazy"
                      />
                      <button
                        onClick={() => setActiveProjectModal(proj)}
                        className="absolute bottom-4 right-4 px-4 py-2 bg-slate-900/90 border border-white/20 text-white rounded-full text-xs font-mono flex items-center gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer shadow-xl"
                      >
                        <Maximize2 size={13} /> Deep Inspect
                      </button>
                    </div>
                  )}

                  <div className={`${proj.image_url ? 'lg:col-span-6' : 'lg:col-span-12'} p-8 sm:p-12 flex flex-col justify-between space-y-6`}>
                    <div className="space-y-4">
                      <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        {proj.title}
                      </h3>
                      <p className="text-base text-slate-300 leading-relaxed font-normal">
                        {proj.description}
                      </p>

                      {proj.highlights && proj.highlights.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 pt-4">
                          {proj.highlights.map((hl, hIdx) => (
                            <div key={hIdx} className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
                              <div className="text-base font-black font-mono text-cyan-300">{hl.value}</div>
                              <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">{hl.label}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-3">
                        {(proj.technologies || []).map((t, tIdx) => (
                          <span key={tIdx} className="px-3 py-1 bg-white/5 border border-white/10 text-cyan-200 text-xs font-mono rounded-lg">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-white/10">
                      {proj.live_url && (
                        <a 
                          href={proj.live_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 text-xs font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 cursor-pointer"
                        >
                          <ExternalLink size={13} /> Live System
                        </a>
                      )}
                      {proj.github_url && (
                        <a 
                          href={proj.github_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5 cursor-pointer"
                        >
                          <Github size={13} /> Architecture Repo
                        </a>
                      )}
                      <button
                        onClick={() => setActiveProjectModal(proj)}
                        className="px-4 py-2.5 text-xs font-mono font-bold text-cyan-400 hover:text-white transition-colors ml-auto cursor-pointer"
                      >
                        Inspect Modal →
                      </button>
                    </div>

                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── CAREER TRAJECTORY ── */}
        {profile.experience && profile.experience.length > 0 && (
          <section id="experience" className="space-y-10">
            <div className="flex items-center justify-between border-b border-white/10 pb-6">
              <div>
                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-widest">Experience</span>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Professional Trajectory</h2>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <Briefcase size={20} className="text-cyan-400" />
              </div>
            </div>

            <div className="space-y-6">
              {profile.experience.map((exp, idx) => (
                <div key={idx} className="p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-xl font-black text-white">{exp.role}</h3>
                      <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider pt-1">
                        {exp.company} {exp.location ? `• ${exp.location}` : ''}
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold px-3 py-1 bg-white/5 border border-white/10 text-slate-300 rounded-full self-start sm:self-auto">
                      {exp.start_date || 'Past'} – {exp.end_date || 'Present'}
                    </span>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed font-normal whitespace-pre-line">
                    {exp.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── EDUCATION ── */}
        {profile.education && profile.education.length > 0 && (
          <section className="space-y-10">
            <div className="flex items-center justify-between border-b border-white/10 pb-6">
              <div>
                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-widest">Credentials</span>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Academic History</h2>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <GraduationCap size={20} className="text-cyan-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {profile.education.map((edu, idx) => (
                <div key={idx} className="p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-2xl space-y-3">
                  <div className="flex justify-between items-start text-xs font-mono text-slate-400">
                    <GraduationCap size={22} className="text-cyan-400" />
                    <span>{edu.graduation_year}</span>
                  </div>
                  <h3 className="text-xl font-black text-white">{edu.degree}</h3>
                  <div className="text-xs font-mono text-slate-400">{edu.institution}</div>
                  {edu.grade && (
                    <div className="text-xs font-mono font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-full inline-block mt-2">
                      GRADE: {edu.grade}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── INQUIRY / ENGAGEMENT ── */}
        <section id="contact" className="space-y-8 max-w-2xl mx-auto pt-8">
          <div className="text-center space-y-3">
            <span className="text-xs font-mono font-black uppercase tracking-widest text-cyan-400 bg-cyan-950/80 px-4 py-1.5 rounded-full border border-cyan-800">
              Direct Communication
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">Initiate Inquiry</h2>
            <p className="text-sm text-slate-400">
              Available for full-time engineering roles, high-concurrency systems, and strategic architecture.
            </p>
          </div>

          <form onSubmit={handleContactSubmit} className="p-8 sm:p-12 rounded-3xl bg-slate-900/80 border border-white/15 backdrop-blur-2xl shadow-2xl space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Identity / Company</label>
              <input
                type="text"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-2xl text-xs text-white font-medium outline-none focus:border-cyan-400 transition-colors"
                placeholder="Guillermo Rauch · Vercel"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Direct Email</label>
              <input
                type="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-2xl text-xs text-white font-medium outline-none focus:border-cyan-400 transition-colors"
                placeholder="rauchg@vercel.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Project / Scope</label>
              <textarea
                rows={4}
                required
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-2xl text-xs text-white font-medium outline-none focus:border-cyan-400 transition-colors leading-relaxed"
                placeholder="Scope of the systems engineering challenge, team mission, or timeline..."
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-4 mt-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-black text-xs font-mono uppercase tracking-widest rounded-2xl shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <Send size={14} /> {sending ? 'TRANSMITTING...' : 'DISPATCH INQUIRY'}
            </button>
          </form>
        </section>

        {/* Footer */}
        <footer className="pt-12 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div>© {new Date().getFullYear()} {profile.full_name} • Lumina Glass Architecture</div>
          <div className="flex items-center gap-4">
            {profile.social_links?.linkedin && (
              <a href={profile.social_links.linkedin} target="_blank" rel="noreferrer" className="hover:text-cyan-400">LinkedIn</a>
            )}
            {profile.social_links?.github && (
              <a href={profile.social_links.github} target="_blank" rel="noreferrer" className="hover:text-cyan-400">GitHub</a>
            )}
            <a href="#about" className="hover:text-cyan-400">Return to Top ↑</a>
          </div>
        </footer>

      </main>

      {/* ── CASE STUDY MODAL ── */}
      <AnimatePresence>
        {activeProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-white/20 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-10 space-y-6 relative text-white"
            >
              <button
                onClick={() => setActiveProjectModal(null)}
                className="absolute top-6 right-6 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="space-y-2">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  SYSTEM INSPECTION · {activeProjectModal.year || '2026'}
                </span>
                <h3 className="text-3xl font-black text-white">{activeProjectModal.title}</h3>
              </div>

              {activeProjectModal.image_url && (
                <div className="rounded-2xl overflow-hidden border border-white/15 h-60 bg-slate-950">
                  <img src={activeProjectModal.image_url} alt={activeProjectModal.title} className="w-full h-full object-cover" />
                </div>
              )}

              <p className="text-base text-slate-300 leading-relaxed">
                {activeProjectModal.description}
              </p>

              {activeProjectModal.highlights && activeProjectModal.highlights.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {activeProjectModal.highlights.map((h, i) => (
                    <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/10">
                      <div className="text-lg font-black font-mono text-cyan-300">{h.value}</div>
                      <div className="text-xs font-mono text-slate-400 uppercase">{h.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {(activeProjectModal.technologies || []).map((t, i) => (
                  <span key={i} className="px-3 py-1 bg-white/10 text-cyan-200 text-xs font-mono rounded-lg">
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-6 border-t border-white/10">
                {activeProjectModal.live_url && (
                  <a
                    href={activeProjectModal.live_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 text-xs font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={14} /> Launch System
                  </a>
                )}
                {activeProjectModal.github_url && (
                  <a
                    href={activeProjectModal.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 hover:bg-white/20"
                  >
                    <Github size={14} /> View Code
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}