import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  Cpu, 
  ExternalLink, 
  Github, 
  Linkedin, 
  Download, 
  Send, 
  Zap, 
  Sparkles,
  MapPin,
  Menu,
  X,
  Briefcase,
  GraduationCap,
  Activity,
  Radio,
  Lock,
  Code,
  Clock,
  Check,
  Copy,
  Maximize2,
  Mail,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CyberpunkTheme({
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
  const [glitchActive, setGlitchActive] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [activeProjectModal, setActiveProjectModal] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  const typingWords = (profile.typing_roles && profile.typing_roles.length > 0)
    ? profile.typing_roles
    : [profile.headline || 'CYBER_SYSTEMS_ARCHITECT', 'NEURAL_NETWORK_ENGINEER', 'FULL_STACK_OPERATIVE'];

  useEffect(() => {
    const currentWord = typingWords[roleIdx % typingWords.length];
    let timer;
    if (!isDeleting) {
      if (typedText.length < currentWord.length) {
        timer = setTimeout(() => setTypedText(currentWord.slice(0, typedText.length + 1)), 50);
      } else {
        timer = setTimeout(() => setIsDeleting(true), 2500);
      }
    } else {
      if (typedText.length > 0) {
        timer = setTimeout(() => setTypedText(currentWord.slice(0, typedText.length - 1)), 25);
      } else {
        setIsDeleting(false);
        setRoleIdx((prev) => (prev + 1) % typingWords.length);
      }
    }
    return () => clearTimeout(timer);
  }, [typedText, isDeleting, roleIdx, typingWords]);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitchActive(true);
      setTimeout(() => setGlitchActive(false), 200);
    }, 8000);
    return () => clearInterval(interval);
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
  const projectCategories = ['ALL', ...Array.from(new Set(allProjects.map(p => (p.category || 'SYSTEM').toUpperCase()).filter(Boolean)))];
  
  const filteredProjects = activeTab === 'ALL'
    ? allProjects
    : allProjects.filter(p => (p.category || '').toUpperCase() === activeTab);

  return (
    <div className="min-h-screen bg-[#05070D] text-slate-200 font-mono relative selection:bg-cyan-400 selection:text-black antialiased">
      
      {/* ── Holographic Grid Matrix Background ── */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20 z-0"
        style={{
          backgroundImage: 'linear-gradient(to right, #00f0ff 1px, transparent 1px), linear-gradient(to bottom, #00f0ff 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,7,13,0.9)_100%)] z-1" />

      {/* ── TOP TACTICAL HUD HEADER ── */}
      <header className="sticky top-0 left-0 w-full z-40 bg-[#05070D]/90 backdrop-blur-xl border-b border-cyan-500/30 shadow-[0_0_20px_rgba(0,240,255,0.12)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-cyan-400 animate-ping rounded-full inline-block" />
            <span className="text-white font-black tracking-widest text-sm uppercase flex items-center gap-2">
              <span className="text-cyan-400 font-bold">[SYS_NODE]</span> {profile.full_name || 'NEURAL_UNIT'}
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-[11px] font-black tracking-widest text-cyan-300">
            <a href="#about" className="hover:text-yellow-400 transition-colors">01_ARCHIVE</a>
            <a href="#skills" className="hover:text-yellow-400 transition-colors">02_MATRIX</a>
            <a href="#projects" className="hover:text-yellow-400 transition-colors">03_PROJECTS</a>
            <a href="#experience" className="hover:text-yellow-400 transition-colors">04_TIMELINE</a>
            <a href="#contact" className="hover:text-yellow-400 transition-colors">05_DISPATCH</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={handleResumeDownload}
              className="px-4 py-2 bg-cyan-400 hover:bg-yellow-400 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all cursor-pointer"
            >
              <Download size={13} /> DUMP_RESUME.DAT
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-cyan-400 cursor-pointer"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#05070D] border-b border-cyan-500/40 px-6 py-4 space-y-3">
            {['About', 'Skills', 'Projects', 'Experience', 'Education', 'Contact'].map((item, idx) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-xs font-bold text-cyan-300 hover:text-yellow-400 uppercase tracking-widest"
              >
                0{idx + 1}_{item.toUpperCase()}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ── MAIN HUD INTERFACE ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 sm:pt-10 pb-32 space-y-16 sm:space-y-24 md:space-y-32 relative z-10">
        
        {/* ── SECTION 1: HERO HUD TELEMETRY ── */}
        <section id="about" className="min-h-[70vh] flex flex-col justify-center border-b border-cyan-500/20 pb-14 sm:pb-20">
          
          <div className="flex flex-wrap items-center justify-between gap-3 pb-6 text-xs text-cyan-400 border-b border-cyan-500/20 mb-6 sm:mb-8">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-yellow-400 animate-pulse" />
              <span>CORE_DIAGNOSTICS: OPTIMAL</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">SECURITY_CLEARANCE: LEVEL_4</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs">
              <Clock size={13} className="text-cyan-400" />
              <span>LOCAL_TIME: {currentTime || '07:30:00 UTC'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-center">
            
            <div className="lg:col-span-8 space-y-5 sm:space-y-6">
              <div className="inline-block px-3 py-1 bg-cyan-950/80 border border-cyan-400 text-cyan-300 text-[11px] sm:text-xs font-bold uppercase tracking-widest shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                OPERATIVE: {profile.hero_badge || 'ACTIVE_CANDIDATE'}
              </div>

              <h1 className={`text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter uppercase leading-tight break-words ${glitchActive ? 'skew-x-2 text-yellow-300' : ''}`}>
                {profile.full_name}
              </h1>

              <div className="text-base sm:text-xl font-bold text-cyan-300 flex items-center gap-2">
                <span className="text-yellow-400">❯</span>
                <span className="break-words">{typedText}</span>
                <span className="w-2.5 h-5 bg-cyan-400 inline-block animate-pulse shrink-0" />
              </div>

              <p className="text-xs sm:text-base text-slate-300 leading-relaxed max-w-2xl font-sans">
                {profile.bio || profile.headline || 'High-performance engineering operative specializing in fault-tolerant infrastructure and neural network architectures.'}
              </p>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2 sm:pt-4">
                <a
                  href="#contact"
                  className="w-full sm:w-auto px-6 sm:px-8 py-3.5 bg-cyan-400 hover:bg-yellow-400 text-black text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  TRANSMIT_DISPATCH()
                </a>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="w-full sm:w-auto px-5 sm:px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-cyan-500/40 text-cyan-300 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {copiedEmail ? <Check size={14} className="text-yellow-400" /> : <Copy size={14} />}
                  <span>{copiedEmail ? 'COPIED' : 'COPY_COMM_ADDR'}</span>
                </button>
              </div>
            </div>

            {/* Tactical Portrait Frame */}
            <div className="lg:col-span-4 flex justify-center lg:justify-end">
              <div className="relative p-2 border-2 border-cyan-500/40 bg-[#090D17] shadow-[0_0_30px_rgba(0,240,255,0.2)]">
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-yellow-400" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-yellow-400" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-yellow-400" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-yellow-400" />

                <div className="w-64 h-80 overflow-hidden bg-slate-900 flex items-center justify-center">
                  {profile.avatar_url && !avatarFailed ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      onError={() => setAvatarFailed(true)}
                      className="w-full h-full object-cover grayscale contrast-125 hover:grayscale-0 transition-all duration-500"
                    />
                  ) : (
                    <span className="text-6xl font-black text-cyan-400 font-mono">
                      {(profile.full_name || 'C')[0]}
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-cyan-400 uppercase pt-2 flex items-center justify-between font-bold">
                  <span>SECTOR: {profile.location || 'GLOBAL'}</span>
                  <span className="text-emerald-400">STATUS: READY</span>
                </div>
              </div>
            </div>

          </div>

          {/* Metric Telemetry Strip */}
          {profile.hero_metrics && profile.hero_metrics.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-12 mt-12 border-t border-cyan-500/20">
              {profile.hero_metrics.map((m, idx) => (
                <div key={idx} className="p-4 bg-[#090D17] border border-cyan-500/30">
                  <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono">
                    {m.value}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest pt-1">
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          )}

        </section>

        {/* ── SECTION 2: MATRIX SKILLS ── */}
        <section id="skills" className="space-y-8">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
            <div>
              <span className="text-xs text-yellow-400 uppercase font-bold">// 02_CYBER_MATRIX</span>
              <h2 className="text-2xl sm:text-3xl font-black text-white uppercase">Operational Skills Matrix</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(profile.skills || {}).map(([cat, list], idx) => {
              const skillList = Array.isArray(list) ? list : [];
              return (
                <div key={idx} className="p-6 bg-[#090D17] border border-cyan-500/30 hover:border-cyan-400 transition-colors space-y-4">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                    <span className="text-xs font-bold uppercase text-yellow-400">{cat}</span>
                    <span className="text-[11px] text-cyan-400 font-bold">[{skillList.length}]</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {skillList.map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-3 py-1 bg-cyan-950/60 border border-cyan-500/40 text-xs text-cyan-300 hover:bg-cyan-400 hover:text-black transition-colors"
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

        {/* ── SECTION 3: CLASSIFIED PROJECTS ── */}
        <section id="projects" className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-cyan-500/20 pb-4">
            <div>
              <span className="text-xs text-yellow-400 uppercase font-bold">// 03_CLASSIFIED_FILES</span>
              <h2 className="text-2xl sm:text-4xl font-black text-white uppercase">Engineered Operations</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {projectCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveTab(c)}
                  className={`px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === c
                      ? 'bg-cyan-400 text-black'
                      : 'bg-[#090D17] text-cyan-400 border border-cyan-500/30 hover:border-cyan-400'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {filteredProjects.map((proj, idx) => (
              <div 
                key={idx}
                className="bg-[#090D17] border border-cyan-500/30 hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(0,240,255,0.15)] transition-all space-y-0"
              >
                {/* HUD Header */}
                <div className="px-5 py-3 bg-[#05070D] border-b border-cyan-500/30 flex items-center justify-between text-xs">
                  <span className="text-yellow-400 font-bold uppercase">FILE: {proj.title}</span>
                  <span className="text-slate-400">{proj.year || '2026'}</span>
                </div>

                {proj.image_url && (
                  <div className="h-60 overflow-hidden bg-black relative group/img border-b border-cyan-500/20">
                    <img 
                      src={proj.image_url} 
                      alt={proj.title} 
                      className="w-full h-full object-cover grayscale contrast-125 group-hover/img:grayscale-0 transition-all duration-500"
                    />
                    <button
                      onClick={() => setActiveProjectModal(proj)}
                      className="absolute bottom-3 right-3 px-3 py-1 bg-black/90 text-cyan-300 border border-cyan-400 text-xs flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Maximize2 size={12} /> DECRYPT_DETAILS
                    </button>
                  </div>
                )}

                <div className="p-6 space-y-4">
                  <h3 className="text-xl font-black text-white">{proj.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{proj.description}</p>

                  {proj.highlights && proj.highlights.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {proj.highlights.map((h, i) => (
                        <div key={i} className="p-2.5 bg-[#05070D] border border-cyan-500/20">
                          <div className="text-sm font-bold text-cyan-300">{h.value}</div>
                          <div className="text-[10px] text-slate-400 uppercase">{h.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {(proj.technologies || []).map((t, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[#05070D] border border-cyan-500/30 text-cyan-300 text-xs">
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-cyan-500/20">
                    {proj.live_url && (
                      <a
                        href={proj.live_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2.5 bg-cyan-400 hover:bg-yellow-400 text-black text-xs font-black uppercase tracking-wider text-center flex items-center justify-center gap-1.5"
                      >
                        <ExternalLink size={13} /> LAUNCH_SYS
                      </a>
                    )}
                    {proj.github_url && (
                      <a
                        href={proj.github_url}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2.5 px-4 bg-[#05070D] hover:bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-xs font-bold uppercase flex items-center gap-1.5"
                      >
                        <Github size={13} /> REPO
                      </a>
                    )}
                    <button
                      onClick={() => setActiveProjectModal(proj)}
                      className="p-2 text-cyan-400 hover:text-yellow-400 cursor-pointer ml-auto"
                    >
                      <Maximize2 size={16} />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 4: MISSION TIMELINE ── */}
        {profile.experience && profile.experience.length > 0 && (
          <section id="experience" className="space-y-6">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-4">
              <div>
                <span className="text-xs text-yellow-400 uppercase font-bold">// 04_MISSION_LOGS</span>
                <h2 className="text-2xl sm:text-3xl font-black text-white uppercase">Operational Trajectory</h2>
              </div>
            </div>

            <div className="space-y-4">
              {profile.experience.map((exp, idx) => (
                <div key={idx} className="p-6 bg-[#090D17] border border-cyan-500/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-cyan-500/20 pb-3">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Briefcase size={16} className="text-cyan-400" />
                      {exp.role} // <span className="text-yellow-400">{exp.company}</span>
                    </h3>
                    <span className="text-xs text-slate-400">
                      {exp.start_date || 'PAST'} – {exp.end_date || 'PRESENT'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-line">
                    {exp.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── SECTION 5: DISPATCH TRANSMISSION ── */}
        <section id="contact" className="max-w-xl mx-auto space-y-6 text-center pt-8">
          <div className="space-y-2">
            <span className="text-xs text-yellow-400 uppercase font-bold">// 05_UPLINK</span>
            <h2 className="text-3xl font-black text-white uppercase">Direct Signal Transmission</h2>
            <p className="text-xs text-slate-400 font-sans">Dispatch encrypted opportunities, engineering missions, or inquiries.</p>
          </div>

          <form onSubmit={handleContactSubmit} className="p-8 bg-[#090D17] border border-cyan-500/40 text-left space-y-4 shadow-[0_0_30px_rgba(0,240,255,0.1)]">
            <div className="space-y-1">
              <label className="text-xs text-cyan-400 font-bold uppercase">IDENTIFIER:</label>
              <input
                type="text"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                className="w-full px-4 py-3 bg-[#05070D] border border-cyan-500/30 text-xs text-white outline-none focus:border-cyan-400"
                placeholder="OPERATIVE_NAME"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-cyan-400 font-bold uppercase">SIGNAL_EMAIL:</label>
              <input
                type="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full px-4 py-3 bg-[#05070D] border border-cyan-500/30 text-xs text-white outline-none focus:border-cyan-400"
                placeholder="signal@neural.io"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-cyan-400 font-bold uppercase">MISSION_BRIEF:</label>
              <textarea
                rows={4}
                required
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                className="w-full px-4 py-3 bg-[#05070D] border border-cyan-500/30 text-xs text-white outline-none focus:border-cyan-400 leading-relaxed font-sans"
                placeholder="Mission specifications..."
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-4 mt-2 bg-cyan-400 hover:bg-yellow-400 text-black font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(0,240,255,0.3)]"
            >
              <Send size={14} /> {sending ? 'TRANSMITTING_PACKETS...' : 'DISPATCH_SIGNAL'}
            </button>
          </form>
        </section>

        {/* Footer */}
        <footer className="pt-10 border-t border-cyan-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>© {new Date().getFullYear()} {profile.full_name} • Neo-Matrix 2077 HUD</div>
          <div className="flex items-center gap-4 text-cyan-400">
            {profile.social_links?.linkedin && (
              <a href={profile.social_links.linkedin} target="_blank" rel="noreferrer" className="hover:text-yellow-400">LINKEDIN</a>
            )}
            {profile.social_links?.github && (
              <a href={profile.social_links.github} target="_blank" rel="noreferrer" className="hover:text-yellow-400">GITHUB</a>
            )}
            <a href="#about" className="hover:text-yellow-400">TOP_SIGNAL ↑</a>
          </div>
        </footer>

      </main>

      {/* ── CASE STUDY DECRYPTION MODAL ── */}
      <AnimatePresence>
        {activeProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#090D17] border-2 border-cyan-400 shadow-[0_0_35px_rgba(0,240,255,0.3)] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-5 relative text-white"
            >
              <button
                onClick={() => setActiveProjectModal(null)}
                className="absolute top-5 right-5 w-8 h-8 bg-cyan-400 text-black flex items-center justify-center hover:bg-yellow-400 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="space-y-1">
                <span className="text-xs text-yellow-400 uppercase font-bold">// DECLASSIFIED_RECORD</span>
                <h3 className="text-2xl font-black text-white uppercase">{activeProjectModal.title}</h3>
              </div>

              {activeProjectModal.image_url && (
                <div className="overflow-hidden border border-cyan-500/40 h-56 bg-black">
                  <img src={activeProjectModal.image_url} alt={activeProjectModal.title} className="w-full h-full object-cover" />
                </div>
              )}

              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {activeProjectModal.description}
              </p>

              {activeProjectModal.highlights && activeProjectModal.highlights.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {activeProjectModal.highlights.map((h, i) => (
                    <div key={i} className="p-3 bg-[#05070D] border border-cyan-500/30">
                      <div className="text-sm font-bold text-cyan-400">{h.value}</div>
                      <div className="text-[10px] text-slate-400 uppercase">{h.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 pt-2">
                {(activeProjectModal.technologies || []).map((t, i) => (
                  <span key={i} className="px-2 py-0.5 bg-[#05070D] border border-cyan-500/30 text-cyan-300 text-xs">
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-cyan-500/20">
                {activeProjectModal.live_url && (
                  <a
                    href={activeProjectModal.live_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2.5 bg-cyan-400 hover:bg-yellow-400 text-black text-xs font-black uppercase tracking-wider text-center flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={14} /> LAUNCH_SYSTEM
                  </a>
                )}
                {activeProjectModal.github_url && (
                  <a
                    href={activeProjectModal.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2.5 bg-[#05070D] border border-cyan-500/40 text-cyan-300 text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2 hover:bg-cyan-950"
                  >
                    <Github size={14} /> REPO
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