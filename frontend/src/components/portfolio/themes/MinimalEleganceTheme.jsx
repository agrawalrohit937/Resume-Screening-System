import React, { useState, useEffect } from 'react';
import { 
  Github, 
  Linkedin, 
  Mail, 
  Download, 
  ExternalLink, 
  ArrowUpRight, 
  MapPin, 
  Send, 
  Menu, 
  X, 
  Briefcase, 
  GraduationCap, 
  Sparkles,
  ArrowRight,
  Code2,
  Layers,
  Clock,
  Check,
  Copy,
  Eye,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MinimalEleganceTheme({
  profile,
  username,
  handleResumeDownload,
  handleContactSubmit,
  contactForm,
  setContactForm,
  sending
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [activeProjectModal, setActiveProjectModal] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Live Digital Clock for Executive Status
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const allProjects = profile.projects || [];
  const projectCategories = ['ALL', ...Array.from(new Set(allProjects.map(p => (p.category || 'FEATURED').toUpperCase()).filter(Boolean)))];
  
  const filteredProjects = activeFilter === 'ALL'
    ? allProjects
    : allProjects.filter(p => (p.category || '').toUpperCase() === activeFilter);

  const handleCopyEmail = () => {
    if (profile.email) {
      navigator.clipboard.writeText(profile.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2200);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#141413] font-sans selection:bg-[#141413] selection:text-[#FDFBF7] antialiased relative">
      
      {/* ── TOP EDITORIAL MASTHEAD ── */}
      <header className="sticky top-0 left-0 w-full z-40 bg-[#FDFBF7]/90 backdrop-blur-xl border-b border-[#E8E6DF] transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
          <a href="#home" className="group flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-[#141413] text-white flex items-center justify-center text-xs font-black tracking-widest font-mono">
              {(profile.full_name || 'E')[0]}
            </span>
            <div className="flex flex-col">
              <span className="text-base font-black tracking-tight text-[#141413] group-hover:text-amber-700 transition-colors">
                {profile.full_name}
              </span>
              <span className="text-[10px] font-mono tracking-widest uppercase text-[#85827A]">
                Executive Dossier
              </span>
            </div>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8 text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[#706E66]">
            <a href="#about" className="hover:text-[#141413] transition-colors">01. Dossier</a>
            <a href="#skills" className="hover:text-[#141413] transition-colors">02. Stack</a>
            <a href="#projects" className="hover:text-[#141413] transition-colors">03. Systems</a>
            <a href="#experience" className="hover:text-[#141413] transition-colors">04. Trajectory</a>
            <a href="#contact" className="hover:text-[#141413] transition-colors">05. Inquiry</a>
          </nav>

          {/* Action Header */}
          <div className="hidden sm:flex items-center gap-3">
            {profile.email && (
              <button
                onClick={handleCopyEmail}
                className="px-4 py-2 bg-white hover:bg-[#F4F1EA] border border-[#DDD9CE] text-[#141413] text-xs font-mono font-medium rounded-full flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                title="Copy email to clipboard"
              >
                {copiedEmail ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} className="text-[#85827A]" />}
                <span>{copiedEmail ? 'Copied' : profile.email}</span>
              </button>
            )}

            <button
              onClick={handleResumeDownload}
              className="px-5 py-2.5 bg-[#141413] hover:bg-black text-[#FDFBF7] text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            >
              <Download size={13} /> CV
            </button>
          </div>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 lg:hidden text-[#141413]">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-[#FDFBF7] border-b border-[#E8E6DF] px-6 py-6 space-y-4 shadow-xl"
            >
              {['About', 'Skills', 'Projects', 'Experience', 'Education', 'Contact'].map((item, idx) => (
                <a 
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-sm font-mono font-bold uppercase tracking-wider text-[#141413] hover:text-amber-700"
                >
                  0{idx + 1}. {item}
                </a>
              ))}
              <div className="pt-4 border-t border-[#E8E6DF] flex flex-col gap-2">
                <button
                  onClick={handleResumeDownload}
                  className="w-full py-3 bg-[#141413] text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2"
                >
                  <Download size={14} /> Download Curriculum Vitae
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pt-6 sm:pt-12 pb-32 space-y-16 sm:space-y-24 md:space-y-32">
        
        {/* ── HERO EDITORIAL SPREAD ── */}
        <section id="home" className="min-h-[70vh] flex flex-col justify-center border-b border-[#E8E6DF] pb-14 sm:pb-20">
          
          {/* Status Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-6 sm:pb-10">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white border border-[#DDD9CE] shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-widest uppercase text-[#54524C] truncate max-w-[220px] sm:max-w-none">
                {profile.hero_badge || 'Available for High-Impact Engagements'}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-[#85827A]">
              <Clock size={13} className="text-amber-700" />
              <span>LOCAL TIME: {currentTime || '07:30 UTC'}</span>
              <span>•</span>
              <span>{profile.location || 'GLOBAL REMOTE'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
            
            {/* Left Typography Column */}
            <div className="lg:col-span-8 space-y-5 sm:space-y-8">
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-black tracking-[-0.04em] text-[#141413] leading-[1.05] break-words">
                {profile.full_name}
              </h1>

              <p className="text-base sm:text-xl md:text-2xl font-light text-[#54524C] leading-relaxed max-w-2xl font-serif">
                {profile.headline || 'Software Engineer • Scalable Distributed Systems, Enterprise Architecture & AI'}
              </p>

              <div className="flex flex-wrap items-center gap-6 text-xs font-mono font-semibold tracking-wider uppercase text-[#706E66]">
                {profile.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-amber-700" /> {profile.location}
                  </span>
                )}
                <span>•</span>
                <span>{allProjects.length} Production Systems</span>
                <span>•</span>
                <span>Full Life-Cycle Execution</span>
              </div>

              {/* Call to Actions */}
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <a
                  href="#contact"
                  className="px-8 py-4 bg-[#141413] hover:bg-black text-white text-xs font-bold uppercase tracking-widest rounded-full transition-all flex items-center gap-2 shadow-sm hover:shadow-md cursor-pointer"
                >
                  Initiate Inquiry <ArrowRight size={14} />
                </a>
                <a
                  href="#projects"
                  className="px-8 py-4 bg-white hover:bg-[#F4F1EA] border border-[#DDD9CE] text-[#141413] text-xs font-bold uppercase tracking-widest rounded-full transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                >
                  Explore Systems
                </a>
              </div>
            </div>

            {/* Right Architectural Portrait Frame */}
            <div className="lg:col-span-4 flex justify-center lg:justify-end">
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-tr from-amber-200/50 via-slate-200/50 to-transparent rounded-3xl filter blur-xl opacity-70 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative w-64 h-72 sm:w-80 sm:h-96 rounded-3xl overflow-hidden border-2 border-white bg-[#ECE8DF] shadow-2xl flex items-center justify-center">
                  {profile.avatar_url && !avatarFailed ? (
                    <img 
                      src={profile.avatar_url} 
                      alt={profile.full_name} 
                      onError={() => setAvatarFailed(true)}
                      className="w-full h-full object-cover grayscale contrast-110 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700 ease-out"
                    />
                  ) : (
                    <div className="text-7xl font-serif text-[#706E66]">
                      {(profile.full_name || 'E')[0]}
                    </div>
                  )}

                  {/* Corner Accent Badge */}
                  <div className="absolute bottom-4 left-4 right-4 bg-[#141413]/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-white flex items-center justify-between text-xs font-mono">
                    <span className="font-bold">STATUS</span>
                    <span className="text-emerald-400 font-semibold tracking-wider">VERIFIED CANDIDATE</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Metric Bar */}
          {profile.hero_metrics && profile.hero_metrics.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-16 mt-16 border-t border-[#E8E6DF]">
              {profile.hero_metrics.map((m, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="text-4xl sm:text-5xl font-black text-[#141413] tracking-tighter font-mono">
                    {m.value}
                  </div>
                  <div className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[#85827A]">
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          )}

        </section>

        {/* ── 01 // DOSSIER (EXECUTIVE BIO) ── */}
        {profile.bio && (
          <section id="about" className="space-y-8">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-black uppercase tracking-[0.25em] text-[#85827A]">01 / Narrative Dossier</span>
              <div className="h-px bg-[#E8E6DF] flex-1" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-4">
                <h2 className="text-3xl sm:text-4xl font-black text-[#141413] tracking-tight leading-tight">
                  Engineering Philosophy & Execution
                </h2>
              </div>
              <div className="lg:col-span-8">
                <p className="text-lg sm:text-xl text-[#54524C] leading-relaxed font-serif whitespace-pre-line">
                  {profile.bio}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── 02 // TECHNICAL MATRIX (SKILLS) ── */}
        <section id="skills" className="space-y-10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-black uppercase tracking-[0.25em] text-[#85827A]">02 / Competency Matrix</span>
            <div className="h-px bg-[#E8E6DF] flex-1" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {Object.entries(profile.skills || {}).map(([cat, list], idx) => {
              const skillArray = Array.isArray(list) ? list : [];
              return (
                <div 
                  key={idx} 
                  className="p-8 bg-white rounded-3xl border border-[#E8E6DF] shadow-xs hover:shadow-md hover:border-[#141413] transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-[#F4F1EA] pb-4 mb-6">
                      <h3 className="text-sm font-mono font-black uppercase tracking-wider text-[#141413]">
                        {cat}
                      </h3>
                      <span className="text-[11px] font-mono text-[#85827A]">[{skillArray.length} CORE]</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {skillArray.map((s, sIdx) => (
                        <span 
                          key={sIdx}
                          className="px-3.5 py-1.5 bg-[#FDFBF7] border border-[#E8E6DF] rounded-xl text-xs font-mono font-medium text-[#403E3A] hover:bg-[#141413] hover:text-white hover:border-[#141413] transition-colors cursor-default"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-[#F4F1EA] flex items-center justify-between text-[11px] font-mono text-[#85827A]">
                    <span>PRODUCTION VERIFIED</span>
                    <span className="text-emerald-700 font-bold">100% READY</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 03 // PRODUCTION SYSTEMS (PROJECTS) ── */}
        <section id="projects" className="space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#E8E6DF] pb-6">
            <div className="space-y-2">
              <span className="text-xs font-mono font-black uppercase tracking-[0.25em] text-[#85827A]">03 / Curated Deployments</span>
              <h2 className="text-3xl sm:text-5xl font-black text-[#141413] tracking-tight">Production Architectures</h2>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {projectCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveFilter(c)}
                  className={`px-4 py-2 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
                    activeFilter === c
                      ? 'bg-[#141413] text-white shadow-xs'
                      : 'bg-white text-[#706E66] border border-[#E8E6DF] hover:text-[#141413] hover:border-[#141413]'
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
                className="bg-white rounded-3xl border border-[#E8E6DF] shadow-md hover:shadow-xl transition-all duration-500 overflow-hidden group"
              >
                {/* MacBook Pro Window Frame Header */}
                <div className="px-6 py-4 bg-[#F4F1EA] border-b border-[#E8E6DF] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
                    <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
                    <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
                    <span className="ml-3 text-[11px] font-mono text-[#85827A] hidden sm:inline">
                      https://deployment.system/{proj.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.prod
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-[#DDD9CE] text-[#54524C]">
                      {proj.category || 'SYSTEM'}
                    </span>
                    <span className="text-xs font-mono text-[#85827A]">{proj.year || '2026'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                  
                  {/* Visual Preview */}
                  {proj.image_url ? (
                    <div className="lg:col-span-6 bg-[#ECE8DF] border-b lg:border-b-0 lg:border-r border-[#E8E6DF] overflow-hidden min-h-[300px] relative group/img">
                      <img 
                        src={proj.image_url} 
                        alt={proj.title} 
                        className="w-full h-full object-cover grayscale contrast-110 group-hover/img:grayscale-0 group-hover/img:scale-105 transition-all duration-700 ease-out"
                        loading="lazy"
                      />
                      <button
                        onClick={() => setActiveProjectModal(proj)}
                        className="absolute bottom-4 right-4 px-4 py-2 bg-[#141413]/90 text-white rounded-full text-xs font-mono flex items-center gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer shadow-lg"
                      >
                        <Maximize2 size={13} /> Deep Inspect
                      </button>
                    </div>
                  ) : null}

                  {/* Detail Panel */}
                  <div className={`${proj.image_url ? 'lg:col-span-6' : 'lg:col-span-12'} p-8 sm:p-12 flex flex-col justify-between space-y-6`}>
                    <div className="space-y-4">
                      <h3 className="text-2xl sm:text-3xl font-black text-[#141413] tracking-tight">
                        {proj.title}
                      </h3>
                      <p className="text-base text-[#54524C] font-serif leading-relaxed">
                        {proj.description}
                      </p>

                      {/* Architecture Metrics */}
                      {proj.highlights && proj.highlights.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 pt-4">
                          {proj.highlights.map((hl, hIdx) => (
                            <div key={hIdx} className="p-3.5 bg-[#FDFBF7] rounded-2xl border border-[#E8E6DF]">
                              <div className="text-base font-black font-mono text-[#141413]">{hl.value}</div>
                              <div className="text-[10px] font-mono font-bold text-[#85827A] uppercase tracking-wider">{hl.label}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tech Stack Pills */}
                      <div className="flex flex-wrap gap-2 pt-3">
                        {(proj.technologies || []).map((t, tIdx) => (
                          <span key={tIdx} className="px-3 py-1 bg-[#F4F1EA] text-[#403E3A] text-xs font-mono rounded-lg">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-[#F4F1EA]">
                      {proj.live_url && (
                        <a 
                          href={proj.live_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="px-6 py-2.5 bg-[#141413] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <ExternalLink size={13} /> Launch System
                        </a>
                      )}
                      {proj.github_url && (
                        <a 
                          href={proj.github_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="px-6 py-2.5 bg-white hover:bg-[#F4F1EA] border border-[#DDD9CE] text-[#141413] text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5 cursor-pointer"
                        >
                          <Github size={13} /> Source Architecture
                        </a>
                      )}
                      <button
                        onClick={() => setActiveProjectModal(proj)}
                        className="px-4 py-2.5 text-xs font-mono font-bold text-[#85827A] hover:text-[#141413] transition-colors ml-auto cursor-pointer"
                      >
                        Case Study →
                      </button>
                    </div>

                  </div>

                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── 04 // TRAJECTORY (EXPERIENCE) ── */}
        {profile.experience && profile.experience.length > 0 && (
          <section id="experience" className="space-y-10">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-black uppercase tracking-[0.25em] text-[#85827A]">04 / Career Trajectory</span>
              <div className="h-px bg-[#E8E6DF] flex-1" />
            </div>

            <div className="relative border-l-2 border-[#E8E6DF] ml-4 sm:ml-6 pl-6 sm:pl-10 space-y-12">
              {profile.experience.map((exp, idx) => (
                <div key={idx} className="relative group">
                  
                  {/* Timeline Node Dot */}
                  <div className="absolute -left-[31px] sm:-left-[47px] top-1.5 w-4 h-4 rounded-full bg-white border-4 border-[#141413] group-hover:scale-125 transition-transform" />

                  <div className="p-8 bg-white rounded-3xl border border-[#E8E6DF] shadow-xs hover:shadow-md transition-shadow space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F4F1EA] pb-4">
                      <div>
                        <h3 className="text-xl font-black text-[#141413] flex items-center gap-2">
                          <Briefcase size={18} className="text-amber-700" />
                          {exp.role}
                        </h3>
                        <div className="text-xs font-mono font-bold text-[#85827A] uppercase tracking-wider pt-1">
                          {exp.company} {exp.location ? `• ${exp.location}` : ''}
                        </div>
                      </div>

                      <span className="text-xs font-mono font-bold px-3 py-1 bg-[#F4F1EA] text-[#54524C] rounded-full self-start sm:self-auto">
                        {exp.start_date || 'Past'} – {exp.end_date || 'Present'}
                      </span>
                    </div>

                    <p className="text-base text-[#54524C] font-serif leading-relaxed whitespace-pre-line">
                      {exp.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 05 // ACADEMIC RECORD ── */}
        {profile.education && profile.education.length > 0 && (
          <section id="education" className="space-y-10">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-black uppercase tracking-[0.25em] text-[#85827A]">05 / Academic Credentials</span>
              <div className="h-px bg-[#E8E6DF] flex-1" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {profile.education.map((edu, idx) => (
                <div key={idx} className="p-8 bg-white rounded-3xl border border-[#E8E6DF] space-y-3 shadow-xs">
                  <div className="flex justify-between items-start text-xs font-mono text-[#85827A]">
                    <GraduationCap size={22} className="text-amber-700" />
                    <span className="font-bold">{edu.graduation_year}</span>
                  </div>
                  <h3 className="text-xl font-black text-[#141413]">{edu.degree}</h3>
                  <div className="text-xs font-mono text-[#706E66]">{edu.institution}</div>
                  {edu.grade && (
                    <div className="text-xs font-mono font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block mt-2">
                      SCORE: {edu.grade}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 06 // INQUIRY / ENGAGEMENT ── */}
        <section id="contact" className="space-y-8 max-w-2xl mx-auto pt-8">
          <div className="text-center space-y-3">
            <span className="text-xs font-mono font-black uppercase tracking-[0.25em] text-[#85827A]">Direct Communication</span>
            <h2 className="text-4xl sm:text-5xl font-black text-[#141413] tracking-tight">Initiate an Engagement</h2>
            <p className="text-sm font-serif text-[#706E66]">
              Available for full-time executive appointments, architectural consulting, and select ventures.
            </p>
          </div>

          <form onSubmit={handleContactSubmit} className="p-8 sm:p-12 bg-white rounded-3xl border border-[#E8E6DF] shadow-xl space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#141413]">Your Identity / Company</label>
              <input
                type="text"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                className="w-full px-4 py-3 bg-[#FDFBF7] border border-[#DDD9CE] rounded-2xl text-xs font-medium outline-none focus:border-[#141413] transition-colors"
                placeholder="Ada Lovelace · Engineering Director @ Horizon Labs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#141413]">Return Email Address</label>
              <input
                type="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full px-4 py-3 bg-[#FDFBF7] border border-[#DDD9CE] rounded-2xl text-xs font-medium outline-none focus:border-[#141413] transition-colors"
                placeholder="ada@horizonlabs.ai"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#141413]">Proposal / Role Scope</label>
              <textarea
                rows={4}
                required
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                className="w-full px-4 py-3 bg-[#FDFBF7] border border-[#DDD9CE] rounded-2xl text-xs font-medium outline-none focus:border-[#141413] transition-colors leading-relaxed"
                placeholder="Summary of the challenge, role specifications, or project scope..."
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-4 mt-2 bg-[#141413] hover:bg-black text-white text-xs font-mono font-black uppercase tracking-widest rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <Send size={14} /> {sending ? 'TRANSMITTING INQUIRY...' : 'DISPATCH PROPOSAL'}
            </button>
          </form>
        </section>

        {/* ── FOOTER ── */}
        <footer className="pt-12 border-t border-[#E8E6DF] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#85827A]">
          <div>© {new Date().getFullYear()} {profile.full_name} • Atelier Swiss Architecture</div>
          <div className="flex items-center gap-4">
            {profile.social_links?.linkedin && (
              <a href={profile.social_links.linkedin} target="_blank" rel="noreferrer" className="hover:text-[#141413]">LinkedIn</a>
            )}
            {profile.social_links?.github && (
              <a href={profile.social_links.github} target="_blank" rel="noreferrer" className="hover:text-[#141413]">GitHub</a>
            )}
            <a href="#home" className="hover:text-[#141413]">Return to Top ↑</a>
          </div>
        </footer>

      </main>

      {/* ── INTERACTIVE CASE STUDY MODAL ── */}
      <AnimatePresence>
        {activeProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl border border-[#E8E6DF] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-10 space-y-6 relative"
            >
              <button
                onClick={() => setActiveProjectModal(null)}
                className="absolute top-6 right-6 w-9 h-9 rounded-full bg-[#F4F1EA] text-[#141413] flex items-center justify-center hover:bg-[#141413] hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="space-y-2">
                <span className="text-[11px] font-mono font-bold uppercase text-amber-700 tracking-widest">
                  CASE STUDY INSPECTION · {activeProjectModal.year || '2026'}
                </span>
                <h3 className="text-3xl font-black text-[#141413]">{activeProjectModal.title}</h3>
              </div>

              {activeProjectModal.image_url && (
                <div className="rounded-2xl overflow-hidden border border-[#E8E6DF] h-60 bg-[#ECE8DF]">
                  <img src={activeProjectModal.image_url} alt={activeProjectModal.title} className="w-full h-full object-cover" />
                </div>
              )}

              <p className="text-base text-[#54524C] font-serif leading-relaxed">
                {activeProjectModal.description}
              </p>

              {activeProjectModal.highlights && activeProjectModal.highlights.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {activeProjectModal.highlights.map((h, i) => (
                    <div key={i} className="p-4 bg-[#FDFBF7] rounded-xl border border-[#E8E6DF]">
                      <div className="text-lg font-black font-mono text-[#141413]">{h.value}</div>
                      <div className="text-[10px] font-mono text-[#85827A] uppercase">{h.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {(activeProjectModal.technologies || []).map((t, i) => (
                  <span key={i} className="px-3 py-1 bg-[#F4F1EA] text-[#403E3A] text-xs font-mono rounded-lg">
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-6 border-t border-[#E8E6DF]">
                {activeProjectModal.live_url && (
                  <a
                    href={activeProjectModal.live_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 bg-[#141413] text-white text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={14} /> Open Live System
                  </a>
                )}
                {activeProjectModal.github_url && (
                  <a
                    href={activeProjectModal.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-3 bg-white border border-[#DDD9CE] text-[#141413] text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-2 hover:bg-[#F4F1EA]"
                  >
                    <Github size={14} /> View Codebase
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