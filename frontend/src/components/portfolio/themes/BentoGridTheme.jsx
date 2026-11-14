import React, { useState, useEffect } from 'react';
import { 
  ExternalLink, 
  Github, 
  Linkedin, 
  Download, 
  Send, 
  Sparkles, 
  MapPin, 
  ArrowUpRight,
  Menu,
  X,
  Briefcase,
  GraduationCap,
  ChevronRight,
  Layers,
  Clock,
  Compass,
  Check,
  Copy,
  Maximize2,
  Code2,
  Mail,
  Zap,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from 'framer-motion';

// --- Apple Pro Bento Card with Dynamic Cursor Spotlight ---
const BentoCard = ({ children, className = "", colSpan = "", rowSpan = "" }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className={`group relative bg-white/95 backdrop-blur-2xl rounded-3xl sm:rounded-[32px] border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.9)] hover:border-indigo-400/60 hover:shadow-[0_20px_45px_-12px_rgba(79,70,229,0.12)] transition-all duration-300 p-5 sm:p-7 md:p-8 flex flex-col justify-between overflow-hidden ${colSpan} ${rowSpan} ${className}`}
    >
      {/* Dynamic Cursor Radial Spotlight */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-3xl sm:rounded-[32px] opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              420px circle at ${mouseX}px ${mouseY}px,
              rgba(99, 102, 241, 0.08),
              transparent 80%
            )
          `,
        }}
      />
      {children}
    </motion.div>
  );
};

export default function BentoGridTheme({
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
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [activeProjectModal, setActiveProjectModal] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  const typingWords = (profile.typing_roles && profile.typing_roles.length > 0)
    ? profile.typing_roles
    : [profile.headline || 'Product Engineer', 'Full-Stack Developer', 'AI Specialist'];

  // Typing effect
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

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-600 selection:text-white relative antialiased">
      
      {/* --- Ambient Radial Glows --- */}
      <div className="absolute top-[-10%] left-[-10%] w-[45vw] h-[45vw] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-sky-400/10 blur-[150px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-5%] w-[35vw] h-[35vw] rounded-full bg-purple-500/10 blur-[140px] pointer-events-none" />
      
      {/* ── Nav Header (Apple Floating Pill Design) ── */}
      <header className="sticky top-0 left-0 w-full z-40 pt-4 px-4 sm:px-6 pointer-events-none">
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="max-w-7xl mx-auto h-16 bg-white/80 backdrop-blur-2xl border border-slate-200/80 shadow-lg shadow-slate-200/40 rounded-full flex items-center justify-between px-6 lg:px-8 pointer-events-auto"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white font-black text-sm shadow-sm">
              {(profile.full_name || 'P')[0]}
            </div>
            <div className="flex flex-col">
              <span className="font-black text-slate-900 text-sm tracking-tight hidden sm:block">
                {profile.full_name}
              </span>
              <span className="text-[10px] font-mono text-slate-500 hidden sm:block">
                MODULAR BENTO OS
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-slate-600">
            <a href="#about" className="hover:text-indigo-600 transition-colors">Overview</a>
            <a href="#skills" className="hover:text-indigo-600 transition-colors">Stack</a>
            <a href="#projects" className="hover:text-indigo-600 transition-colors">Projects</a>
            <a href="#experience" className="hover:text-indigo-600 transition-colors">Trajectory</a>
            <a href="#contact" className="hover:text-indigo-600 transition-colors">Contact</a>
          </nav>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleResumeDownload}
              className="hidden sm:flex px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-full items-center gap-2 shadow-md shadow-slate-900/10 transition-all cursor-pointer"
            >
              <Download size={14} /> Resume
            </motion.button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-700 bg-slate-100 rounded-full cursor-pointer"
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
              className="md:hidden pointer-events-auto max-w-sm mx-auto mt-3 bg-white/95 backdrop-blur-2xl border border-slate-200/80 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              {['Overview', 'Stack', 'Projects', 'Trajectory', 'Contact'].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase() === 'overview' ? 'about' : item.toLowerCase()}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-sm font-bold text-slate-800 hover:text-indigo-600 uppercase tracking-wider"
                >
                  {item}
                </a>
              ))}
              <button
                onClick={handleResumeDownload}
                className="w-full py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md"
              >
                <Download size={14} /> Download Resume
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── MAIN BENTO GRID CANVAS ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-32 space-y-12">
        
        {/* ── SECTION: HERO BENTO MOSAIC ── */}
        <div id="about" className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 items-stretch">
          
          {/* Card 1: Main Identity & Typing Hero (2 Cols, 2 Rows) */}
          <BentoCard colSpan="md:col-span-2 lg:col-span-2" rowSpan="md:row-span-2" className="bg-gradient-to-br from-white via-white to-slate-50/50">
            <div className="space-y-5 sm:space-y-6">
              <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-[11px] sm:text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="truncate max-w-[220px] sm:max-w-none">{profile.hero_badge || 'Open to Opportunities'}</span>
              </div>

              <div className="space-y-2 sm:space-y-3">
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.08] break-words">
                  Hi, I'm <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-sky-600">{profile.full_name}</span>.
                </h1>

                <div className="min-h-[28px] sm:min-h-[36px] flex items-center text-base sm:text-xl md:text-2xl font-bold text-slate-700">
                  <span>I build &nbsp;</span>
                  <span className="text-indigo-600 border-r-2 border-indigo-600 pr-1 animate-pulse">
                    {typedText}
                  </span>
                </div>
              </div>

              <p className="text-slate-600 text-xs sm:text-sm md:text-base leading-relaxed">
                {profile.bio || profile.headline || 'Full-stack software engineer architecting scalable cloud systems and intelligence platforms.'}
              </p>
            </div>

            <div className="pt-6 sm:pt-8 border-t border-slate-100 flex flex-wrap items-center gap-3 sm:gap-4">
              <a
                href="#contact"
                className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
              >
                Connect With Me <ArrowUpRight size={14} />
              </a>
              <button
                onClick={handleCopyEmail}
                className="w-full sm:w-auto px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {copiedEmail ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-slate-500" />}
                <span>{copiedEmail ? 'Copied to Clipboard!' : 'Copy Email'}</span>
              </button>
            </div>
          </BentoCard>

          {/* Card 2: Visual Portrait / Avatar */}
          <BentoCard colSpan="col-span-1" className="items-center justify-center text-center">
            <div className="relative group/avatar">
              <div className="absolute -inset-2 bg-gradient-to-tr from-indigo-500 to-sky-400 rounded-full blur-md opacity-40 group-hover/avatar:opacity-80 transition-opacity" />
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 border-white shadow-xl bg-slate-100 flex items-center justify-center">
                {profile.avatar_url && !avatarFailed ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    onError={() => setAvatarFailed(true)}
                    className="w-full h-full object-cover group-hover/avatar:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <span className="text-4xl sm:text-5xl font-black text-indigo-600">
                    {(profile.full_name || 'P')[0]}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1 pt-3 sm:pt-4">
              <div className="font-black text-slate-900 text-sm sm:text-base">{profile.full_name}</div>
              <div className="text-[11px] sm:text-xs font-medium text-slate-500 flex items-center justify-center gap-1">
                <MapPin size={12} className="text-indigo-500" />
                <span className="truncate max-w-[180px]">{profile.location || 'Remote Available'}</span>
              </div>
            </div>
          </BentoCard>

          {/* Card 3: Live Productivity & Time Widget */}
          <BentoCard colSpan="col-span-1" className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 text-white">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono text-indigo-200">
                <span className="flex items-center gap-1.5"><Clock size={13} /> LIVE CLOCK</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>

              <div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-mono font-black tracking-tight text-white">
                  {currentTime || '07:30 UTC'}
                </div>
                <div className="text-[11px] sm:text-xs text-indigo-300 font-medium pt-1">
                  Active Timezone • Ready to sync
                </div>
              </div>
            </div>

            <div className="pt-3 sm:pt-4 border-t border-white/10 flex items-center justify-between text-[11px] sm:text-xs font-mono text-slate-300">
              <span>STATUS</span>
              <span className="text-emerald-400 font-bold">ONLINE</span>
            </div>
          </BentoCard>

          {/* Card 4: Metrics Grid Tile (Full Row / 2 Cols) */}
          {profile.hero_metrics && profile.hero_metrics.length > 0 && (
            <BentoCard colSpan="col-span-1 md:col-span-2 lg:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3.5 sm:pb-3 sm:mb-4">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                  Demonstrated Impact
                </span>
                <Zap size={14} className="text-amber-500" />
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                {profile.hero_metrics.map((m, idx) => (
                  <div key={idx} className="p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight font-mono">
                      {m.value}
                    </div>
                    <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider pt-0.5 truncate">
                      {m.label}
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>
          )}

          {/* Card 5: Social / Quick Connect Tile */}
          <BentoCard colSpan="col-span-1 md:col-span-1 lg:col-span-2">
            <div className="space-y-3 sm:space-y-4">
              <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                Network & Direct Channels
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {profile.social_links?.github && (
                  <a
                    href={profile.social_links.github}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 sm:p-3.5 rounded-2xl bg-slate-900 text-white flex items-center justify-center sm:justify-start gap-2.5 text-xs font-bold hover:bg-slate-800 transition-colors"
                  >
                    <Github size={15} /> GitHub
                  </a>
                )}
                {profile.social_links?.linkedin && (
                  <a
                    href={profile.social_links.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 sm:p-3.5 rounded-2xl bg-blue-600 text-white flex items-center justify-center sm:justify-start gap-2.5 text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    <Linkedin size={15} /> LinkedIn
                  </a>
                )}
                <a
                  href="#contact"
                  className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center gap-2.5 text-xs font-bold hover:bg-indigo-100 transition-colors"
                >
                  <Mail size={16} /> Direct Email
                </a>
                <button
                  onClick={handleResumeDownload}
                  className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center gap-2.5 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <Download size={16} /> Get PDF CV
                </button>
              </div>
            </div>
          </BentoCard>

        </div>

        {/* ── SECTION: INTERACTIVE TECH STACK BENTO ── */}
        <section id="skills" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Technology Arsenal</h2>
              <p className="text-sm text-slate-500">Core competencies & toolchains applied across production workloads.</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
              <Layers size={18} className="text-indigo-600" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(profile.skills || {}).map(([category, list], idx) => {
              const skillList = Array.isArray(list) ? list : [];
              return (
                <BentoCard key={idx} className="space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-black text-sm uppercase tracking-wider text-slate-900">{category}</h3>
                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                      {skillList.length} Tools
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {skillList.map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100/80 hover:bg-indigo-600 hover:text-white border border-slate-200/60 text-xs font-semibold text-slate-700 transition-all duration-200 cursor-default"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </BentoCard>
              );
            })}
          </div>
        </section>

        {/* ── SECTION: FEATURED PROJECTS (BROWSER MOCKUP CARDS) ── */}
        <section id="projects" className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Engineered Deployments</h2>
              <p className="text-sm text-slate-500">Real-world applications, intelligent engines, and scalable architectures.</p>
            </div>
            <div className="px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
              {allProjects.length} Projects
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {allProjects.map((proj, idx) => (
              <BentoCard key={idx} className="p-0 overflow-hidden space-y-0 group">
                
                {/* Browser Bezel Header */}
                <div className="px-6 py-3.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-400" />
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="ml-2 text-xs font-mono text-slate-500 hidden sm:inline">
                      https://app.{proj.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.io
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                    {proj.category || 'PROD'}
                  </span>
                </div>

                {/* Project Image Preview */}
                {proj.image_url ? (
                  <div className="h-64 sm:h-72 overflow-hidden bg-slate-100 relative group/preview">
                    <img
                      src={proj.image_url}
                      alt={proj.title}
                      className="w-full h-full object-cover group-hover/preview:scale-105 transition-transform duration-700"
                    />
                    <button
                      onClick={() => setActiveProjectModal(proj)}
                      className="absolute bottom-4 right-4 px-4 py-2 bg-slate-900/90 backdrop-blur-md text-white rounded-full text-xs font-bold flex items-center gap-1.5 opacity-0 group-hover/preview:opacity-100 transition-opacity cursor-pointer shadow-lg"
                    >
                      <Maximize2 size={13} /> Deep Inspect
                    </button>
                  </div>
                ) : null}

                {/* Project Meta Details */}
                <div className="p-6 sm:p-8 space-y-5">
                  <div className="space-y-2">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {proj.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {proj.description}
                    </p>
                  </div>

                  {/* Highlights Grid */}
                  {proj.highlights && proj.highlights.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {proj.highlights.map((h, hIdx) => (
                        <div key={hIdx} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <div className="text-base font-black text-slate-900 font-mono">{h.value}</div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase">{h.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tech stack */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {(proj.technologies || []).map((t, tIdx) => (
                      <span key={tIdx} className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg">
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    {proj.live_url && (
                      <a
                        href={proj.live_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                      >
                        <ExternalLink size={14} /> Live Demo
                      </a>
                    )}
                    {proj.github_url && (
                      <a
                        href={proj.github_url}
                        target="_blank"
                        rel="noreferrer"
                        className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Github size={14} /> Code
                      </a>
                    )}
                    <button
                      onClick={() => setActiveProjectModal(proj)}
                      className="p-3 text-slate-400 hover:text-slate-800 rounded-2xl hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Inspect case study"
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                </div>

              </BentoCard>
            ))}
          </div>
        </section>

        {/* ── SECTION: CAREER TRAJECTORY & EXPERIENCE ── */}
        {profile.experience && profile.experience.length > 0 && (
          <section id="experience" className="space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Career Journey</h2>
              <p className="text-sm text-slate-500">Roles held, engineering achievements, and organizational growth.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {profile.experience.map((exp, idx) => (
                <BentoCard key={idx} className="space-y-4">
                  <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <Briefcase size={16} className="text-indigo-600" />
                        {exp.role}
                      </h3>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider pt-0.5">
                        {exp.company} {exp.location ? `• ${exp.location}` : ''}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                      {exp.start_date || 'Past'} – {exp.end_date || 'Present'}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                    {exp.description}
                  </p>
                </BentoCard>
              ))}
            </div>
          </section>
        )}

        {/* ── SECTION: EDUCATION & CREDENTIALS ── */}
        {profile.education && profile.education.length > 0 && (
          <section className="space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Academic Foundations</h2>
              <p className="text-sm text-slate-500">Formal training and verified degree milestones.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {profile.education.map((edu, idx) => (
                <BentoCard key={idx} className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                    <GraduationCap size={20} className="text-indigo-600" />
                    <span className="font-bold">{edu.graduation_year}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900">{edu.degree}</h3>
                  <div className="text-xs text-slate-600 font-semibold">{edu.institution}</div>
                  {edu.grade && (
                    <div className="text-xs font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block mt-2">
                      GRADE: {edu.grade}
                    </div>
                  )}
                </BentoCard>
              ))}
            </div>
          </section>
        )}

        {/* ── SECTION: INTERACTIVE CONTACT BENTO ── */}
        <section id="contact" className="max-w-2xl mx-auto space-y-6 text-center pt-8">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3.5 py-1 rounded-full border border-indigo-200">
              Get In Touch
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Let's Build Something Exceptional</h2>
            <p className="text-sm text-slate-600">Send an inquiry regarding engineering roles, contract builds, or strategic advisory.</p>
          </div>

          <BentoCard className="text-left p-8 sm:p-10 shadow-2xl">
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">Your Name / Organization</label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:border-indigo-600 focus:bg-white transition-all"
                  placeholder="Satya Nadella · Microsoft"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">Email Address</label>
                <input
                  type="email"
                  required
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:border-indigo-600 focus:bg-white transition-all"
                  placeholder="satya@microsoft.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">Inquiry Message</label>
                <textarea
                  rows={4}
                  required
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium outline-none focus:border-indigo-600 focus:bg-white transition-all leading-relaxed"
                  placeholder="Tell me about the engineering challenge, team mission, or timeline..."
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full py-4 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Send size={14} /> {sending ? 'Transmitting...' : 'Send Message'}
              </button>
            </form>
          </BentoCard>
        </section>

        {/* Footer */}
        <footer className="pt-10 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div>© {new Date().getFullYear()} {profile.full_name} • Apple Bento Pro Architecture</div>
          <div className="flex items-center gap-4">
            {profile.social_links?.linkedin && (
              <a href={profile.social_links.linkedin} target="_blank" rel="noreferrer" className="hover:text-indigo-600">LinkedIn</a>
            )}
            {profile.social_links?.github && (
              <a href={profile.social_links.github} target="_blank" rel="noreferrer" className="hover:text-indigo-600">GitHub</a>
            )}
            <a href="#about" className="hover:text-indigo-600">Back to Top ↑</a>
          </div>
        </footer>

      </main>

      {/* ── CASE STUDY MODAL ── */}
      <AnimatePresence>
        {activeProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-8 md:p-10 space-y-5 sm:space-y-6 relative"
            >
              <button
                onClick={() => setActiveProjectModal(null)}
                className="absolute top-4 sm:top-6 right-4 sm:right-6 w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-slate-100 text-slate-800 flex items-center justify-center hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="space-y-1.5 sm:space-y-2 pr-8">
                <span className="text-[10px] sm:text-xs font-bold text-indigo-600 uppercase tracking-wider">
                  CASE STUDY INSPECTION
                </span>
                <h3 className="text-xl sm:text-3xl font-black text-slate-900 break-words">{activeProjectModal.title}</h3>
              </div>

              {activeProjectModal.image_url && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 h-48 sm:h-60 bg-slate-100">
                  <img src={activeProjectModal.image_url} alt={activeProjectModal.title} className="w-full h-full object-cover" />
                </div>
              )}

              <p className="text-xs sm:text-base text-slate-600 leading-relaxed">
                {activeProjectModal.description}
              </p>

              {activeProjectModal.highlights && activeProjectModal.highlights.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  {activeProjectModal.highlights.map((h, i) => (
                    <div key={i} className="p-3 sm:p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="text-base sm:text-lg font-black font-mono text-slate-900">{h.value}</div>
                      <div className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase">{h.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-2">
                {(activeProjectModal.technologies || []).map((t, i) => (
                  <span key={i} className="px-2.5 sm:px-3 py-1 bg-slate-100 text-slate-700 text-[11px] sm:text-xs font-bold rounded-xl">
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-4 sm:pt-6 border-t border-slate-100">
                {activeProjectModal.live_url && (
                  <a
                    href={activeProjectModal.live_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20"
                  >
                    <ExternalLink size={14} /> Open Live System
                  </a>
                )}
                {activeProjectModal.github_url && (
                  <a
                    href={activeProjectModal.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-200"
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