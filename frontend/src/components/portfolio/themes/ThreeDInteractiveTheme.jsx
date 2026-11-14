import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Orbit, 
  ExternalLink, 
  Github, 
  Linkedin, 
  Download, 
  Send, 
  Compass, 
  Layers,
  MapPin,
  Menu,
  X,
  Briefcase,
  GraduationCap,
  Globe,
  Radio,
  Rocket,
  Clock,
  Check,
  Copy,
  Maximize2,
  Mail,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Interactive 3D Tilt Card Wrapper ---
const TiltCard = ({ children, className = "" }) => {
  const cardRef = useRef(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Tilt angle max +/- 8 degrees
    const rX = ((y - centerY) / centerY) * -8;
    const rY = ((x - centerX) / centerX) * 8;
    setRotateX(rX);
    setRotateY(rY);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX, rotateY }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      style={{ perspective: 1200, transformStyle: "preserve-3d" }}
      className={`rounded-3xl bg-[#0F1426]/80 backdrop-blur-2xl border border-violet-500/20 shadow-2xl hover:border-violet-400/50 transition-all duration-300 relative group ${className}`}
    >
      {/* Specular Ambient Glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/10 via-transparent to-sky-400/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      {children}
    </motion.div>
  );
};

export default function ThreeDInteractiveTheme({
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
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [activeProjectModal, setActiveProjectModal] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const spaceCanvasRef = useRef(null);

  const typingWords = (profile.typing_roles && profile.typing_roles.length > 0)
    ? profile.typing_roles
    : [profile.headline || 'Spatial Systems Engineer', 'AI Research Engineer', 'Full-Stack Architect'];

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

  // Reactive 3D Warp-Drive Starfield Canvas
  useEffect(() => {
    const canvas = spaceCanvasRef.current;
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

    const stars = Array.from({ length: 120 }, () => ({
      x: (Math.random() - 0.5) * W * 2,
      y: (Math.random() - 0.5) * H * 2,
      z: Math.random() * W,
      size: Math.random() * 1.5 + 0.5,
      color: Math.random() > 0.5 ? '139, 92, 246' : '56, 189, 248'
    }));

    const draw = () => {
      ctx.fillStyle = '#05070e';
      ctx.fillRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2;

      stars.forEach((s) => {
        s.z -= 1.4;
        if (s.z <= 0) {
          s.z = W;
          s.x = (Math.random() - 0.5) * W * 2;
          s.y = (Math.random() - 0.5) * H * 2;
        }
        const k = 300 / s.z;
        const px = s.x * k + cx;
        const py = s.y * k + cy;

        if (px >= 0 && px <= W && py >= 0 && py <= H) {
          const alpha = Math.min(1, (1 - s.z / W) * 1.2);
          ctx.beginPath();
          ctx.arc(px, py, Math.max(0.5, s.size * k * 0.6), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${s.color}, ${alpha})`;
          ctx.shadowBlur = 8;
          ctx.shadowColor = `rgba(${s.color}, 0.8)`;
          ctx.fill();
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
  const projectCategories = ['ALL', ...Array.from(new Set(allProjects.map(p => (p.category || 'PROJECT').toUpperCase()).filter(Boolean)))];
  
  const filteredProjects = activeFilter === 'ALL'
    ? allProjects
    : allProjects.filter(p => (p.category || '').toUpperCase() === activeFilter);

  return (
    <div className="min-h-screen bg-[#05070e] text-slate-100 font-sans selection:bg-violet-600 selection:text-white relative antialiased">
      
      {/* ── Reactive Starfield Canvas ── */}
      <canvas ref={spaceCanvasRef} className="absolute inset-0 pointer-events-none z-0 opacity-60" />

      {/* ── Cosmic Nebula Glow Blobs ── */}
      <div className="absolute top-[-15%] left-[-15%] w-[55vw] h-[55vw] rounded-full bg-violet-600/15 blur-[160px] pointer-events-none z-0" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[60vw] h-[60vw] rounded-full bg-sky-500/15 blur-[180px] pointer-events-none z-0" />

      {/* ── TOP FLOATING ORBITAL DOCK ── */}
      <header className="sticky top-0 left-0 w-full z-40 pt-4 px-4 sm:px-6 pointer-events-none">
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-7xl mx-auto h-16 bg-[#0B0F19]/80 backdrop-blur-2xl border border-violet-500/25 shadow-2xl shadow-violet-950/50 rounded-full flex items-center justify-between px-6 lg:px-8 pointer-events-auto"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-violet-600 to-sky-400 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-violet-500/25">
              {(profile.full_name || 'C')[0]}
            </div>
            <div className="flex flex-col">
              <span className="font-black text-white text-sm tracking-tight hidden sm:block">
                {profile.full_name}
              </span>
              <span className="text-[10px] font-mono text-violet-300 hidden sm:block">
                COSMIC NEBULA 3D
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-slate-400">
            <a href="#about" className="hover:text-violet-400 transition-colors">Overview</a>
            <a href="#skills" className="hover:text-violet-400 transition-colors">Constellation</a>
            <a href="#projects" className="hover:text-violet-400 transition-colors">Systems</a>
            <a href="#experience" className="hover:text-violet-400 transition-colors">Trajectory</a>
            <a href="#contact" className="hover:text-violet-400 transition-colors">Uplink</a>
          </nav>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleResumeDownload}
              className="hidden sm:flex px-5 py-2.5 bg-gradient-to-r from-violet-600 to-sky-500 hover:from-violet-500 hover:to-sky-400 text-white font-black text-xs uppercase tracking-wider rounded-full items-center gap-2 shadow-lg shadow-violet-600/25 transition-all cursor-pointer"
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
              className="md:hidden pointer-events-auto max-w-sm mx-auto mt-3 bg-[#0B0F19]/95 backdrop-blur-2xl border border-violet-500/30 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              {['Overview', 'Constellation', 'Systems', 'Trajectory', 'Uplink'].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase() === 'overview' ? 'about' : item.toLowerCase() === 'constellation' ? 'skills' : item.toLowerCase() === 'systems' ? 'projects' : item.toLowerCase() === 'uplink' ? 'contact' : item.toLowerCase()}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-sm font-bold text-slate-200 hover:text-violet-400 uppercase tracking-wider"
                >
                  {item}
                </a>
              ))}
              <button
                onClick={handleResumeDownload}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-sky-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
              >
                <Download size={14} /> Download Resume
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-32 space-y-16 sm:space-y-24 md:space-y-32 relative z-10">
        
        {/* ── SECTION 1: 3D HERO SPREAD ── */}
        <section id="about" className="min-h-[70vh] flex flex-col justify-center border-b border-violet-500/20 pb-14 sm:pb-20">
          
          <div className="flex flex-wrap items-center justify-between gap-3 pb-6 sm:pb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-950/80 border border-violet-500/40 text-violet-300 text-[11px] sm:text-xs font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
              <span className="truncate max-w-[220px] sm:max-w-none">{profile.hero_badge || 'Available for High-Impact Engagements'}</span>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-slate-400">
              <Clock size={13} className="text-violet-400" />
              <span>LOCAL TELEMETRY: {currentTime || '07:30 UTC'}</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">ONLINE</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
            
            <div className="lg:col-span-8 space-y-5 sm:space-y-8">
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-black text-white tracking-tight leading-[1.05] break-words">
                Spatial Depth & <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-300 to-sky-400">
                  Intelligent Computing
                </span>
              </h1>

              <div className="min-h-[28px] sm:min-h-[36px] flex items-center text-lg sm:text-2xl font-bold text-slate-300">
                <span className="text-slate-400 font-normal">Specialized in &nbsp;</span>
                <span className="text-violet-400 border-r-2 border-violet-400 pr-1 animate-pulse font-mono">
                  {typedText}
                </span>
              </div>

              <p className="text-sm sm:text-lg text-slate-300 leading-relaxed max-w-2xl font-normal">
                {profile.bio || profile.headline || 'Architecting distributed spatial systems, high-throughput cloud infrastructure, and intelligent deep learning backends.'}
              </p>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2 sm:pt-4">
                <a
                  href="#contact"
                  className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-r from-violet-600 to-sky-500 hover:from-violet-500 hover:to-sky-400 text-white text-xs font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-violet-600/30 transition-all cursor-pointer"
                >
                  Initiate Uplink <Rocket size={14} />
                </a>
                <button
                  onClick={handleCopyEmail}
                  className="w-full sm:w-auto px-5 sm:px-6 py-3.5 sm:py-4 bg-white/5 hover:bg-white/10 border border-violet-500/30 text-violet-200 text-xs font-bold uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {copiedEmail ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-400" />}
                  <span>{copiedEmail ? 'Copied to Clipboard!' : 'Copy Direct Email'}</span>
                </button>
              </div>
            </div>

            {/* 3D Tilt Orb Avatar Frame */}
            <div className="lg:col-span-4 flex justify-center lg:justify-end">
              <TiltCard className="p-2.5 sm:p-3 bg-[#0B0F19]/90 border-2 border-violet-500/30 shadow-[0_0_40px_rgba(139,92,246,0.25)]">
                <div className="w-56 h-72 sm:w-80 sm:h-96 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center relative">
                  {profile.avatar_url && !avatarFailed ? (
                    <img 
                      src={profile.avatar_url} 
                      alt={profile.full_name} 
                      onError={() => setAvatarFailed(true)}
                      className="w-full h-full object-cover grayscale contrast-115 hover:grayscale-0 transition-all duration-700"
                    />
                  ) : (
                    <div className="text-6xl sm:text-7xl font-black text-violet-400">
                      {(profile.full_name || 'C')[0]}
                    </div>
                  )}

                  <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4 bg-[#05070E]/90 backdrop-blur-xl px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-violet-500/30 text-white flex items-center justify-between text-[11px] sm:text-xs font-mono">
                    <span className="text-slate-400">SECTOR</span>
                    <span className="text-violet-300 font-bold truncate max-w-[140px]">{profile.location || 'GLOBAL REMOTE'}</span>
                  </div>
                </div>
              </TiltCard>
            </div>

          </div>

          {/* Metric Telemetry Cards */}
          {profile.hero_metrics && profile.hero_metrics.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 pt-10 sm:pt-16 mt-10 sm:mt-16 border-t border-violet-500/20">
              {profile.hero_metrics.map((m, idx) => (
                <TiltCard key={idx} className="p-4 sm:p-6 space-y-1">
                  <div className="text-2xl sm:text-4xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-sky-300">
                    {m.value}
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 truncate">
                    {m.label}
                  </div>
                </TiltCard>
              ))}
            </div>
          )}

        </section>

        {/* ── SECTION 2: CONSTELLATION SKILLS MATRIX ── */}
        <section id="skills" className="space-y-10">
          <div className="flex items-center justify-between border-b border-violet-500/20 pb-6">
            <div>
              <span className="text-xs font-mono text-violet-400 font-bold uppercase tracking-widest">Constellation</span>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Technology Arsenal</h2>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-violet-500/30">
              <Orbit size={20} className="text-violet-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(profile.skills || {}).map(([category, list], idx) => {
              const skillList = Array.isArray(list) ? list : [];
              return (
                <TiltCard key={idx} className="p-8 space-y-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <h3 className="font-mono font-bold text-sm uppercase tracking-wider text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-violet-400" />
                      {category}
                    </h3>
                    <span className="text-xs font-mono text-violet-300 bg-violet-950/80 px-2.5 py-0.5 rounded-full border border-violet-800">
                      {skillList.length} Nodes
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {skillList.map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-violet-500/20 text-xs font-mono font-medium text-slate-300 hover:bg-violet-600/20 hover:text-violet-200 hover:border-violet-400/40 transition-colors cursor-default"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </TiltCard>
              );
            })}
          </div>
        </section>

        {/* ── SECTION 3: ENGINEERED SYSTEMS ── */}
        <section id="projects" className="space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-violet-500/20 pb-6">
            <div>
              <span className="text-xs font-mono text-violet-400 font-bold uppercase tracking-widest">Deployments</span>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">Production Architectures</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {projectCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveFilter(c)}
                  className={`px-4 py-2 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
                    activeFilter === c
                      ? 'bg-gradient-to-r from-violet-600 to-sky-500 text-white shadow-lg shadow-violet-500/25'
                      : 'bg-white/5 text-slate-400 border border-violet-500/20 hover:text-white hover:border-violet-500/40'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-16">
            {filteredProjects.map((proj, idx) => (
              <TiltCard key={idx} className="p-0 overflow-hidden group">
                
                {/* Browser Bezel Header */}
                <div className="px-6 py-4 bg-[#090D17] border-b border-violet-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500" />
                    <span className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="ml-3 text-xs font-mono text-slate-400 hidden sm:inline">
                      https://system.{proj.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.space
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-violet-950/80 text-violet-300 border border-violet-800">
                    {proj.category || 'PROD'}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                  {proj.image_url && (
                    <div className="lg:col-span-6 bg-slate-950 border-b lg:border-b-0 lg:border-r border-violet-500/20 overflow-hidden min-h-[320px] relative group/img">
                      <img 
                        src={proj.image_url} 
                        alt={proj.title} 
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-700 ease-out"
                        loading="lazy"
                      />
                      <button
                        onClick={() => setActiveProjectModal(proj)}
                        className="absolute bottom-4 right-4 px-4 py-2 bg-[#090D17]/95 border border-violet-500/30 text-white rounded-full text-xs font-mono flex items-center gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer shadow-xl"
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
                            <div key={hIdx} className="p-3.5 bg-white/5 rounded-2xl border border-violet-500/20">
                              <div className="text-base font-black font-mono text-violet-300">{hl.value}</div>
                              <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">{hl.label}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-3">
                        {(proj.technologies || []).map((t, tIdx) => (
                          <span key={tIdx} className="px-3 py-1 bg-white/5 border border-violet-500/20 text-violet-200 text-xs font-mono rounded-lg">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-violet-500/20">
                      {proj.live_url && (
                        <a 
                          href={proj.live_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-sky-500 hover:from-violet-500 hover:to-sky-400 text-white text-xs font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 shadow-lg shadow-violet-600/30 cursor-pointer"
                        >
                          <ExternalLink size={13} /> Live System
                        </a>
                      )}
                      {proj.github_url && (
                        <a 
                          href={proj.github_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-violet-500/30 text-white text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5 cursor-pointer"
                        >
                          <Github size={13} /> Architecture Repo
                        </a>
                      )}
                      <button
                        onClick={() => setActiveProjectModal(proj)}
                        className="px-4 py-2.5 text-xs font-mono font-bold text-violet-400 hover:text-white transition-colors ml-auto cursor-pointer"
                      >
                        Inspect Modal →
                      </button>
                    </div>

                  </div>
                </div>
              </TiltCard>
            ))}
          </div>
        </section>

        {/* ── SECTION 4: TRAJECTORY ── */}
        {profile.experience && profile.experience.length > 0 && (
          <section id="experience" className="space-y-10">
            <div className="flex items-center justify-between border-b border-violet-500/20 pb-6">
              <div>
                <span className="text-xs font-mono text-violet-400 font-bold uppercase tracking-widest">Experience</span>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Professional Trajectory</h2>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-violet-500/30">
                <Briefcase size={20} className="text-violet-400" />
              </div>
            </div>

            <div className="space-y-6">
              {profile.experience.map((exp, idx) => (
                <TiltCard key={idx} className="p-8 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-xl font-black text-white">{exp.role}</h3>
                      <div className="text-xs font-mono font-bold text-violet-400 uppercase tracking-wider pt-1">
                        {exp.company} {exp.location ? `• ${exp.location}` : ''}
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold px-3 py-1 bg-white/5 border border-violet-500/20 text-slate-300 rounded-full self-start sm:self-auto">
                      {exp.start_date || 'Past'} – {exp.end_date || 'Present'}
                    </span>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed font-normal whitespace-pre-line">
                    {exp.description}
                  </p>
                </TiltCard>
              ))}
            </div>
          </section>
        )}

        {/* ── SECTION 5: EDUCATION ── */}
        {profile.education && profile.education.length > 0 && (
          <section className="space-y-10">
            <div className="flex items-center justify-between border-b border-violet-500/20 pb-6">
              <div>
                <span className="text-xs font-mono text-violet-400 font-bold uppercase tracking-widest">Credentials</span>
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Academic History</h2>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-violet-500/30">
                <GraduationCap size={20} className="text-violet-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {profile.education.map((edu, idx) => (
                <TiltCard key={idx} className="p-8 space-y-3">
                  <div className="flex justify-between items-start text-xs font-mono text-slate-400">
                    <GraduationCap size={22} className="text-violet-400" />
                    <span>{edu.graduation_year}</span>
                  </div>
                  <h3 className="text-xl font-black text-white">{edu.degree}</h3>
                  <div className="text-xs font-mono text-slate-400">{edu.institution}</div>
                  {edu.grade && (
                    <div className="text-xs font-mono font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-full inline-block mt-2">
                      GRADE: {edu.grade}
                    </div>
                  )}
                </TiltCard>
              ))}
            </div>
          </section>
        )}

        {/* ── SECTION 6: INQUIRY UPLINK ── */}
        <section id="contact" className="space-y-8 max-w-2xl mx-auto pt-8">
          <div className="text-center space-y-3">
            <span className="text-xs font-mono font-black uppercase tracking-widest text-violet-400 bg-violet-950/80 px-4 py-1.5 rounded-full border border-violet-800">
              Communication Relay
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">Initiate Uplink</h2>
            <p className="text-sm text-slate-400">
              Available for full-time engineering appointments, spatial architecture, and AI ventures.
            </p>
          </div>

          <TiltCard className="p-8 sm:p-12 shadow-2xl">
            <form onSubmit={handleContactSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Identity / Organization</label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-violet-500/30 rounded-2xl text-xs text-white font-medium outline-none focus:border-violet-400 transition-colors"
                  placeholder="Sam Altman · OpenAI"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Direct Email</label>
                <input
                  type="email"
                  required
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-violet-500/30 rounded-2xl text-xs text-white font-medium outline-none focus:border-violet-400 transition-colors"
                  placeholder="sam@openai.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Mission Scope</label>
                <textarea
                  rows={4}
                  required
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-violet-500/30 rounded-2xl text-xs text-white font-medium outline-none focus:border-violet-400 transition-colors leading-relaxed"
                  placeholder="Scope of the systems engineering challenge, team mission, or timeline..."
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full py-4 mt-2 bg-gradient-to-r from-violet-600 to-sky-500 hover:from-violet-500 hover:to-sky-400 text-white font-black text-xs font-mono uppercase tracking-widest rounded-2xl shadow-xl shadow-violet-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Send size={14} /> {sending ? 'TRANSMITTING UPLINK...' : 'DISPATCH UPLINK'}
              </button>
            </form>
          </TiltCard>
        </section>

        {/* Footer */}
        <footer className="pt-12 border-t border-violet-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div>© {new Date().getFullYear()} {profile.full_name} • Cosmic Nebula 3D Architecture</div>
          <div className="flex items-center gap-4">
            {profile.social_links?.linkedin && (
              <a href={profile.social_links.linkedin} target="_blank" rel="noreferrer" className="hover:text-violet-400">LinkedIn</a>
            )}
            {profile.social_links?.github && (
              <a href={profile.social_links.github} target="_blank" rel="noreferrer" className="hover:text-violet-400">GitHub</a>
            )}
            <a href="#about" className="hover:text-violet-400">Return to Top ↑</a>
          </div>
        </footer>

      </main>

      {/* ── CASE STUDY MODAL ── */}
      <AnimatePresence>
        {activeProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0B0F19] border border-violet-500/30 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-10 space-y-6 relative text-white"
            >
              <button
                onClick={() => setActiveProjectModal(null)}
                className="absolute top-6 right-6 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="space-y-2">
                <span className="text-xs font-mono font-bold text-violet-400 uppercase tracking-wider">
                  SYSTEM INSPECTION · {activeProjectModal.year || '2026'}
                </span>
                <h3 className="text-3xl font-black text-white">{activeProjectModal.title}</h3>
              </div>

              {activeProjectModal.image_url && (
                <div className="rounded-2xl overflow-hidden border border-violet-500/30 h-60 bg-black">
                  <img src={activeProjectModal.image_url} alt={activeProjectModal.title} className="w-full h-full object-cover" />
                </div>
              )}

              <p className="text-base text-slate-300 leading-relaxed">
                {activeProjectModal.description}
              </p>

              {activeProjectModal.highlights && activeProjectModal.highlights.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {activeProjectModal.highlights.map((h, i) => (
                    <div key={i} className="p-4 bg-white/5 rounded-2xl border border-violet-500/20">
                      <div className="text-lg font-black font-mono text-violet-300">{h.value}</div>
                      <div className="text-xs font-mono text-slate-400 uppercase">{h.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {(activeProjectModal.technologies || []).map((t, i) => (
                  <span key={i} className="px-3 py-1 bg-white/10 text-violet-200 text-xs font-mono rounded-lg">
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-6 border-t border-violet-500/20">
                {activeProjectModal.live_url && (
                  <a
                    href={activeProjectModal.live_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-sky-500 text-white text-xs font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={14} /> Launch System
                  </a>
                )}
                {activeProjectModal.github_url && (
                  <a
                    href={activeProjectModal.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 bg-white/10 border border-violet-500/30 text-white text-xs font-bold uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 hover:bg-white/20"
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