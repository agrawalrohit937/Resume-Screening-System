import React, { useState, useEffect, useRef } from 'react';
import { 
  Code2, 
  Terminal, 
  ExternalLink, 
  Github, 
  Linkedin, 
  Download, 
  Send, 
  Sparkles, 
  Copy, 
  Check,
  FolderGit2,
  Menu,
  X,
  Briefcase,
  GraduationCap,
  Play,
  CornerDownLeft,
  FileCode,
  GitBranch,
  GitCommit,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function NeonDeveloperTheme({
  profile,
  username,
  handleResumeDownload,
  handleContactSubmit,
  contactForm,
  setContactForm,
  sending
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('main.py');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [roleIdx, setRoleIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Interactive In-Browser CLI State
  const [cliInput, setCliInput] = useState('');
  const [cliHistory, setCliHistory] = useState([
    { type: 'system', text: '⚡ Welcome to DevOS Terminal v2.4. Type "help" to list available commands.' },
    { type: 'system', text: `👤 Logged in as: guest@${(profile.full_name || 'developer').toLowerCase().replace(/\s+/g, '-')}` }
  ]);
  const cliBottomRef = useRef(null);

  const typingWords = (profile.typing_roles && profile.typing_roles.length > 0)
    ? profile.typing_roles
    : [profile.headline || 'Full-Stack Developer', 'Systems Architect', 'AI Engineer'];

  useEffect(() => {
    const currentWord = typingWords[roleIdx % typingWords.length];
    let timer;
    if (!isDeleting) {
      if (typedText.length < currentWord.length) {
        timer = setTimeout(() => setTypedText(currentWord.slice(0, typedText.length + 1)), 60);
      } else {
        timer = setTimeout(() => setIsDeleting(true), 2200);
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

  const copyCloneCmd = () => {
    navigator.clipboard.writeText(`git clone https://github.com/${username || 'developer'}/portfolio.git`);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  // Interactive CLI command execution
  const handleCliSubmit = (e) => {
    e.preventDefault();
    const cmd = cliInput.trim().toLowerCase();
    if (!cmd) return;

    const newHistory = [...cliHistory, { type: 'user', text: `$ ${cliInput}` }];

    if (cmd === 'help') {
      newHistory.push({
        type: 'output',
        text: 'Available commands: whoami | skills | projects | experience | contact | resume | clear'
      });
    } else if (cmd === 'whoami') {
      newHistory.push({
        type: 'output',
        text: `${profile.full_name} — ${profile.headline || 'Software & AI Engineer'} (Location: ${profile.location || 'Remote'})`
      });
    } else if (cmd === 'skills') {
      const allS = Object.entries(profile.skills || {}).map(([cat, list]) => `${cat}: [${list.join(', ')}]`).join('\n');
      newHistory.push({ type: 'output', text: allS || 'No skills found.' });
    } else if (cmd === 'projects') {
      const projNames = (profile.projects || []).map((p, i) => `#${i + 1} ${p.title} (${(p.technologies || []).join(', ')})`).join('\n');
      newHistory.push({ type: 'output', text: projNames || 'No projects listed.' });
    } else if (cmd === 'experience') {
      const expList = (profile.experience || []).map(e => `${e.role} @ ${e.company} (${e.start_date || 'Past'} - ${e.end_date || 'Present'})`).join('\n');
      newHistory.push({ type: 'output', text: expList || 'No experience listed.' });
    } else if (cmd === 'resume') {
      handleResumeDownload();
      newHistory.push({ type: 'output', text: '📥 Triggered resume download...' });
    } else if (cmd === 'contact') {
      const contactElem = document.getElementById('contact');
      if (contactElem) contactElem.scrollIntoView({ behavior: 'smooth' });
      newHistory.push({ type: 'output', text: '📬 Navigated to contact dispatch...' });
    } else if (cmd === 'clear') {
      setCliHistory([]);
      setCliInput('');
      return;
    } else {
      newHistory.push({
        type: 'error',
        text: `zsh: command not found: ${cmd}. Type "help" for a list of valid commands.`
      });
    }

    setCliHistory(newHistory);
    setCliInput('');
  };

  useEffect(() => {
    if (cliBottomRef.current) {
      cliBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [cliHistory]);

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-200 font-mono selection:bg-emerald-500 selection:text-black">
      
      {/* ── IDE TOP TITLE BAR ── */}
      <header className="sticky top-0 left-0 w-full z-40 bg-[#161b22] border-b border-slate-800 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/90 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/90 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/90 inline-block" />
            </div>
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <GitBranch size={13} className="text-emerald-400" />
              <span>workspace ~/</span> <span className="text-emerald-400 font-black">{profile.full_name}</span>
            </span>
          </div>

          {/* IDE Tabs */}
          <div className="hidden md:flex items-center gap-1.5">
            {[
              { label: 'main.py', href: '#home' },
              { label: 'skills.json', href: '#skills' },
              { label: 'projects.ts', href: '#projects' },
              { label: 'experience.md', href: '#experience' },
              { label: 'education.json', href: '#education' },
              { label: 'contact.sh', href: '#contact' }
            ].map((tab) => (
              <a
                key={tab.label}
                href={tab.href}
                onClick={() => setActiveTab(tab.label)}
                className={`px-3 py-1.5 text-xs rounded-md border flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.label 
                    ? 'bg-[#0b0f17] text-emerald-400 border-slate-700 font-bold' 
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                <FileCode size={12} className={activeTab === tab.label ? 'text-emerald-400' : 'text-slate-600'} />
                {tab.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleResumeDownload}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black rounded-lg flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 cursor-pointer"
            >
              <Download size={13} /> export.pdf
            </motion.button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-slate-400 hover:text-white"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#161b22] border-b border-slate-800 px-6 py-4 space-y-3">
            {['Home', 'Skills', 'Projects', 'Experience', 'Education', 'Contact'].map((item) => (
              <a 
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-xs font-bold text-slate-300 hover:text-emerald-400"
              >
                ./{item.toLowerCase()}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ── MAIN IDE WORKSPACE ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-24 space-y-28">
        
        {/* ── HERO & CLI BAR (main.py) ── */}
        <section id="home" className="space-y-8">
          <div className="bg-[#161b22] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 py-3 bg-[#0f141c] border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <FileCode size={14} className="text-emerald-400" /> main.py
              </span>
              <button 
                onClick={copyCloneCmd}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-md text-[11px] font-bold cursor-pointer transition-colors"
              >
                {copiedCmd ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copiedCmd ? 'Copied' : 'Clone Repo'}
              </button>
            </div>

            <div className="p-6 sm:p-10 space-y-6">
              <div className="space-y-3">
                <div className="text-xs text-slate-500">
                  # Developer Profile Specification // Python 3.12
                </div>
                <div className="text-sm font-bold text-purple-400">
                  class <span className="text-yellow-400">{profile.full_name.replace(/\s+/g, '')}</span>(SeniorEngineer):
                </div>

                <div className="pl-4 sm:pl-6 space-y-2 border-l-2 border-slate-800">
                  <div className="text-xs sm:text-sm text-slate-300">
                    <span className="text-cyan-400">name</span> = <span className="text-emerald-300">"{profile.full_name}"</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-300">
                    <span className="text-cyan-400">current_role</span> = <span className="text-emerald-300">"{typedText}"</span>
                    <span className="w-2 h-4 bg-emerald-400 ml-1 inline-block animate-pulse align-middle" />
                  </div>
                  <div className="text-xs sm:text-sm text-slate-300">
                    <span className="text-cyan-400">status</span> = <span className="text-yellow-300">"{profile.hero_badge || 'Open to Opportunities'}"</span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-300">
                    <span className="text-cyan-400">headline</span> = <span className="text-slate-400">"""{profile.headline || 'Building high-impact systems & platforms'}"""</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-800/80">
                <a
                  href="#projects"
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Play size={13} /> run_projects.sh
                </a>
                <a
                  href="#contact"
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700"
                >
                  init_contact()
                </a>
              </div>
            </div>
          </div>

          {/* ── INTERACTIVE IN-BROWSER CLI TERMINAL ── */}
          <div className="bg-[#0f141c] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs text-slate-400">
              <span className="flex items-center gap-2 font-bold text-emerald-400">
                <Terminal size={14} /> Interactive Terminal
              </span>
              <span className="text-[10px] text-slate-500">Press ENTER to run command (Try: help, whoami, skills, projects, resume)</span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs font-mono text-slate-300 scrollbar-thin">
              {cliHistory.map((item, idx) => (
                <div key={idx} className={item.type === 'error' ? 'text-rose-400' : item.type === 'user' ? 'text-yellow-300 font-bold' : item.type === 'system' ? 'text-slate-500' : 'text-emerald-300 whitespace-pre-wrap'}>
                  {item.text}
                </div>
              ))}
              <div ref={cliBottomRef} />
            </div>

            <form onSubmit={handleCliSubmit} className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
              <span className="text-emerald-400 font-bold">$</span>
              <input
                type="text"
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                placeholder="type command here (e.g. 'help', 'skills', 'projects', 'resume')..."
                className="flex-1 bg-transparent text-xs text-white outline-none font-mono"
              />
              <button type="submit" className="text-slate-400 hover:text-emerald-400 p-1">
                <CornerDownLeft size={14} />
              </button>
            </form>
          </div>
        </section>

        {/* ── METRIC STATS ── */}
        {profile.hero_metrics && profile.hero_metrics.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {profile.hero_metrics.map((m, idx) => (
              <div key={idx} className="p-6 bg-[#161b22] border border-slate-800 rounded-2xl text-center space-y-1">
                <div className="text-3xl font-black text-emerald-400">{m.value}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── BIO / NARRATIVE (README.md) ── */}
        {profile.bio && (
          <section id="about" className="space-y-3">
            <div className="bg-[#161b22] border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                  <FileCode size={14} className="text-cyan-400" /> README.md // Executive Summary
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {profile.bio}
              </p>
            </div>
          </section>
        )}

        {/* ── SKILLS MATRIX (skills.json) ── */}
        <section id="skills" className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <FileCode size={16} className="text-yellow-400" /> skills.json // Technical Stack
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {Object.entries(profile.skills || {}).map(([cat, list], idx) => {
              const skillArray = Array.isArray(list) ? list : [];
              return (
                <div key={idx} className="bg-[#161b22] border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-emerald-500/40 transition-colors">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                      "{cat}"
                    </h3>
                    <span className="text-[10px] text-slate-500 font-bold">[{skillArray.length}]</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {skillArray.map((s, sIdx) => (
                      <span key={sIdx} className="px-2.5 py-1 bg-[#0b0f17] border border-slate-800 text-slate-300 text-xs rounded-md">
                        "{s}"
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── PROJECTS (projects.ts) ── */}
        <section id="projects" className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <FileCode size={16} className="text-cyan-400" /> projects.ts // Case Studies ({profile.projects?.length || 0})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(profile.projects || []).map((proj, idx) => (
              <div key={idx} className="bg-[#161b22] border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-colors">
                {proj.image_url && (
                  <div className="relative h-48 overflow-hidden bg-slate-900 border-b border-slate-800">
                    <img 
                      src={proj.image_url} 
                      alt={proj.title} 
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="text-emerald-400 font-bold uppercase">{proj.category || 'PROJECT'}</span>
                      <span>{proj.year || '2026'}</span>
                    </div>
                    <h3 className="text-xl font-black text-white">{proj.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{proj.description}</p>
                  </div>

                  {/* Highlights */}
                  {proj.highlights && proj.highlights.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {proj.highlights.map((hl, hIdx) => (
                        <div key={hIdx} className="p-2 bg-[#0b0f17] rounded-lg border border-slate-800">
                          <div className="text-xs font-black text-emerald-400">{hl.value}</div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase">{hl.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tech stack */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(proj.technologies || []).map((t, tIdx) => (
                      <span key={tIdx} className="px-2 py-0.5 bg-[#0b0f17] text-slate-400 text-[10px] rounded border border-slate-800">
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                    {proj.live_url && (
                      <a href={proj.live_url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-lg flex items-center gap-1.5">
                        <ExternalLink size={12} /> Live Preview
                      </a>
                    )}
                    {proj.github_url && (
                      <a href={proj.github_url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg flex items-center gap-1.5 border border-slate-700">
                        <Github size={12} /> Source
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── EXPERIENCE (experience.md) ── */}
        {profile.experience && profile.experience.length > 0 && (
          <section id="experience" className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <GitCommit size={16} className="text-purple-400" /> experience.md // Git Commit Work Log
              </h2>
            </div>

            <div className="space-y-4">
              {profile.experience.map((exp, idx) => (
                <div key={idx} className="p-6 bg-[#161b22] border border-slate-800 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-800/80 pb-2">
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <Briefcase size={15} className="text-emerald-400" />
                      {exp.role}
                    </h3>
                    <span className="text-xs text-purple-300 bg-purple-950/40 px-2.5 py-0.5 rounded border border-purple-500/30">
                      {exp.start_date || 'Past'} – {exp.end_date || 'Present'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-400">{exp.company} {exp.location ? `• ${exp.location}` : ''}</div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line">{exp.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── EDUCATION (education.json) ── */}
        {profile.education && profile.education.length > 0 && (
          <section id="education" className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <GraduationCap size={16} className="text-cyan-400" /> education.json // Qualifications
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profile.education.map((edu, idx) => (
                <div key={idx} className="p-6 bg-[#161b22] border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex justify-between items-start text-xs text-slate-400">
                    <span>Degree Record</span>
                    <span>{edu.graduation_year}</span>
                  </div>
                  <h3 className="text-base font-black text-white">{edu.degree}</h3>
                  <div className="text-xs text-slate-400">{edu.institution}</div>
                  {edu.grade && (
                    <div className="text-xs text-emerald-400 pt-1">Grade: {edu.grade}</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── CONTACT SCRIPT (contact.sh) ── */}
        <section id="contact" className="space-y-6 max-w-xl mx-auto text-center">
          <div className="space-y-1">
            <span className="text-xs text-emerald-400 font-bold uppercase">contact.sh // Inbound Channel</span>
            <h2 className="text-2xl font-black text-white">Send Message Payload</h2>
          </div>

          <form onSubmit={handleContactSubmit} className="p-6 sm:p-8 bg-[#161b22] border border-slate-800 rounded-2xl text-left space-y-4 shadow-xl">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-400">NAME=</label>
              <input
                type="text"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#0b0f17] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-400"
                placeholder="Ada Lovelace"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-400">EMAIL=</label>
              <input
                type="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#0b0f17] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-400"
                placeholder="ada@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-400">MESSAGE=</label>
              <textarea
                rows={4}
                required
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                className="w-full px-4 py-2.5 bg-[#0b0f17] border border-slate-800 rounded-xl text-white text-xs outline-none focus:border-emerald-400 leading-relaxed font-sans"
                placeholder="Hi, I'd like to talk about..."
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-colors"
            >
              <Send size={14} /> {sending ? 'Transmitting...' : 'Execute Send'}
            </button>
          </form>
        </section>

        {/* ── FOOTER ── */}
        <footer className="pt-8 border-t border-slate-800 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} {profile.full_name} • IDE Developer Architecture
        </footer>

      </main>
    </div>
  );
}
