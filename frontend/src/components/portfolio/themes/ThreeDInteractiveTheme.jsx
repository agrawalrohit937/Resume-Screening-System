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
  Rocket
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

    const stars = Array.from({ length: 140 }, () => ({
      x: (Math.random() - 0.5) * W * 2,
      y: (Math.random() - 0.5) * H * 2,
      z: Math.random() * W,
      size: Math.random() * 1.6 + 0.6,
      color: Math.random() > 0.5 ? '167, 139, 250' : '96, 165, 250'
    }));

    const draw = () => {
      ctx.fillStyle = '#05070e';
      ctx.fillRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2;

      stars.forEach((s) => {
        s.z -= 1.6;
        if (s.z <= 0) {
          s.z = W;
          s.x = (Math.random() - 0.5) * W * 2;
          s.y = (Math.random() - 0.5) * H * 2;
        }
        const k = 320 / s.z;
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

  const allProjects = profile.projects || [];
  const projectCategories = ['ALL', ...Array.from(new Set(allProjects.map(p => (p.category || 'PROJECT').toUpperCase()).filter(Boolean)))];
  
  const filteredProjects = activeFilter === 'ALL'
    ? allProjects
    : allProjects.filter(p => (p.category || '').toUpperCase() === activeFilter);

  return (
    <div className="min-h-screen bg-[#05070e] text-slate-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-x-hidden">
      
      {/* ── 3D Starfield Warp Canvas ── */}
      <canvas 
        ref={spaceCanvasRef} 
        className="fixed inset-0 pointer-events-none z-0 opacity-80"
      />

      {/* ── CELESTIAL TOP NAV BAR ── */}
      <header className="sticky top-0 left-0 w-full z-40 bg-[#05070e]/80 backdrop-blur-xl border-b border-purple-900/30 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-400 p-[1px] flex items-center justify-center shadow-lg shadow-purple-500/20">
              <div className="w-full h-full bg-[#05070e] rounded-full flex items-center justify-center text-purple-300">
                <Orbit size={16} className="animate-spin" style={{ animationDuration: '10s' }} />
              </div>
            </div>
            <span className="text-white font-black text-sm tracking-widest uppercase">
              {profile.full_name || 'COSMIC_DEV'}
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            <a href="#about" className="hover:text-purple-300 transition-colors">01. Orbit</a>
            <a href="#skills" className="hover:text-purple-300 transition-colors">02. Constellations</a>
            <a href="#projects" className="hover:text-purple-300 transition-colors">03. Artifacts</a>
            <a href="#experience" className="hover:text-purple-300 transition-colors">04. Telemetry</a>
            <a href="#education" className="hover:text-purple-300 transition-colors">05. Academy</a>
            <a href="#contact" className="hover:text-purple-300 transition-colors">06. Beacon</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleResumeDownload}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-full flex items-center gap-2 shadow-lg shadow-purple-500/25 transition-all cursor-pointer"
            >
              <Download size={13} /> Curriculum Vitae
            </motion.button>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-purple-300"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#070b14] border-b border-purple-900/40 px-6 py-4 space-y-3">
            {['About', 'Skills', 'Projects', 'Experience', 'Education', 'Contact'].map((item, idx) => (
              <a 
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-purple-400"
              >
                0{idx + 1}. {item.toUpperCase()}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ── MAIN CONTENT LAYER ── */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-24 space-y-28">
        
        {/* ── HERO ORBIT SPHERE ── */}
        <section className="pt-8 sm:pt-14 pb-12 flex flex-col-reverse lg:flex-row items-center justify-between gap-12 border-b border-purple-900/20 pb-16">
          <div className="space-y-6 max-w-2xl text-center lg:text-left">
            {profile.hero_badge && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/60 border border-purple-500/40 text-purple-300 text-xs font-bold tracking-widest uppercase shadow-lg shadow-purple-500/10">
                <Sparkles size={13} className="text-cyan-400" />
                {profile.hero_badge}
              </span>
            )}

            <div className="space-y-2">
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight">
                {profile.full_name}
              </h1>
              <div className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 flex items-center justify-center lg:justify-start gap-2">
                <span>{typedText}</span>
                <span className="w-2 h-5 bg-cyan-400 animate-pulse" />
              </div>
            </div>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
              {profile.headline || 'Architecting spatial computing experiences, distributed AI networks, and interstellar web apps.'}
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <a
                href="#projects"
                className="px-7 py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white text-xs font-black uppercase tracking-widest rounded-full flex items-center gap-2 shadow-xl shadow-purple-600/30 transition-transform active:scale-95 cursor-pointer"
              >
                Explore Works <Rocket size={14} />
              </a>
              <a
                href="#contact"
                className="px-7 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-widest rounded-full transition-all"
              >
                Send Beacon
              </a>
            </div>

            {/* Social Coordinates */}
            <div className="flex items-center justify-center lg:justify-start gap-3 pt-3">
              {profile.social_links?.github && (
                <a href={profile.social_links.github} target="_blank" rel="noreferrer" className="p-3 bg-white/5 hover:bg-purple-500/20 text-purple-300 rounded-2xl border border-white/10 shadow-sm transition-transform active:scale-95">
                  <Github size={18} />
                </a>
              )}
              {profile.social_links?.linkedin && (
                <a href={profile.social_links.linkedin} target="_blank" rel="noreferrer" className="p-3 bg-white/5 hover:bg-purple-500/20 text-purple-300 rounded-2xl border border-white/10 shadow-sm transition-transform active:scale-95">
                  <Linkedin size={18} />
                </a>
              )}
              {profile.location && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-white/5 px-4 py-2.5 rounded-2xl border border-white/10">
                  <MapPin size={14} className="text-purple-400" />
                  <span>{profile.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* 3D Planetary Avatar Ring */}
          <div className="relative group shrink-0">
            <div className="absolute -inset-4 bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 rounded-full opacity-30 blur-2xl group-hover:opacity-60 transition-opacity" />
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full p-2 bg-gradient-to-tr from-purple-500 to-cyan-400 shadow-2xl overflow-hidden">
              <div className="w-full h-full rounded-full overflow-hidden bg-[#070b14]">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-purple-400 text-6xl font-black">
                    {(profile.full_name || 'S')[0]}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── METRIC NODES ── */}
        {profile.hero_metrics && profile.hero_metrics.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {profile.hero_metrics.map((m, idx) => (
              <div key={idx} className="p-6 bg-slate-900/40 backdrop-blur-md rounded-3xl border border-purple-500/20 text-center space-y-1 shadow-lg">
                <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">{m.value}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── 01. ORBIT (BIO) ── */}
        {profile.bio && (
          <section id="about" className="space-y-4">
            <div className="p-8 sm:p-10 bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-purple-500/20 space-y-3 shadow-xl">
              <span className="text-xs font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20 inline-block">
                01 // Orbital Overview
              </span>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal whitespace-pre-line">
                {profile.bio}
              </p>
            </div>
          </section>
        )}

        {/* ── 02. CONSTELLATIONS (DYNAMIC SKILLS) ── */}
        <section id="skills" className="space-y-8">
          <div className="flex items-center justify-between border-b border-purple-900/30 pb-4">
            <div className="space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-cyan-400">02 // Constellations</span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Technical Stellar Clusters</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {Object.entries(profile.skills || {}).map(([cat, list], idx) => {
              const skillArray = Array.isArray(list) ? list : [];
              return (
                <div key={idx} className="p-7 rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-purple-500/20 hover:border-cyan-400/50 transition-all space-y-4 shadow-xl group">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-sm font-black uppercase tracking-wider text-purple-300 group-hover:text-cyan-300 transition-colors">
                      {cat}
                    </h3>
                    <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-500/30">
                      {skillArray.length} Nodes
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {skillArray.map((s, sIdx) => (
                      <span key={sIdx} className="px-3 py-1.5 bg-purple-950/30 hover:bg-purple-900/50 border border-purple-500/30 text-purple-200 text-xs font-medium rounded-xl transition-all cursor-default">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 03. ARTIFACTS (PROJECTS) ── */}
        <section id="projects" className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-purple-900/30 pb-4">
            <div className="space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-purple-400">03 // Artifacts</span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Cosmic System Deployments ({filteredProjects.length})</h2>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {projectCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveFilter(c)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all cursor-pointer ${
                    activeFilter === c
                      ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-lg shadow-purple-500/20'
                      : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredProjects.map((proj, idx) => (
              <div key={idx} className="p-7 rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-purple-500/20 hover:border-purple-400/50 transition-all flex flex-col justify-between overflow-hidden shadow-xl group">
                
                {proj.image_url && (
                  <div className="relative h-48 -mx-7 -mt-7 mb-6 overflow-hidden bg-slate-950 border-b border-purple-900/30">
                    <img 
                      src={proj.image_url} 
                      alt={proj.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-purple-400">
                      <span className="font-bold uppercase tracking-wider">{proj.category || 'SYSTEM'}</span>
                      <span className="font-mono text-slate-400">{proj.year || '2026'}</span>
                    </div>
                    <h3 className="text-xl font-black text-white group-hover:text-cyan-300 transition-colors">{proj.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{proj.description}</p>
                  </div>

                  {/* Highlights Grid */}
                  {proj.highlights && proj.highlights.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {proj.highlights.map((hl, hIdx) => (
                        <div key={hIdx} className="p-2.5 bg-white/5 rounded-2xl border border-white/10">
                          <div className="text-xs font-black text-cyan-400">{hl.value}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">{hl.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tech stack */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {(proj.technologies || []).map((t, tIdx) => (
                      <span key={tIdx} className="px-2.5 py-1 bg-purple-950/40 text-purple-300 text-[10px] font-semibold rounded-lg border border-purple-500/20">
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                    {proj.live_url && (
                      <a href={proj.live_url} target="_blank" rel="noreferrer" className="px-5 py-2 bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-500/20">
                        <ExternalLink size={12} /> Launch System
                      </a>
                    )}
                    {proj.github_url && (
                      <a href={proj.github_url} target="_blank" rel="noreferrer" className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5">
                        <Github size={12} /> Source Orbit
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 04. TELEMETRY (EXPERIENCE) ── */}
        {profile.experience && profile.experience.length > 0 && (
          <section id="experience" className="space-y-8">
            <div className="flex items-center justify-between border-b border-purple-900/30 pb-4">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">04 // Mission Telemetry (Work Log)</h2>
            </div>

            <div className="space-y-5">
              {profile.experience.map((exp, idx) => (
                <div key={idx} className="p-8 bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-purple-500/20 space-y-3 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/10 pb-3">
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <Briefcase size={16} className="text-cyan-400" />
                      {exp.role}
                    </h3>
                    <span className="text-xs font-bold text-purple-300 bg-purple-950/60 px-3 py-1 rounded-full border border-purple-500/30">
                      {exp.start_date || 'Past'} – {exp.end_date || 'Present'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-cyan-400">{exp.company} {exp.location ? `• ${exp.location}` : ''}</div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">{exp.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 05. ACADEMY (EDUCATION) ── */}
        {profile.education && profile.education.length > 0 && (
          <section id="education" className="space-y-8">
            <div className="flex items-center justify-between border-b border-purple-900/30 pb-4">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">05 // Academic Foundations</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {profile.education.map((edu, idx) => (
                <div key={idx} className="p-8 bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-purple-500/20 space-y-2 shadow-xl">
                  <div className="flex justify-between items-start text-xs text-purple-300">
                    <GraduationCap size={20} className="text-cyan-400" />
                    <span>{edu.graduation_year}</span>
                  </div>
                  <h3 className="text-lg font-black text-white">{edu.degree}</h3>
                  <div className="text-xs text-slate-400">{edu.institution}</div>
                  {edu.grade && (
                    <div className="text-xs font-bold text-emerald-400 pt-1">Grade: {edu.grade}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 06. BEACON (CONTACT) ── */}
        <section id="contact" className="space-y-8 max-w-xl mx-auto text-center">
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-cyan-400">06 // Beacon Signal</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Dispatch Transmission</h2>
          </div>

          <form onSubmit={handleContactSubmit} className="p-8 sm:p-10 bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-purple-500/30 text-left space-y-4 shadow-2xl">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Your Identity</label>
              <input
                type="text"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-medium text-white outline-none focus:border-cyan-400"
                placeholder="Commander Shepherd"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Comm Channel (Email)</label>
              <input
                type="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-medium text-white outline-none focus:border-cyan-400"
                placeholder="shepherd@normandy.space"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Signal Content</label>
              <textarea
                rows={4}
                required
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-medium text-white outline-none focus:border-cyan-400 leading-relaxed"
                placeholder="Brief coordinates or project details..."
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={sending}
              className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send size={14} /> {sending ? 'Transmitting...' : 'Dispatch Beacon'}
            </motion.button>
          </form>
        </section>

        {/* ── FOOTER ── */}
        <footer className="pt-10 border-t border-purple-900/30 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} {profile.full_name} • 3D Spatial Celestial Cosmos
        </footer>

      </main>
    </div>
  );
}
