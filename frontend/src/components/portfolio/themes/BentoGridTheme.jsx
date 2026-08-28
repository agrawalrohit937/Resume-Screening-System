import React, { useState, useEffect } from 'react';
import { 
  ExternalLink, 
  Github, 
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
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Animation Variants ---
const fadeUp = {
  hidden: { opacity: 0, y: 40, filter: 'blur(10px)' },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)',
    transition: { type: "spring", stiffness: 200, damping: 20 } 
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const BentoCard = ({ children, className = "", delay = 0, colSpan = 1, rowSpan = 1 }) => (
  <motion.div
    variants={fadeUp}
    whileHover={{ 
      y: -5, 
      scale: 1.01,
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.08)"
    }}
    className={`bg-white/80 backdrop-blur-2xl rounded-[32px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative group ${className}`}
    style={{ 
      gridColumn: `span ${colSpan} / span ${colSpan}`,
      gridRow: `span ${rowSpan} / span ${rowSpan}`
    }}
  >
    {/* Subtle inner glow on hover */}
    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    {children}
  </motion.div>
);

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

  const typingWords = (profile.typing_roles && profile.typing_roles.length > 0)
    ? profile.typing_roles
    : [profile.headline || 'Product Engineer', 'Full-Stack Developer', 'AI Specialist'];

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

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 font-sans selection:bg-amber-500 selection:text-white relative overflow-hidden">
      
      {/* --- Ambient Background Glows --- */}
      <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-amber-400/20 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-orange-400/10 blur-[150px] pointer-events-none" />
      
      {/* ── Nav Header (Floating Pill Design) ── */}
      <header className="fixed top-4 left-0 w-full z-50 px-4 sm:px-6 pointer-events-none">
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="max-w-5xl mx-auto h-16 bg-white/70 backdrop-blur-xl border border-white/50 shadow-lg shadow-slate-200/50 rounded-full flex items-center justify-between px-6 pointer-events-auto"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white font-black shadow-inner">
              {(profile.full_name || 'P')[0]}
            </div>
            <span className="font-black text-slate-900 text-sm tracking-tight hidden sm:block">
              {profile.full_name}
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-[11px] font-black uppercase tracking-widest text-slate-500">
            <a href="#about" className="hover:text-amber-600 transition-colors">About</a>
            <a href="#skills" className="hover:text-amber-600 transition-colors">Stack</a>
            <a href="#projects" className="hover:text-amber-600 transition-colors">Work</a>
            <a href="#experience" className="hover:text-amber-600 transition-colors">Journey</a>
          </nav>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleResumeDownload}
              className="hidden sm:flex px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-full items-center gap-2 shadow-md shadow-slate-900/20 transition-all"
            >
              <Download size={14} /> Resume
            </motion.button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-700 bg-slate-100 rounded-full"
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
              className="md:hidden absolute top-20 left-4 right-4 bg-white/90 backdrop-blur-2xl border border-white rounded-3xl p-6 shadow-2xl pointer-events-auto flex flex-col gap-4"
            >
              {['About', 'Skills', 'Projects', 'Experience', 'Contact'].map((item) => (
                <a 
                  key={item}
                  href={`#${item.toLowerCase()}`} 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="text-lg font-black text-slate-800 border-b border-slate-100 pb-2"
                >
                  {item}
                </a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-32 pb-24 space-y-6">
        
        {/* ── BENTO HERO GRID ── */}
        <motion.section 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-4 md:auto-rows-[220px] gap-6"
        >
          {/* Main Identity (Spans 2 cols, 2 rows) */}
          <BentoCard colSpan={2} rowSpan={2} className="p-8 sm:p-12 flex flex-col justify-between bg-gradient-to-br from-white to-slate-50/50">
            <div className="space-y-6">
              {profile.hero_badge && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100/50 border border-amber-200/80 text-amber-800 text-xs font-black tracking-wide">
                    <Sparkles size={14} className="text-amber-500" />
                    {profile.hero_badge}
                  </span>
                </motion.div>
              )}
              <h1 className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tighter leading-[1.1]">
                {profile.full_name}
              </h1>
              <div className="h-8">
                <span className="text-xl font-bold text-slate-500">I am a </span>
                <span className="text-xl font-black text-amber-500">{typedText}</span>
                <motion.span 
                  animate={{ opacity: [1, 0] }} 
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="inline-block w-3 h-5 bg-amber-500 ml-1 align-middle"
                />
              </div>
              <p className="text-slate-600 leading-relaxed font-medium max-w-md text-sm sm:text-base">
                {profile.headline || 'Building high-impact systems, software products, and intelligence platforms.'}
              </p>
            </div>
            <div className="flex items-center gap-4 pt-8">
              <a href="#contact" className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-black rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-95">
                Let's Talk
              </a>
              <a href="#projects" className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-900 hover:bg-slate-50 transition-colors shadow-sm">
                <ArrowUpRight size={24} />
              </a>
            </div>
          </BentoCard>

          {/* Avatar Tile */}
          <BentoCard colSpan={1} rowSpan={1} className="p-2 bg-gradient-to-tr from-amber-100 to-orange-50">
            <div className="w-full h-full rounded-[24px] overflow-hidden relative group">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-6xl">
                  {(profile.full_name || 'C')[0]}
                </div>
              )}
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
            </div>
          </BentoCard>

          {/* Location Tile */}
          <BentoCard colSpan={1} rowSpan={1} className="p-8 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
              <MapPin size={28} className="text-amber-500" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Location</div>
              <div className="text-lg font-black text-slate-800">{profile.location || 'Planet Earth'}</div>
            </div>
          </BentoCard>

          {/* Metrics / Mini Bio spanning bottom right */}
          <BentoCard colSpan={2} rowSpan={1} className="p-8 flex flex-col justify-center bg-slate-900 text-white">
            <h3 className="text-lg font-black mb-4 flex items-center gap-2">
              <Layers size={18} className="text-amber-400" /> The Philosophy
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed font-medium line-clamp-3">
              {profile.bio || "Engineering scalable architectures with a focus on seamless user experiences and robust backend performance. Driven by aesthetics and data."}
            </p>
          </BentoCard>
        </motion.section>

        {/* ── METRICS GRID ── */}
        {profile.hero_metrics && profile.hero_metrics.length > 0 && (
          <motion.section 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {profile.hero_metrics.map((m, idx) => (
              <BentoCard key={idx} className="p-8 text-center flex flex-col justify-center items-center gap-2 group hover:bg-amber-500 hover:text-white transition-colors duration-300">
                <div className="text-4xl font-black text-slate-900 group-hover:text-white transition-colors">{m.value}</div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-amber-100 transition-colors">{m.label}</div>
              </BentoCard>
            ))}
          </motion.section>
        )}

        {/* ── BENTO SKILLS BREAKDOWN ── */}
        <motion.section 
          id="skills" 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="pt-12"
        >
          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Technical Arsenal</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {Object.entries(profile.skills || {}).map(([cat, list], idx) => {
              const skillArray = Array.isArray(list) ? list : [];
              return (
                <BentoCard key={idx} className="p-8 flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
                      {cat}
                    </h3>
                    <span className="w-8 h-8 flex items-center justify-center text-xs font-black text-amber-600 bg-amber-50 rounded-full">
                      {skillArray.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {skillArray.map((s, sIdx) => (
                      <span key={sIdx} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all cursor-default">
                        {s}
                      </span>
                    ))}
                  </div>
                </BentoCard>
              );
            })}
          </div>
        </motion.section>

        {/* ── CASE STUDIES (PROJECTS) ── */}
        <motion.section 
          id="projects" 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="pt-12"
        >
          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Featured Case Studies</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(profile.projects || []).map((proj, idx) => (
              <BentoCard key={idx} className="flex flex-col overflow-hidden group">
                {proj.image_url && (
                  <div className="relative h-64 overflow-hidden bg-slate-100 border-b border-white/50">
                    <img 
                      src={proj.image_url} 
                      alt={proj.title} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Hover Action Buttons */}
                    <div className="absolute bottom-4 right-4 flex gap-2 translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      {proj.live_url && (
                        <a href={proj.live_url} target="_blank" rel="noreferrer" className="w-10 h-10 bg-white text-slate-900 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg">
                          <ExternalLink size={16} />
                        </a>
                      )}
                      {proj.github_url && (
                        <a href={proj.github_url} target="_blank" rel="noreferrer" className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg">
                          <Github size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                )}
                <div className="p-8 space-y-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      <span className="text-amber-600">{proj.category || 'PROJECT'}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span>{proj.year || '2026'}</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">{proj.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">{proj.description}</p>
                  </div>

                  <div className="space-y-4">
                    {/* Highlights */}
                    {proj.highlights && proj.highlights.length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {proj.highlights.map((hl, hIdx) => (
                          <div key={hIdx} className="p-3 bg-amber-50/50 rounded-2xl border border-amber-100/50">
                            <div className="text-sm font-black text-slate-900">{hl.value}</div>
                            <div className="text-[10px] font-bold text-amber-700 uppercase">{hl.label}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tech Stack */}
                    <div className="flex flex-wrap gap-1.5">
                      {(proj.technologies || []).map((t, tIdx) => (
                        <span key={tIdx} className="px-3 py-1.5 bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-wider rounded-lg border border-slate-100">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </BentoCard>
            ))}
          </div>
        </motion.section>

        {/* ── BENTO EXPERIENCE & EDUCATION ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-12">
          {/* Experience */}
          {profile.experience && profile.experience.length > 0 && (
            <motion.section 
              id="experience"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-8">Journey</h2>
              <div className="space-y-4">
                {profile.experience.map((exp, idx) => (
                  <BentoCard key={idx} className="p-8">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-600">
                        <Briefcase size={20} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-slate-900">{exp.role}</h3>
                          <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            {exp.start_date || 'Past'} - {exp.end_date || 'Present'}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-amber-600">
                          {exp.company} {exp.location ? `• ${exp.location}` : ''}
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium pt-2 whitespace-pre-line">
                          {exp.description}
                        </p>
                      </div>
                    </div>
                  </BentoCard>
                ))}
              </div>
            </motion.section>
          )}

          {/* Education */}
          {profile.education && profile.education.length > 0 && (
            <motion.section 
              id="education"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-8">Education</h2>
              <div className="space-y-4">
                {profile.education.map((edu, idx) => (
                  <BentoCard key={idx} className="p-8">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-600">
                        <GraduationCap size={20} />
                      </div>
                      <div className="space-y-1 w-full">
                        <div className="flex justify-between items-start">
                          <h3 className="text-lg font-black text-slate-900 leading-tight pr-4">{edu.degree}</h3>
                          {edu.graduation_year && (
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                              {edu.graduation_year}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-slate-500">{edu.institution}</div>
                        {edu.grade && (
                          <div className="text-xs font-black text-emerald-500 bg-emerald-50 inline-block px-2 py-1 rounded-lg mt-2">
                            Score: {edu.grade}
                          </div>
                        )}
                      </div>
                    </div>
                  </BentoCard>
                ))}
              </div>
            </motion.section>
          )}
        </div>

        {/* ── CONTACT ── */}
        <motion.section 
          id="contact" 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="pt-20 pb-10"
        >
          <BentoCard className="max-w-2xl mx-auto p-10 sm:p-14 text-center">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Let's Build Together</h2>
            <p className="text-slate-500 font-medium mb-8">Currently open for new opportunities and collaborations.</p>
            
            <form onSubmit={handleContactSubmit} className="text-left space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50/50 border border-slate-200/80 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-5 py-4 bg-slate-50/50 border border-slate-200/80 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Project Details</label>
                <textarea
                  rows={4}
                  required
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50/50 border border-slate-200/80 rounded-2xl text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 transition-all resize-y"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={sending}
                className="w-full py-5 mt-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-black rounded-2xl shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <Send size={16} /> {sending ? 'Transmitting...' : 'Send Message'}
              </motion.button>
            </form>
          </BentoCard>
        </motion.section>

      </main>
    </div>
  );
}