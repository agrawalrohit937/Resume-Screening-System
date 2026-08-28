import React, { useState } from 'react';
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
  Code,
  Layers
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

  const allProjects = profile.projects || [];
  const projectCategories = ['ALL', ...Array.from(new Set(allProjects.map(p => (p.category || 'PROJECT').toUpperCase()).filter(Boolean)))];
  
  const filteredProjects = activeFilter === 'ALL'
    ? allProjects
    : allProjects.filter(p => (p.category || '').toUpperCase() === activeFilter);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#121316] font-sans selection:bg-[#121316] selection:text-[#faf9f6] antialiased">
      
      {/* ── TOP EDITORIAL MASTHEAD ── */}
      <header className="sticky top-0 left-0 w-full z-40 bg-[#faf9f6]/90 backdrop-blur-md border-b border-[#e5e4e0]">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="#home" className="text-xl font-black tracking-tighter text-[#121316]">
            {profile.full_name}<span className="text-amber-600">.</span>
          </a>

          <nav className="hidden md:flex items-center gap-9 text-[11px] font-black uppercase tracking-[0.2em] text-[#6b6964]">
            <a href="#about" className="hover:text-[#121316] transition-colors">01 / Dossier</a>
            <a href="#skills" className="hover:text-[#121316] transition-colors">02 / Competencies</a>
            <a href="#projects" className="hover:text-[#121316] transition-colors">03 / Works</a>
            <a href="#experience" className="hover:text-[#121316] transition-colors">04 / Trajectory</a>
            <a href="#education" className="hover:text-[#121316] transition-colors">05 / Academy</a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleResumeDownload}
              className="px-5 py-2.5 bg-[#121316] hover:bg-black text-[#faf9f6] text-xs font-bold rounded-full flex items-center gap-2 transition-all shadow-sm"
            >
              <Download size={13} /> Curriculum Vitae
            </motion.button>
          </div>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 md:hidden text-[#121316]">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#faf9f6] border-b border-[#e5e4e0] p-6 space-y-4 shadow-xl">
            {['About', 'Skills', 'Projects', 'Experience', 'Education', 'Contact'].map((item) => (
              <a 
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-bold uppercase tracking-wider text-[#121316]"
              >
                {item}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="max-w-6xl mx-auto px-6 pt-16 pb-28 space-y-32">
        
        {/* ── HERO EDITORIAL SPREAD ── */}
        <section id="home" className="pt-8 sm:pt-16 pb-12 border-b border-[#e5e4e0]">
          <div className="flex flex-col-reverse lg:flex-row items-start justify-between gap-12">
            <div className="space-y-8 max-w-3xl">
              {profile.hero_badge && (
                <span className="text-[11px] font-mono font-bold uppercase tracking-[0.25em] text-[#716e68] border border-[#d8d6cf] px-4 py-1.5 rounded-full inline-block bg-white shadow-2xs">
                  {profile.hero_badge}
                </span>
              )}

              <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-[#121316] leading-[1.02]">
                {profile.full_name}
              </h1>

              <p className="text-xl sm:text-2xl font-normal text-[#595752] leading-relaxed max-w-2xl">
                {profile.headline || 'Software Engineer • Scalable Systems, Intelligence Architectures & Product Engineering'}
              </p>

              <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-bold tracking-widest uppercase text-[#716e68]">
                {profile.location && (
                  <span className="flex items-center gap-1.5"><MapPin size={14} className="text-amber-600" /> {profile.location}</span>
                )}
                <span>•</span>
                <span>{profile.projects?.length || 0} Production Systems</span>
                <span>•</span>
                <span>Available for Selected Engagements</span>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <a
                  href="#contact"
                  className="px-8 py-4 bg-[#121316] hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-full transition-all flex items-center gap-2 shadow-sm"
                >
                  Initiate Inquiry <ArrowRight size={14} />
                </a>
                <a
                  href="#projects"
                  className="px-8 py-4 bg-white hover:bg-[#f0eee9] border border-[#d8d6cf] text-[#121316] text-xs font-black uppercase tracking-widest rounded-full transition-all"
                >
                  Selected Works
                </a>
              </div>
            </div>

            {/* Avatar Editorial Frame */}
            {profile.avatar_url && (
              <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-full overflow-hidden border-4 border-white shadow-xl shrink-0 bg-[#e8e6e0]">
                <img 
                  src={profile.avatar_url} 
                  alt={profile.full_name} 
                  className="w-full h-full object-cover grayscale contrast-110 hover:grayscale-0 transition-all duration-700"
                />
              </div>
            )}
          </div>
        </section>

        {/* ── METRIC RIBBON ── */}
        {profile.hero_metrics && profile.hero_metrics.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-6 border-b border-[#e5e4e0]">
            {profile.hero_metrics.map((m, idx) => (
              <div key={idx} className="space-y-1">
                <div className="text-4xl font-black text-[#121316] tracking-tight">{m.value}</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#716e68]">{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── 01 // DOSSIER (BIO) ── */}
        {profile.bio && (
          <section id="about" className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#716e68]">01 / Narrative</span>
              <div className="h-px bg-[#e5e4e0] flex-1" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#121316] tracking-tight">Biography & Principles</h2>
            <p className="text-base sm:text-lg text-[#595752] leading-relaxed max-w-4xl whitespace-pre-line font-normal">
              {profile.bio}
            </p>
          </section>
        )}

        {/* ── 02 // COMPETENCIES (SKILLS MATRIX) ── */}
        <section id="skills" className="space-y-10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#716e68]">02 / Competencies</span>
            <div className="h-px bg-[#e5e4e0] flex-1" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
            {Object.entries(profile.skills || {}).map(([cat, list], idx) => {
              const skillArray = Array.isArray(list) ? list : [];
              return (
                <div key={idx} className="p-8 bg-white rounded-3xl border border-[#e5e4e0] shadow-xs space-y-5 hover:border-[#121316] transition-colors group">
                  <div className="flex items-center justify-between border-b border-[#f0eee9] pb-3">
                    <h3 className="text-sm font-black uppercase tracking-wider text-[#121316]">{cat}</h3>
                    <span className="text-[11px] font-mono text-[#716e68]">[{skillArray.length}]</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {skillArray.map((s, sIdx) => (
                      <span 
                        key={sIdx}
                        className="px-3.5 py-1.5 bg-[#faf9f6] border border-[#e5e4e0] rounded-xl text-xs font-semibold text-[#3b3935] hover:bg-[#121316] hover:text-white hover:border-[#121316] transition-colors cursor-default"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 03 // SELECTED WORKS (PROJECTS) ── */}
        <section id="projects" className="space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e5e4e0] pb-6">
            <div className="space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#716e68]">03 / Selected Works</span>
              <h2 className="text-3xl sm:text-4xl font-black text-[#121316] tracking-tight">Curated Production Deployments</h2>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {projectCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveFilter(c)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                    activeFilter === c
                      ? 'bg-[#121316] text-white'
                      : 'bg-white text-[#716e68] border border-[#e5e4e0] hover:text-[#121316]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-12">
            {filteredProjects.map((proj, idx) => (
              <motion.div
                key={idx}
                layout
                className="bg-white rounded-3xl border border-[#e5e4e0] shadow-xs overflow-hidden flex flex-col lg:flex-row justify-between hover:shadow-md transition-shadow group"
              >
                {proj.image_url && (
                  <div className="lg:w-1/2 h-64 lg:h-auto overflow-hidden bg-[#e8e6e0] border-b lg:border-b-0 lg:border-r border-[#e5e4e0]">
                    <img 
                      src={proj.image_url} 
                      alt={proj.title} 
                      className="w-full h-full object-cover grayscale contrast-110 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className={`p-8 sm:p-12 space-y-6 flex-1 flex flex-col justify-between ${!proj.image_url ? 'w-full' : ''}`}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono text-[#716e68]">
                      <span className="font-bold uppercase text-amber-700">{proj.category || 'PROJECT'}</span>
                      <span>{proj.year || '2026'}</span>
                    </div>

                    <h3 className="text-2xl sm:text-3xl font-black text-[#121316] leading-tight">{proj.title}</h3>
                    <p className="text-sm text-[#595752] leading-relaxed font-normal">{proj.description}</p>
                  </div>

                  {/* Highlights Grid */}
                  {proj.highlights && proj.highlights.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {proj.highlights.map((hl, hIdx) => (
                        <div key={hIdx} className="p-3 bg-[#faf9f6] rounded-2xl border border-[#e5e4e0]">
                          <div className="text-sm font-black text-[#121316]">{hl.value}</div>
                          <div className="text-[10px] font-bold text-[#716e68] uppercase">{hl.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tech stack */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {(proj.technologies || []).map((t, tIdx) => (
                      <span key={tIdx} className="px-3 py-1 bg-[#f0eee9] text-[#3b3935] text-xs font-semibold rounded-lg">
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-4 pt-6 border-t border-[#f0eee9]">
                    {proj.live_url && (
                      <a href={proj.live_url} target="_blank" rel="noreferrer" className="px-6 py-2.5 bg-[#121316] hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 shadow-sm">
                        <ExternalLink size={13} /> Live System
                      </a>
                    )}
                    {proj.github_url && (
                      <a href={proj.github_url} target="_blank" rel="noreferrer" className="px-6 py-2.5 bg-white hover:bg-[#f0eee9] border border-[#d8d6cf] text-[#121316] text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5">
                        <Github size={13} /> Repository
                      </a>
                    )}
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
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#716e68]">04 / Career Trajectory</span>
              <div className="h-px bg-[#e5e4e0] flex-1" />
            </div>

            <div className="space-y-6">
              {profile.experience.map((exp, idx) => (
                <div key={idx} className="p-8 bg-white rounded-3xl border border-[#e5e4e0] space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#f0eee9] pb-3">
                    <h3 className="text-lg font-black text-[#121316] flex items-center gap-2">
                      <Briefcase size={16} className="text-amber-700" />
                      {exp.role}
                    </h3>
                    <span className="text-xs font-mono font-bold text-[#716e68]">
                      {exp.start_date || 'Past'} – {exp.end_date || 'Present'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-[#716e68] uppercase tracking-wider">{exp.company} {exp.location ? `• ${exp.location}` : ''}</div>
                  <p className="text-sm text-[#595752] leading-relaxed font-normal whitespace-pre-line">{exp.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 05 // ACADEMY (EDUCATION) ── */}
        {profile.education && profile.education.length > 0 && (
          <section id="education" className="space-y-10">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[#716e68]">05 / Academic Credentials</span>
              <div className="h-px bg-[#e5e4e0] flex-1" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {profile.education.map((edu, idx) => (
                <div key={idx} className="p-8 bg-white rounded-3xl border border-[#e5e4e0] space-y-3 shadow-xs">
                  <div className="flex justify-between items-start text-xs font-mono text-[#716e68]">
                    <GraduationCap size={20} className="text-amber-700" />
                    <span>{edu.graduation_year}</span>
                  </div>
                  <h3 className="text-lg font-black text-[#121316]">{edu.degree}</h3>
                  <div className="text-xs font-bold text-[#716e68]">{edu.institution}</div>
                  {edu.grade && (
                    <div className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full inline-block mt-2">
                      Score: {edu.grade}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 06 // CONTACT / ENGAGEMENT ── */}
        <section id="contact" className="space-y-8 max-w-xl mx-auto text-center pt-8">
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-[#716e68]">Inquiries</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#121316] tracking-tight">Initiate an Engagement</h2>
          </div>

          <form onSubmit={handleContactSubmit} className="p-8 sm:p-10 bg-white rounded-3xl border border-[#e5e4e0] shadow-md text-left space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#121316]">Full Name</label>
              <input
                type="text"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                className="w-full px-4 py-3 bg-[#faf9f6] border border-[#e5e4e0] rounded-2xl text-xs font-semibold outline-none focus:border-[#121316]"
                placeholder="Ada Lovelace"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#121316]">Email Address</label>
              <input
                type="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full px-4 py-3 bg-[#faf9f6] border border-[#e5e4e0] rounded-2xl text-xs font-semibold outline-none focus:border-[#121316]"
                placeholder="ada@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#121316]">Project / Opportunity Details</label>
              <textarea
                rows={4}
                required
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                className="w-full px-4 py-3 bg-[#faf9f6] border border-[#e5e4e0] rounded-2xl text-xs font-medium outline-none focus:border-[#121316] leading-relaxed"
                placeholder="Details regarding your project or position..."
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={sending}
              className="w-full py-4 mt-2 bg-[#121316] hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send size={14} /> {sending ? 'Transmitting...' : 'Send Message'}
            </motion.button>
          </form>
        </section>

        {/* ── FOOTER ── */}
        <footer className="pt-10 border-t border-[#e5e4e0] text-center text-xs text-[#8c8983]">
          © {new Date().getFullYear()} {profile.full_name} • Minimalist Elegance Architecture
        </footer>

      </main>
    </div>
  );
}
