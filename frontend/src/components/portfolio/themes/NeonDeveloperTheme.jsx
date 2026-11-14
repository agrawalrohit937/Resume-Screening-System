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
  Layers,
  Clock,
  Maximize2,
  Mail,
  Zap,
  Globe
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
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [roleIdx, setRoleIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeProjectModal, setActiveProjectModal] = useState(null);
  const [currentTime, setCurrentTime] = useState('');

  // Interactive In-Browser CLI State
  const [cliInput, setCliInput] = useState('');
  const [cliHistory, setCliHistory] = useState([
    { type: 'system', text: '⚡ DevOS Terminal v3.2 [Kernel: Linux 6.8 x86_64]' },
    { type: 'system', text: `👤 Authorized user: guest@${(profile.full_name || 'developer').toLowerCase().replace(/\s+/g, '-')}` },
    { type: 'output', text: 'Type "help" to inspect executable commands or "resume" to fetch CV.' }
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

  useEffect(() => {
    cliBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [cliHistory]);

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

  const copyCloneCmd = () => {
    navigator.clipboard.writeText(`git clone https://github.com/${username || 'developer'}/portfolio.git`);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleCopyEmail = () => {
    if (profile.email) {
      navigator.clipboard.writeText(profile.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2200);
    }
  };

  // Interactive CLI command execution
  const handleCliSubmit = (e, manualCmd) => {
    if (e && e.preventDefault) e.preventDefault();
    const rawCmd = manualCmd || cliInput;
    const cmd = rawCmd.trim().toLowerCase();
    if (!cmd) return;

    const newHistory = [...cliHistory, { type: 'user', text: `$ ${rawCmd}` }];

    if (cmd === 'help') {
      newHistory.push({
        type: 'output',
        text: 'Available binaries:\n  whoami      Display engineer profile metadata\n  skills      Inspect tech stack categorizations\n  projects    List active production architectures\n  experience  Display engineering career trajectory\n  resume      Download Curriculum Vitae\n  contact     Scroll to contact dispatch form\n  clear       Wipe terminal buffer'
      });
    } else if (cmd === 'whoami') {
      newHistory.push({
        type: 'output',
        text: `${profile.full_name} — ${profile.headline || 'Software & AI Engineer'} [Location: ${profile.location || 'Remote'}]`
      });
    } else if (cmd === 'skills') {
      const allS = Object.entries(profile.skills || {}).map(([cat, list]) => `${cat}: [${list.join(', ')}]`).join('\n');
      newHistory.push({ type: 'output', text: allS || 'No skills indexed.' });
    } else if (cmd === 'projects') {
      const projNames = (profile.projects || []).map((p, i) => `[#${i + 1}] ${p.title} -> ${(p.technologies || []).join(', ')}`).join('\n');
      newHistory.push({ type: 'output', text: projNames || 'No projects listed.' });
    } else if (cmd === 'experience') {
      const expList = (profile.experience || []).map(e => `${e.role} @ ${e.company} (${e.start_date || 'Past'} - ${e.end_date || 'Present'})`).join('\n');
      newHistory.push({ type: 'output', text: expList || 'No experience listed.' });
    } else if (cmd === 'resume') {
      handleResumeDownload();
      newHistory.push({ type: 'output', text: '📥 Dispatched download_resume() routine...' });
    } else if (cmd === 'contact') {
      const contactElem = document.getElementById('contact');
      if (contactElem) contactElem.scrollIntoView({ behavior: 'smooth' });
      newHistory.push({ type: 'output', text: '📬 Scrolled to contact terminal...' });
    } else if (cmd === 'clear') {
      setCliHistory([]);
      setCliInput('');
      return;
    } else {
      newHistory.push({
        type: 'error',
        text: `zsh: command not found: ${cmd}. Type "help" for a list of commands.`
      });
    }

    setCliHistory(newHistory);
    setCliInput('');
  };

  const allProjects = profile.projects || [];

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#E6EDF3] font-mono selection:bg-emerald-500 selection:text-black relative antialiased">
      
      {/* ── TOP VS CODE STYLE HEADER ── */}
      <header className="sticky top-0 left-0 w-full z-40 bg-[#161B22]/95 backdrop-blur-xl border-b border-[#30363D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <div className="h-4 w-px bg-[#30363D] mx-1" />
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <FolderGit2 size={14} className="text-emerald-400" />
              {(profile.full_name || 'developer').toLowerCase().replace(/\s+/g, '-')}-workspace
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs text-slate-400">
            <a href="#home" className="hover:text-emerald-400 transition-colors">./main.py</a>
            <a href="#skills" className="hover:text-emerald-400 transition-colors">./stack.json</a>
            <a href="#projects" className="hover:text-emerald-400 transition-colors">./deployments/</a>
            <a href="#experience" className="hover:text-emerald-400 transition-colors">./career.log</a>
            <a href="#contact" className="hover:text-emerald-400 transition-colors">./contact.sh</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={handleResumeDownload}
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Download size={13} /> fetch_cv
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 md:hidden text-slate-300">
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#161B22] border-b border-[#30363D] p-5 space-y-3">
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
      <main className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 pt-6 sm:pt-10 pb-32 space-y-16 sm:space-y-24 md:space-y-32">
        
        {/* ── SECTION 1: IDE EDITOR & CLI TERMINAL HERO ── */}
        <section id="home" className="space-y-6 sm:space-y-8">
          
          {/* Main IDE Window */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl overflow-hidden shadow-2xl">
            
            {/* Tab Bar */}
            <div className="px-3 sm:px-4 py-2.5 bg-[#0D1117] border-b border-[#30363D] flex items-center justify-between text-xs overflow-x-auto">
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-3 py-1 bg-[#161B22] text-emerald-400 rounded-t-lg border-t-2 border-emerald-400 font-bold flex items-center gap-1.5 text-xs">
                  <FileCode size={13} /> main.py
                </span>
                <span className="px-2.5 py-1 text-slate-500 hidden sm:flex items-center gap-1.5 text-xs">
                  <GitBranch size={13} /> production*
                </span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  UTF-8 · Python 3.12
                </span>
                <button 
                  onClick={copyCloneCmd}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#21262D] hover:bg-[#30363D] text-slate-300 rounded text-[11px] font-bold cursor-pointer transition-colors"
                >
                  {copiedCmd ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span>{copiedCmd ? 'Copied' : 'git clone'}</span>
                </button>
              </div>
            </div>

            {/* Code Body */}
            <div className="p-4 sm:p-8 md:p-10 space-y-5 sm:space-y-6 text-xs sm:text-sm leading-relaxed overflow-x-auto">
              <div className="text-slate-500">
                # ========================================================<br />
                # ARCHITECTURE DEFINITION // {profile.full_name.toUpperCase()}<br />
                # ========================================================
              </div>

              <div className="space-y-2">
                <span className="text-purple-400 font-bold">from</span> <span className="text-cyan-400">dataclasses</span> <span className="text-purple-400 font-bold">import</span> dataclass<br />
                <span className="text-purple-400 font-bold">from</span> <span className="text-cyan-400">typing</span> <span className="text-purple-400 font-bold">import</span> List, Optional
              </div>

              <div className="space-y-2">
                <div className="text-yellow-400 font-bold">@dataclass</div>
                <div className="text-purple-400 font-bold">
                  class <span className="text-yellow-300">{profile.full_name.replace(/\s+/g, '')}</span>(StaffArchitect):
                </div>

                <div className="pl-4 sm:pl-8 space-y-1.5 border-l-2 border-[#30363D] text-slate-300">
                  <div>
                    <span className="text-cyan-400">full_name</span>: str = <span className="text-emerald-400">"{profile.full_name}"</span>
                  </div>
                  <div>
                    <span className="text-cyan-400">primary_role</span>: str = <span className="text-emerald-400">"{typedText}"</span>
                    <span className="w-2 h-4 bg-emerald-400 ml-1 inline-block animate-pulse align-middle" />
                  </div>
                  <div>
                    <span className="text-cyan-400">location</span>: str = <span className="text-emerald-400">"{profile.location || 'Global Remote'}"</span>
                  </div>
                  <div>
                    <span className="text-cyan-400">verified_status</span>: str = <span className="text-yellow-400">"{profile.hero_badge || 'AVAILABLE_FOR_HIRE'}"</span>
                  </div>
                  <div>
                    <span className="text-cyan-400">summary</span>: str = <span className="text-slate-400">"""{profile.headline || 'Building distributed systems'}"""</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-[#30363D]">
                <a
                  href="#projects"
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Play size={13} /> python run_projects.py
                </a>
                <a
                  href="#contact"
                  className="px-6 py-3 bg-[#21262D] hover:bg-[#30363D] text-slate-200 text-xs font-bold rounded-xl border border-[#30363D]"
                >
                  init_contact()
                </a>
                <button
                  onClick={handleCopyEmail}
                  className="px-4 py-3 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer ml-auto"
                >
                  {copiedEmail ? '✓ Copied' : `echo "${profile.email}"`}
                </button>
              </div>

            </div>
          </div>

          {/* Interactive In-Browser CLI Terminal */}
          <div className="bg-[#0D1117] border border-[#30363D] rounded-2xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#30363D] pb-3 text-xs text-slate-400">
              <span className="flex items-center gap-2 font-bold text-emerald-400">
                <Terminal size={14} /> interactive_zsh_shell
              </span>
              <span className="text-[10px] text-slate-500 hidden sm:inline">
                Type: help | whoami | skills | projects | resume | contact | clear
              </span>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-2 text-xs font-mono text-slate-300">
              {cliHistory.map((item, idx) => (
                <div 
                  key={idx} 
                  className={
                    item.type === 'error' ? 'text-rose-400' :
                    item.type === 'user' ? 'text-yellow-400 font-bold' :
                    item.type === 'system' ? 'text-slate-500' :
                    'text-emerald-300 whitespace-pre-wrap'
                  }
                >
                  {item.text}
                </div>
              ))}
              <div ref={cliBottomRef} />
            </div>

            {/* Quick Command Suggestions for Mobile & Desktop */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 pt-1 border-t border-[#30363D]/60 text-[11px]">
              <span className="text-slate-500 text-[10px] shrink-0 font-bold uppercase">Quick:</span>
              {['whoami', 'skills', 'projects', 'experience', 'resume', 'contact'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCliInput(c);
                    // auto trigger command
                    const fakeE = { preventDefault: () => {} };
                    handleCliSubmit(fakeE, c);
                  }}
                  className="px-2 py-0.5 rounded bg-[#21262D] hover:bg-emerald-500/20 hover:text-emerald-300 text-slate-300 shrink-0 font-mono text-[11px] transition-colors border border-[#30363D]"
                >
                  ${c}
                </button>
              ))}
            </div>

            <form onSubmit={handleCliSubmit} className="flex items-center gap-2 pt-2 border-t border-[#30363D]">
              <span className="text-emerald-400 font-bold">❯</span>
              <input
                type="text"
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                placeholder="type command (e.g. skills, projects)..."
                className="flex-1 bg-transparent text-emerald-300 text-xs outline-none font-mono"
              />
              <button type="submit" className="text-slate-500 hover:text-emerald-400 text-xs p-1">
                <CornerDownLeft size={14} />
              </button>
            </form>
          </div>

          {/* Metric Bar */}
          {profile.hero_metrics && profile.hero_metrics.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-4 sm:pt-6">
              {profile.hero_metrics.map((m, idx) => (
                <div key={idx} className="p-4 sm:p-5 rounded-2xl bg-[#161B22] border border-[#30363D] space-y-1">
                  <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                    {m.value}
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          )}

        </section>

        {/* ── SECTION 2: TECH STACK MATRIX ── */}
        <section id="skills" className="space-y-6">
          <div className="flex items-center justify-between border-b border-[#30363D] pb-4">
            <div>
              <span className="text-xs text-emerald-400 uppercase tracking-wider font-bold">// dependencies</span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">Technology Arsenal</h2>
            </div>
            <span className="text-xs text-slate-400">package.json</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(profile.skills || {}).map(([cat, list], idx) => {
              const skillList = Array.isArray(list) ? list : [];
              return (
                <div key={idx} className="p-6 rounded-2xl bg-[#161B22] border border-[#30363D] space-y-4 hover:border-emerald-500/50 transition-colors">
                  <div className="flex items-center justify-between border-b border-[#30363D] pb-3">
                    <span className="text-xs font-bold uppercase text-yellow-400">{cat}</span>
                    <span className="text-[11px] text-slate-500">[{skillList.length}]</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {skillList.map((skill, sIdx) => (
                      <span
                        key={sIdx}
                        className="px-3 py-1 rounded-lg bg-[#0D1117] border border-[#30363D] text-xs text-emerald-300 hover:border-emerald-400 transition-colors"
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

        {/* ── SECTION 3: PRODUCTION DEPLOYMENTS ── */}
        <section id="projects" className="space-y-8">
          <div className="flex items-center justify-between border-b border-[#30363D] pb-4">
            <div>
              <span className="text-xs text-emerald-400 uppercase tracking-wider font-bold">// deployments</span>
              <h2 className="text-2xl sm:text-4xl font-black text-white">Production Architectures</h2>
            </div>
            <span className="text-xs text-slate-400">{allProjects.length} systems live</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {allProjects.map((proj, idx) => (
              <div 
                key={idx}
                className="rounded-2xl bg-[#161B22] border border-[#30363D] overflow-hidden hover:border-emerald-400/50 transition-all space-y-0 group"
              >
                {/* File Header */}
                <div className="px-5 py-3 bg-[#0D1117] border-b border-[#30363D] flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-2 text-emerald-400">
                    <GitCommit size={14} /> build-{proj.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.tar.gz
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 px-2 py-0.5 rounded bg-[#21262D]">
                    {proj.category || 'PROD'}
                  </span>
                </div>

                {proj.image_url && (
                  <div className="h-60 overflow-hidden bg-[#0D1117] relative group/img">
                    <img 
                      src={proj.image_url} 
                      alt={proj.title} 
                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
                    />
                    <button
                      onClick={() => setActiveProjectModal(proj)}
                      className="absolute bottom-3 right-3 px-3 py-1.5 bg-[#0D1117]/90 text-white rounded-lg text-xs flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer border border-[#30363D]"
                    >
                      <Maximize2 size={12} /> Inspect
                    </button>
                  </div>
                )}

                <div className="p-6 sm:p-8 space-y-4">
                  <h3 className="text-xl font-black text-white">{proj.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">{proj.description}</p>

                  {proj.highlights && proj.highlights.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {proj.highlights.map((h, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-[#0D1117] border border-[#30363D]">
                          <div className="text-sm font-bold text-emerald-400">{h.value}</div>
                          <div className="text-[10px] text-slate-500 uppercase">{h.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {(proj.technologies || []).map((t, i) => (
                      <span key={i} className="px-2.5 py-1 bg-[#21262D] text-slate-300 text-xs rounded">
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-[#30363D]">
                    {proj.live_url && (
                      <a
                        href={proj.live_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black uppercase text-center flex items-center justify-center gap-1.5"
                      >
                        <ExternalLink size={13} /> Live System
                      </a>
                    )}
                    {proj.github_url && (
                      <a
                        href={proj.github_url}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2.5 px-4 bg-[#21262D] hover:bg-[#30363D] text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5"
                      >
                        <Github size={13} /> Code
                      </a>
                    )}
                    <button
                      onClick={() => setActiveProjectModal(proj)}
                      className="p-2 text-slate-400 hover:text-white cursor-pointer ml-auto"
                    >
                      <Maximize2 size={16} />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 4: CAREER HISTORY ── */}
        {profile.experience && profile.experience.length > 0 && (
          <section id="experience" className="space-y-6">
            <div className="flex items-center justify-between border-b border-[#30363D] pb-4">
              <div>
                <span className="text-xs text-emerald-400 uppercase tracking-wider font-bold">// git_log</span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">Career Trajectory</h2>
              </div>
            </div>

            <div className="space-y-4">
              {profile.experience.map((exp, idx) => (
                <div key={idx} className="p-6 rounded-2xl bg-[#161B22] border border-[#30363D] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#30363D] pb-3">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Briefcase size={16} className="text-emerald-400" />
                      {exp.role} @ <span className="text-yellow-400">{exp.company}</span>
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">
                      {exp.start_date || 'Past'} – {exp.end_date || 'Present'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-sans leading-relaxed whitespace-pre-line">
                    {exp.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── SECTION 5: CONTACT DISPATCH FORM ── */}
        <section id="contact" className="max-w-xl mx-auto space-y-6 text-center pt-8">
          <div className="space-y-2">
            <span className="text-xs text-emerald-400 uppercase tracking-wider">// socket_connect</span>
            <h2 className="text-3xl font-black text-white">Initiate Direct Channel</h2>
            <p className="text-xs text-slate-400 font-sans">Submit job offers, architecture consulting requests, or tech inquiries.</p>
          </div>

          <form onSubmit={handleContactSubmit} className="p-8 bg-[#161B22] border border-[#30363D] rounded-2xl text-left space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-bold">sender_name:</label>
              <input
                type="text"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                className="w-full px-4 py-3 bg-[#0D1117] border border-[#30363D] rounded-xl text-xs text-emerald-300 outline-none focus:border-emerald-400 font-mono"
                placeholder="Linus Torvalds"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-bold">sender_email:</label>
              <input
                type="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full px-4 py-3 bg-[#0D1117] border border-[#30363D] rounded-xl text-xs text-emerald-300 outline-none focus:border-emerald-400 font-mono"
                placeholder="torvalds@kernel.org"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-bold">payload_message:</label>
              <textarea
                rows={4}
                required
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                className="w-full px-4 py-3 bg-[#0D1117] border border-[#30363D] rounded-xl text-xs text-emerald-300 outline-none focus:border-emerald-400 font-mono leading-relaxed"
                placeholder="Details of the engineering opportunity..."
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-4 mt-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <Send size={14} /> {sending ? 'TRANSMITTING PACKETS...' : 'SEND MESSAGE'}
            </button>
          </form>
        </section>

        {/* Footer */}
        <footer className="pt-10 border-t border-[#30363D] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>© {new Date().getFullYear()} {profile.full_name} • DevEngine IDE Architecture</div>
          <div className="flex items-center gap-4">
            {profile.social_links?.linkedin && (
              <a href={profile.social_links.linkedin} target="_blank" rel="noreferrer" className="hover:text-emerald-400">LinkedIn</a>
            )}
            {profile.social_links?.github && (
              <a href={profile.social_links.github} target="_blank" rel="noreferrer" className="hover:text-emerald-400">GitHub</a>
            )}
            <a href="#home" className="hover:text-emerald-400">return_top()</a>
          </div>
        </footer>

      </main>

      {/* ── CASE STUDY MODAL ── */}
      <AnimatePresence>
        {activeProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#161B22] border border-[#30363D] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-5 relative text-white"
            >
              <button
                onClick={() => setActiveProjectModal(null)}
                className="absolute top-5 right-5 w-8 h-8 rounded-lg bg-[#21262D] text-slate-300 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="space-y-1">
                <span className="text-xs text-emerald-400 uppercase font-bold">// deep_inspection</span>
                <h3 className="text-2xl font-black text-white">{activeProjectModal.title}</h3>
              </div>

              {activeProjectModal.image_url && (
                <div className="rounded-xl overflow-hidden border border-[#30363D] h-56 bg-[#0D1117]">
                  <img src={activeProjectModal.image_url} alt={activeProjectModal.title} className="w-full h-full object-cover" />
                </div>
              )}

              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {activeProjectModal.description}
              </p>

              {activeProjectModal.highlights && activeProjectModal.highlights.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {activeProjectModal.highlights.map((h, i) => (
                    <div key={i} className="p-3 bg-[#0D1117] rounded-xl border border-[#30363D]">
                      <div className="text-sm font-bold text-emerald-400">{h.value}</div>
                      <div className="text-[10px] text-slate-500 uppercase">{h.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 pt-2">
                {(activeProjectModal.technologies || []).map((t, i) => (
                  <span key={i} className="px-2.5 py-1 bg-[#21262D] text-emerald-300 text-xs rounded">
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-[#30363D]">
                {activeProjectModal.live_url && (
                  <a
                    href={activeProjectModal.live_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2.5 bg-emerald-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={14} /> Open Deployment
                  </a>
                )}
                {activeProjectModal.github_url && (
                  <a
                    href={activeProjectModal.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2.5 bg-[#21262D] text-slate-300 text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-2 hover:bg-[#30363D]"
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