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
  Code
} from 'lucide-react';

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
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const allProjects = profile.projects || [];
  const projectCategories = ['ALL', ...Array.from(new Set(allProjects.map(p => (p.category || 'SYSTEM').toUpperCase()).filter(Boolean)))];
  
  const filteredProjects = activeTab === 'ALL'
    ? allProjects
    : allProjects.filter(p => (p.category || '').toUpperCase() === activeTab);

  return (
    <div className="min-h-screen bg-[#03060c] text-cyan-400 font-mono relative selection:bg-cyan-500 selection:text-black overflow-x-hidden">
      
      <div 
        className="fixed inset-0 pointer-events-none opacity-25 z-0"
        style={{
          backgroundImage: 'linear-gradient(to right, #00f0ff 1px, transparent 1px), linear-gradient(to bottom, #00f0ff 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(3,6,12,0.85)_100%)] z-1" />

      <header className="sticky top-0 left-0 w-full z-40 bg-[#03060c]/90 backdrop-blur-xl border-b border-cyan-500/40 shadow-[0_0_20px_rgba(0,240,255,0.15)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-cyan-400 animate-ping rounded-full inline-block" />
            <span className="text-white font-black tracking-widest text-sm uppercase flex items-center gap-1.5">
              <span className="text-cyan-400">[NODE]</span> {profile.full_name || 'NEURAL_UNIT'}
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-[11px] font-black tracking-widest text-cyan-300">
            <a href="#about" className="hover:text-yellow-400 hover:shadow-[0_0_10px_rgba(255,230,0,0.5)] transition-all">01_ARCHIVE</a>
            <a href="#skills" className="hover:text-yellow-400 hover:shadow-[0_0_10px_rgba(255,230,0,0.5)] transition-all">02_MATRIX</a>
            <a href="#projects" className="hover:text-yellow-400 hover:shadow-[0_0_10px_rgba(255,230,0,0.5)] transition-all">03_PROJECTS</a>
            <a href="#experience" className="hover:text-yellow-400 hover:shadow-[0_0_10px_rgba(255,230,0,0.5)] transition-all">04_TIMELINE</a>
            <a href="#education" className="hover:text-yellow-400 hover:shadow-[0_0_10px_rgba(255,230,0,0.5)] transition-all">05_EDUCATION</a>
            <a href="#contact" className="hover:text-yellow-400 hover:shadow-[0_0_10px_rgba(255,230,0,0.5)] transition-all">06_DISPATCH</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={handleResumeDownload}
              className="px-4 py-2 bg-cyan-500 hover:bg-yellow-400 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all cursor-pointer"
            >
              <Download size={13} /> DUMP_RESUME.DAT
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-cyan-400"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#03060c] border-b border-cyan-500/40 px-6 py-4 space-y-3">
            {['About', 'Skills', 'Projects', 'Experience', 'Education', 'Contact'].map((item, idx) => (
              <a 
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-xs font-black uppercase tracking-widest text-cyan-300 hover:text-yellow-400"
              >
                0{idx + 1}_{item.toUpperCase()}
              </a>
            ))}
          </div>
        )}
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-24 space-y-28">
        
        <section className="pt-6 sm:pt-12 pb-8 flex flex-col-reverse lg:flex-row items-center justify-between gap-12 border-b border-cyan-500/20 pb-16">
          <div className="space-y-6 max-w-2xl text-center lg:text-left">
            
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/60 border border-cyan-500/50 text-[11px] text-cyan-300 font-bold uppercase tracking-widest shadow-[0_0_10px_rgba(0,240,255,0.2)]">
              <Activity size={13} className="text-yellow-400 animate-pulse" />
              STATUS // ACTIVE_DEPLOYED • {profile.hero_badge || 'CLEARANCE_ALPHA'}
            </div>

            <div className="space-y-2">
              <h1 className={`text-4xl sm:text-6xl font-black tracking-tight text-white uppercase ${glitchActive ? 'translate-x-1 text-yellow-400' : ''} transition-all`}>
                {profile.full_name}
              </h1>
              <div className="text-lg sm:text-xl font-bold text-yellow-400 flex items-center justify-center lg:justify-start gap-2">
                <span className="text-cyan-600">ROLE_SPEC //</span>
                <span className="bg-black px-2 py-0.5 border border-yellow-400/40 text-yellow-300">{typedText}_</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-cyan-200/80 leading-relaxed font-mono max-w-xl">
              {profile.headline || 'OPERATING DISTRIBUTED INTELLIGENCE PLATFORMS & HIGH-PERFORMANCE PRODUCTION APPARATUS.'}
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <a 
                href="#projects" 
                className="px-6 py-3 bg-cyan-500 hover:bg-yellow-400 text-black text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all cursor-pointer"
              >
                EXECUTE_PROJECTS <Zap size={14} />
              </a>
              <a 
                href="#contact" 
                className="px-6 py-3 bg-black hover:bg-cyan-950/80 border border-cyan-500 text-cyan-300 text-xs font-black uppercase tracking-widest transition-all"
              >
                TRANSMIT_SIGNAL
              </a>
            </div>

            <div className="flex items-center justify-center lg:justify-start gap-3 pt-3">
              {profile.social_links?.github && (
                <a href={profile.social_links.github} target="_blank" rel="noreferrer" className="p-2.5 bg-black border border-cyan-500/40 text-cyan-400 hover:text-yellow-400 hover:border-yellow-400 transition-all">
                  <Github size={16} />
                </a>
              )}
              {profile.social_links?.linkedin && (
                <a href={profile.social_links.linkedin} target="_blank" rel="noreferrer" className="p-2.5 bg-black border border-cyan-500/40 text-cyan-400 hover:text-yellow-400 hover:border-yellow-400 transition-all">
                  <Linkedin size={16} />
                </a>
              )}
              {profile.location && (
                <div className="flex items-center gap-1.5 text-xs text-cyan-400 bg-black px-3 py-2 border border-cyan-500/40">
                  <MapPin size={13} className="text-yellow-400" />
                  <span>GEO_LOC // {profile.location}</span>
                </div>
              )}
            </div>
          </div>

          <div className="relative group shrink-0">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-yellow-400 opacity-40 blur-md group-hover:opacity-100 transition-opacity" />
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 bg-black border-2 border-cyan-400 p-2 shadow-[0_0_25px_rgba(0,240,255,0.3)] overflow-hidden">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-yellow-400 z-10" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-yellow-400 z-10" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-yellow-400 z-10" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-yellow-400 z-10" />

              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.full_name} 
                  className="w-full h-full object-cover grayscale contrast-125 hover:grayscale-0 transition-all duration-500"
                />
              ) : (
                <div className="w-full h-full bg-cyan-950/40 flex items-center justify-center text-cyan-400 text-6xl font-black">
                  {(profile.full_name || 'C')[0]}
                </div>
              )}
              <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 text-[9px] text-cyan-400 border border-cyan-500/40 font-mono">
                BIO_SCAN // VERIFIED
              </div>
            </div>
          </div>
        </section>

        {profile.hero_metrics && profile.hero_metrics.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {profile.hero_metrics.map((m, idx) => (
              <div key={idx} className="p-5 bg-black border border-cyan-500/40 text-center space-y-1 shadow-[0_0_15px_rgba(0,240,255,0.08)]">
                <div className="text-3xl font-black text-yellow-400">{m.value}</div>
                <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {profile.bio && (
          <section id="about" className="space-y-4">
            <div className="border border-cyan-500/40 bg-black/80 p-6 sm:p-8 space-y-3 relative shadow-[0_0_20px_rgba(0,240,255,0.1)]">
              <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2">
                <span className="text-xs font-black text-yellow-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Terminal size={14} /> 01 // ARCHIVAL_SUMMARY
                </span>
                <span className="text-[10px] text-cyan-600">ENCRYPTION: AES-256</span>
              </div>
              <p className="text-xs sm:text-sm text-cyan-200/90 leading-relaxed font-mono whitespace-pre-line">
                {profile.bio}
              </p>
            </div>
          </section>
        )}

        <section id="skills" className="space-y-8">
          <div className="flex items-center justify-between border-b border-cyan-500/40 pb-3">
            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Cpu size={18} className="text-cyan-400" /> 02 // NEURAL_MATRIX
            </h2>
            <span className="text-xs text-yellow-400 font-bold">SYNAPSE_LOAD: 100%</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {Object.entries(profile.skills || {}).map(([cat, list], idx) => {
              const skillArray = Array.isArray(list) ? list : [];
              return (
                <div key={idx} className="bg-black border border-cyan-500/40 p-6 space-y-4 shadow-[0_0_15px_rgba(0,240,255,0.06)] hover:border-yellow-400 transition-colors group">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300 group-hover:text-yellow-400 transition-colors">
                      {cat}
                    </h3>
                    <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 border border-yellow-400/30">
                      [{skillArray.length}]
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {skillArray.map((s, sIdx) => (
                      <span key={sIdx} className="px-2.5 py-1 bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-xs hover:border-yellow-400 hover:text-yellow-300 transition-all cursor-default">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="projects" className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-cyan-500/40 pb-3">
            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Zap size={18} className="text-yellow-400" /> 03 // DEPLOYED_SYSTEMS ({filteredProjects.length})
            </h2>

            <div className="flex flex-wrap gap-2">
              {projectCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveTab(c)}
                  className={`px-3 py-1 text-xs font-bold uppercase transition-all cursor-pointer ${
                    activeTab === c
                      ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                      : 'bg-black text-cyan-400 border border-cyan-500/40 hover:border-yellow-400 hover:text-yellow-400'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            {filteredProjects.map((proj, idx) => (
              <div key={idx} className="bg-black border-2 border-cyan-500/40 flex flex-col justify-between overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.1)] hover:border-yellow-400 transition-colors group">
                
                <div className="px-4 py-2 bg-cyan-950/60 border-b border-cyan-500/40 flex items-center justify-between text-[10px] text-cyan-300">
                  <span className="font-bold uppercase tracking-wider text-yellow-400">{proj.category || 'PROJECT'}</span>
                  <span>BUILD_TIMESTAMP // {proj.year || '2026'}</span>
                </div>

                {proj.image_url && (
                  <div className="relative h-48 overflow-hidden bg-black border-b border-cyan-500/40">
                    <img 
                      src={proj.image_url} 
                      alt={proj.title} 
                      className="w-full h-full object-cover grayscale contrast-125 group-hover:grayscale-0 transition-all duration-500"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-white group-hover:text-yellow-400 transition-colors">{proj.title}</h3>
                    <p className="text-xs text-cyan-200/80 leading-relaxed font-mono">{proj.description}</p>
                  </div>

                  {proj.highlights && proj.highlights.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {proj.highlights.map((hl, hIdx) => (
                        <div key={hIdx} className="p-2 bg-cyan-950/30 border border-cyan-500/30">
                          <div className="text-xs font-black text-yellow-400">{hl.value}</div>
                          <div className="text-[9px] font-bold text-cyan-400 uppercase">{hl.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(proj.technologies || []).map((t, tIdx) => (
                      <span key={tIdx} className="px-2 py-0.5 bg-black border border-cyan-500/40 text-[10px] text-cyan-300">
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-cyan-500/30">
                    {proj.live_url && (
                      <a href={proj.live_url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-cyan-500 hover:bg-yellow-400 text-black text-xs font-black uppercase flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,240,255,0.4)]">
                        <ExternalLink size={12} /> LIVE_SYSTEM
                      </a>
                    )}
                    {proj.github_url && (
                      <a href={proj.github_url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-black hover:bg-cyan-950/80 border border-cyan-500 text-cyan-300 text-xs font-black uppercase flex items-center gap-1.5">
                        <Github size={12} /> REPOSITORY
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {profile.experience && profile.experience.length > 0 && (
          <section id="experience" className="space-y-8">
            <div className="flex items-center justify-between border-b border-cyan-500/40 pb-3">
              <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                <Briefcase size={18} className="text-cyan-400" /> 04 // MISSION_TIMELINE
              </h2>
            </div>

            <div className="space-y-4">
              {profile.experience.map((exp, idx) => (
                <div key={idx} className="p-6 bg-black border border-cyan-500/40 space-y-3 hover:border-yellow-400 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-cyan-500/20 pb-2">
                    <h3 className="text-base font-black text-white uppercase">{exp.role}</h3>
                    <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 border border-yellow-400/30">
                      {exp.start_date || 'INIT'} – {exp.end_date || 'ACTIVE'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-cyan-400">ORG // {exp.company} {exp.location ? `• [${exp.location}]` : ''}</div>
                  <p className="text-xs text-cyan-200/80 leading-relaxed whitespace-pre-line">{exp.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {profile.education && profile.education.length > 0 && (
          <section id="education" className="space-y-8">
            <div className="flex items-center justify-between border-b border-cyan-500/40 pb-3">
              <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                <GraduationCap size={18} className="text-yellow-400" /> 05 // ACADEMIC_CREDENTIALS
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profile.education.map((edu, idx) => (
                <div key={idx} className="p-6 bg-black border border-cyan-500/40 space-y-2 hover:border-yellow-400 transition-colors">
                  <div className="flex justify-between items-start text-xs text-yellow-400">
                    <span className="uppercase">INSTITUTE_RECORD</span>
                    <span>{edu.graduation_year}</span>
                  </div>
                  <h3 className="text-base font-black text-white uppercase">{edu.degree}</h3>
                  <div className="text-xs text-cyan-400">{edu.institution}</div>
                  {edu.grade && (
                    <div className="text-xs text-yellow-300 font-bold pt-1">SCORE_GRADE // {edu.grade}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section id="contact" className="space-y-8 max-w-xl mx-auto text-center">
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-yellow-400">06 // INBOUND_COMMUNICATION</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-widest">DISPATCH PACKET</h2>
          </div>

          <form onSubmit={handleContactSubmit} className="p-6 sm:p-8 bg-black border-2 border-cyan-500 text-left space-y-4 shadow-[0_0_30px_rgba(0,240,255,0.15)]">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-cyan-300 uppercase">TRANSMITTER_ID (NAME)</label>
              <input
                type="text"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#03060c] border border-cyan-500/60 text-white text-xs font-mono outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-cyan-300 uppercase">FREQUENCY_LINK (EMAIL)</label>
              <input
                type="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#03060c] border border-cyan-500/60 text-white text-xs font-mono outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-cyan-300 uppercase">PAYLOAD_STREAM (MESSAGE)</label>
              <textarea
                rows={4}
                required
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#03060c] border border-cyan-500/60 text-white text-xs font-mono outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 leading-relaxed"
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="w-full py-3.5 bg-cyan-500 hover:bg-yellow-400 text-black text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(0,240,255,0.4)] disabled:opacity-50 transition-all"
            >
              <Send size={14} /> {sending ? 'TRANSMITTING...' : 'TRANSMIT_SIGNAL'}
            </button>
          </form>
        </section>

        <footer className="pt-8 border-t border-cyan-500/30 text-center text-xs text-cyan-700">
          SYS_LOG // {new Date().getFullYear()} {profile.full_name} • CYBERNETIC HUD MATRIX ARCHITECTURE
        </footer>

      </main>
    </div>
  );
}
