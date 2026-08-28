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
  Cpu
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

    const particles = Array.from({ length: 65 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      radius: Math.random() * 2.5 + 1,
      color: Math.random() > 0.5 ? '129, 140, 248' : '56, 189, 248'
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
        ctx.fillStyle = `rgba(${p.color}, 0.6)`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(129, 140, 248, ${0.25 * (1 - dist / 110)})`;
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

  const allProjects = profile.projects || [];
  const projectCategories = ['ALL', ...Array.from(new Set(allProjects.map(p => (p.category || 'FEATURED').toUpperCase()).filter(Boolean)))];

  const filteredProjects = activeCategory === 'ALL' 
    ? allProjects 
    : allProjects.filter(p => (p.category || '').toUpperCase() === activeCategory);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-indigo-500 selection:text-white relative overflow-x-hidden antialiased">
      
      {/* ── BACKGROUND ORBS & CANVAS ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-indigo-600/15 blur-[140px]" />
        <div className="absolute top-[30%] right-[-15%] w-[50vw] h-[50vw] rounded-full bg-cyan-500/15 blur-[160px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-purple-600/15 blur-[160px]" />
      </div>

      <canvas 
        ref={canvasRef} 
        className="fixed inset-0 pointer-events-none z-0 opacity-70"
      />

      {/* ── FROSTED GLASS TOP NAV ── */}
      <header className="sticky top-0 left-0 w-full z-50 bg-slate-900/60 backdrop-blur-2xl border-b border-white/10 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-400 p-[1px] flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <div className="w-full h-full bg-slate-900 rounded-[15px] flex items-center justify-center text-cyan-300 font-black text-sm">
                {(profile.full_name || 'G')[0]}
              </div>
            </div>
            <span className="font-black text-white text-base tracking-tight hidden sm:block">
              {profile.full_name}
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-slate-300">
            <a href="#about" className="hover:text-cyan-400 transition-colors">About</a>
            <a href="#skills" className="hover:text-cyan-400 transition-colors">Stack</a>
            <a href="#projects" className="hover:text-cyan-400 transition-colors">Projects</a>
            <a href="#experience" className="hover:text-cyan-400 transition-colors">Experience</a>
            <a href="#education" className="hover:text-cyan-400 transition-colors">Education</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleResumeDownload}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white text-xs font-bold rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all cursor-pointer"
            >
              <Download size={14} /> Resume (PDF)
            </motion.button>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900/95 backdrop-blur-2xl border-b border-white/10 px-6 py-6 space-y-4 shadow-2xl">
            {['About', 'Skills', 'Projects', 'Experience', 'Education', 'Contact'].map((item) => (
              <a 
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-bold uppercase tracking-wider text-slate-200 hover:text-cyan-400"
              >
                {item}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ── MAIN CONTENT LAYER ── */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-28 space-y-32">
        
        {/* ── HERO BANNER ── */}
        <section id="home" className="pt-8 sm:pt-14 pb-8 flex flex-col-reverse lg:flex-row items-center justify-between gap-12 border-b border-white/10 pb-16">
          <div className="space-y-6 max-w-2xl text-center lg:text-left">
            {profile.hero_badge && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 text-xs font-bold tracking-widest uppercase shadow-lg shadow-indigo-500/10">
                <Sparkles size={13} className="text-cyan-400" />
                {profile.hero_badge}
              </span>
            )}

            <div className="space-y-2">
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08]">
                {profile.full_name}
              </h1>
              <div className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400 flex items-center justify-center lg:justify-start gap-2">
                <span>{typedText}</span>
                <span className="w-1.5 h-6 bg-cyan-400 animate-pulse" />
              </div>
            </div>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl font-medium">
              {profile.headline || 'Architecting scalable applications and intelligent AI platforms with verified metrics and modern stacks.'}
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <motion.a 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                href="#projects" 
                className="px-7 py-3.5 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl shadow-indigo-500/25 flex items-center gap-2"
              >
                Explore Projects <ChevronRight size={14} />
              </motion.a>
              <motion.a 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                href="#contact" 
                className="px-7 py-3.5 bg-slate-900/60 hover:bg-slate-800/80 backdrop-blur-xl border border-white/15 text-slate-200 text-xs font-black uppercase tracking-wider rounded-2xl"
              >
                Initiate Contact
              </motion.a>
            </div>

            {/* Social Links Row */}
            <div className="flex items-center justify-center lg:justify-start gap-4 pt-3">
              {profile.social_links?.github && (
                <a href={profile.social_links.github} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 hover:border-cyan-400/40 transition-all">
                  <Github size={18} />
                </a>
              )}
              {profile.social_links?.linkedin && (
                <a href={profile.social_links.linkedin} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:bg-white/10 hover:border-cyan-400/40 transition-all">
                  <Linkedin size={18} />
                </a>
              )}
              {profile.location && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 px-3 py-2 rounded-2xl bg-white/5 border border-white/10">
                  <MapPin size={14} className="text-cyan-400" />
                  <span>{profile.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Hero Avatar Card */}
          <div className="relative group shrink-0">
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 opacity-60 blur-xl group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-white/20 p-2 shadow-2xl overflow-hidden flex items-center justify-center">
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.full_name} 
                  className="w-full h-full object-cover rounded-2xl transform group-hover:scale-105 transition-transform duration-700"
                />
              ) : (
                <div className="w-full h-full rounded-2xl bg-gradient-to-br from-indigo-900/60 to-slate-900/90 flex items-center justify-center text-cyan-400 text-6xl font-black">
                  {(profile.full_name || 'G')[0]}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── METRIC TELEMETRY COUNTERS ── */}
        {profile.hero_metrics && profile.hero_metrics.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {profile.hero_metrics.map((m, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -4 }}
                className="p-6 rounded-3xl bg-slate-900/50 backdrop-blur-2xl border border-white/10 text-center space-y-1 shadow-xl hover:border-cyan-400/40 transition-all"
              >
                <div className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-400">
                  {m.value}
                </div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{m.label}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ── ABOUT / BIO NARRATIVE ── */}
        {profile.bio && (
          <section id="about" className="space-y-4">
            <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/50 backdrop-blur-2xl border border-white/10 shadow-2xl space-y-4">
              <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-3.5 py-1 rounded-full border border-cyan-400/20 inline-block">
                Biography
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Personal Chronicle & Philosophy</h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal whitespace-pre-line">
                {profile.bio}
              </p>
            </div>
          </section>
        )}

        {/* ── SKILLS MATRIX ── */}
        <section id="skills" className="space-y-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3.5 py-1 rounded-full border border-indigo-400/20 inline-block">
                Arsenal
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Specialized Knowledge Matrix</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {Object.entries(profile.skills || {}).map(([cat, list], idx) => {
              const skillArray = Array.isArray(list) ? list : [];
              return (
                <motion.div
                  key={idx}
                  whileHover={{ y: -4 }}
                  className="p-7 rounded-3xl bg-slate-900/50 backdrop-blur-2xl border border-white/10 shadow-xl space-y-5 hover:border-cyan-400/40 transition-all group"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="text-sm font-black uppercase tracking-wider text-indigo-300 group-hover:text-cyan-300 transition-colors">
                      {cat}
                    </h3>
                    <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-400/20">
                      {skillArray.length} items
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {skillArray.map((s, sIdx) => (
                      <span 
                        key={sIdx} 
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold transition-colors cursor-default"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ── PROJECTS SHOWCASE ── */}
        <section id="projects" className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-4">
            <div className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-3.5 py-1 rounded-full border border-cyan-400/20 inline-block">
                Deployments
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Curated Project Portfolio ({filteredProjects.length})</h2>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {projectCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCategory(c)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                    activeCategory === c
                      ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/25'
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
              <motion.div
                key={idx}
                whileHover={{ y: -6 }}
                className="rounded-3xl bg-slate-900/50 backdrop-blur-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col justify-between hover:border-indigo-400/40 transition-all group"
              >
                {proj.image_url && (
                  <div className="relative h-52 overflow-hidden bg-slate-950 border-b border-white/10">
                    <img 
                      src={proj.image_url} 
                      alt={proj.title} 
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="p-8 space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                      <span className="text-cyan-400 uppercase tracking-widest">{proj.category || 'PROJECT'}</span>
                      <span>{proj.year || '2026'}</span>
                    </div>

                    <h3 className="text-2xl font-black text-white group-hover:text-cyan-300 transition-colors">
                      {proj.title}
                    </h3>
                    
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                      {proj.description}
                    </p>
                  </div>

                  {/* Highlights */}
                  {proj.highlights && proj.highlights.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {proj.highlights.map((hl, hIdx) => (
                        <div key={hIdx} className="p-3 bg-white/5 rounded-2xl border border-white/10">
                          <div className="text-xs font-black text-cyan-400">{hl.value}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase">{hl.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tech stack */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {(proj.technologies || []).map((t, tIdx) => (
                      <span key={tIdx} className="px-2.5 py-1 rounded-lg bg-indigo-950/50 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold">
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                    {proj.live_url && (
                      <a 
                        href={proj.live_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-500/25 transition-transform active:scale-95"
                      >
                        <ExternalLink size={13} /> Live System
                      </a>
                    )}
                    {proj.github_url && (
                      <a 
                        href={proj.github_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-transform active:scale-95"
                      >
                        <Github size={13} /> Codebase
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── WORK EXPERIENCE & CAREER TRAJECTORY ── */}
        {profile.experience && profile.experience.length > 0 && (
          <section id="experience" className="space-y-10">
            <div className="text-center space-y-3">
              <span className="text-[11px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 px-3.5 py-1 rounded-full border border-purple-400/20 inline-block">
                Chronicle
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Work History & Contributions</h2>
            </div>

            <div className="space-y-5 max-w-4xl mx-auto">
              {profile.experience.map((exp, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ x: 4 }}
                  className="p-8 rounded-3xl bg-slate-900/50 backdrop-blur-2xl border border-white/10 shadow-xl space-y-4 hover:border-purple-400/40 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
                    <div className="space-y-1">
                      <h3 className="text-xl font-black text-white flex items-center gap-2.5">
                        <Briefcase size={18} className="text-cyan-400" />
                        {exp.role}
                      </h3>
                      <div className="text-sm font-bold text-indigo-400">
                        {exp.company} {exp.location ? `• ${exp.location}` : ''}
                      </div>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-500/10 border border-purple-400/30 text-purple-300 shrink-0">
                      {exp.start_date || 'Past'} – {exp.end_date || 'Present'}
                    </span>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed font-normal whitespace-pre-line">
                    {exp.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── ACADEMIC DEGREES & QUALIFICATIONS ── */}
        {profile.education && profile.education.length > 0 && (
          <section id="education" className="space-y-10">
            <div className="text-center space-y-3">
              <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-3.5 py-1 rounded-full border border-cyan-400/20 inline-block">
                Foundations
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Academic Qualifications</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {profile.education.map((edu, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ y: -4 }}
                  className="p-8 rounded-3xl bg-slate-900/50 backdrop-blur-2xl border border-white/10 shadow-xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
                      <GraduationCap size={20} />
                    </div>
                    {edu.graduation_year && (
                      <span className="text-xs font-bold text-slate-400">{edu.graduation_year}</span>
                    )}
                  </div>
                  <h3 className="text-lg font-black text-white">{edu.degree}</h3>
                  <div className="text-sm font-semibold text-slate-400">{edu.institution}</div>
                  {edu.grade && (
                    <div className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-400/30 px-3 py-1 rounded-full inline-block">
                      Grade: {edu.grade}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── FROSTED GLASS CONTACT TERMINAL ── */}
        <section id="contact" className="space-y-8 max-w-xl mx-auto text-center">
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3.5 py-1 rounded-full border border-indigo-400/20 inline-block">
              Inquiries & Opportunities
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Initiate Transmission</h2>
          </div>

          <form onSubmit={handleContactSubmit} className="p-8 sm:p-10 rounded-3xl bg-slate-900/60 backdrop-blur-2xl border border-white/15 shadow-2xl text-left space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Your Full Name</label>
              <input
                type="text"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-medium outline-none focus:border-cyan-400 focus:bg-white/10 transition-all"
                placeholder="Ada Lovelace"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Your Email Address</label>
              <input
                type="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-medium outline-none focus:border-cyan-400 focus:bg-white/10 transition-all"
                placeholder="ada@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Message / Opportunity Details</label>
              <textarea
                rows={4}
                required
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-medium outline-none focus:border-cyan-400 focus:bg-white/10 transition-all leading-relaxed"
                placeholder="Hi, I'd like to discuss an opportunity..."
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={sending}
              className="w-full py-4 mt-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send size={15} /> {sending ? 'Transmitting...' : 'Dispatch Message'}
            </motion.button>
          </form>
        </section>

        {/* ── FOOTER ── */}
        <footer className="pt-10 border-t border-white/10 text-center text-xs text-slate-500 space-y-2">
          <div>© {new Date().getFullYear()} {profile.full_name} • Designed on Glassmorphic Liquid Pro</div>
        </footer>

      </main>
    </div>
  );
}
