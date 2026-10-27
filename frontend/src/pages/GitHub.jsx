import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { 
  FolderGit2, Users, Code2, Layers, Star, GitFork, 
  CheckCircle2, Sparkles, MapPin, Calendar, Search, 
  Activity, ShieldCheck, ArrowUpRight, Github, ExternalLink,
  Flame, Award, Check
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { analyzeGitHub } from '../services/api'

const LANG_COLORS = { 
  Python: '#3572A5', 
  JavaScript: '#F7DF1E', 
  TypeScript: '#3178C6', 
  'Jupyter Notebook': '#DA5B0B',
  Go: '#00ADD8', 
  Rust: '#DEA584', 
  Java: '#B07219', 
  Ruby: '#701516', 
  'C++': '#F34B7D', 
  Swift: '#FA7343', 
  Kotlin: '#A97BFF', 
  Shell: '#89E051', 
  CSS: '#563D7C', 
  HTML: '#E34C26' 
}

export default function GitHub() {
  const { user } = useAuth()
  const defaultUsername = user?.github_username || user?.username || 'agrawalrohit937'
  const [username, setUsername] = useState(defaultUsername)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const analyze = async (targetUser = username) => {
    const cleanUser = (targetUser || '').trim()
    if (!cleanUser) { 
      toast.error('Please enter a GitHub username')
      return 
    }
    setLoading(true)
    setResult(null)
    try {
      const { data } = await analyzeGitHub({ username: cleanUser })
      setResult(data.data || data)
      toast.success(`Analyzed @${cleanUser}! 🚀`)
    } catch (err) { 
      toast.error(err.response?.data?.detail || 'Analysis failed — check username or API limits') 
    } finally { 
      setLoading(false) 
    }
  }

  useEffect(() => {
    if (defaultUsername && !result) {
      analyze(defaultUsername)
    }
  }, [])

  const langs = result?.languages || {}
  const totalLangCount = Object.values(langs).reduce((a, b) => a + b, 0) || 1
  const langList = Object.entries(langs).map(([name, count]) => ({
    name,
    count,
    pct: Math.max(1, Math.round((count / totalLangCount) * 100)),
    color: LANG_COLORS[name] || '#2E9BDA'
  })).sort((a, b) => b.count - a.count)

  const hirability = result?.hirability_signals || {}

  const signals = [
    { label: 'Documentation in Repos (README.md)', ok: !!hirability.has_readme },
    { label: 'Commit Velocity & Recent Activity', ok: !!hirability.active_recently },
    { label: 'Multi-Stack Architecture Depth', ok: !!hirability.multiple_languages },
    { label: 'Public Repo Presence & Impact', ok: !!hirability.popular_projects || ((result?.profile?.public_repos || 0) > 0) },
    { label: 'Collaboration & Contribution Signals', ok: !!hirability.collaboration_indicator },
  ]

  const verifiedCount = signals.filter(s => s.ok).length

  return (
    <div className="w-full flex flex-col justify-between gap-2.5 font-sans text-slate-900 antialiased pb-2">
      
      {/* ── 1. Sleek Modern Header Bar ── */}
      <div className="w-full bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl px-4 py-2.5 shadow-xs flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#2E9BDA] to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Github size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                GitHub Developer Intelligence
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 tracking-wider">
                ATS Verified
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              Code audit, tech stack verification & contribution velocity for recruiters
            </p>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">@</span>
            <input 
              className="w-44 sm:w-56 pl-7 pr-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:ring-2 focus:ring-[#2E9BDA]/30 focus:border-[#2E9BDA] focus:outline-none transition"
              placeholder="github-username" 
              value={username}
              onChange={e => setUsername(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && analyze()}
            />
          </div>
          <button 
            type="button"
            onClick={() => analyze()} 
            disabled={loading} 
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#2E9BDA] to-indigo-600 hover:from-[#2587bf] hover:to-indigo-700 text-white font-bold text-xs shadow-xs hover:shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shrink-0"
          >
            {loading ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search size={13} />
            )}
            <span>{loading ? 'Scanning' : 'Analyze'}</span>
          </button>
        </div>
      </div>

      {/* ── Loading Skeleton ── */}
      {loading && (
        <div className="w-full bg-white border border-slate-200/80 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-slate-500 shadow-xs">
          <div className="w-10 h-10 rounded-full border-3 border-sky-100 border-t-[#2E9BDA] animate-spin flex items-center justify-center">
            <Github size={18} className="text-[#2E9BDA]" />
          </div>
          <p className="text-xs font-bold text-slate-700">Analyzing @{username} repositories & code footprint...</p>
        </div>
      )}

      {/* ── 2. Main Executive Bento Grid (Fits 100% on Single Page) ── */}
      {result && !loading && (
        <div className="space-y-2.5">
          
          {/* Row 1: Profile Cockpit + Quality Signals */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
            
            {/* Left Column: Big Stylish Avatar + Profile + Micro Stats (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-3 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-sky-100/40 via-transparent to-transparent rounded-full -z-0 pointer-events-none" />

              <div className="flex items-center gap-4 relative z-10">
                {/* Big Stylish Profile Photo with Glowing Ring */}
                <div className="relative shrink-0">
                  <div className="p-1 rounded-2xl bg-gradient-to-tr from-[#2E9BDA] via-indigo-500 to-purple-500 shadow-sm">
                    {result.profile?.avatar_url ? (
                      <img 
                        src={result.profile.avatar_url} 
                        alt="avatar" 
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover bg-white"
                      />
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-sky-50 text-[#2E9BDA] flex items-center justify-center font-black text-2xl">
                        {(result.profile?.name || result.username || 'G').charAt(0)}
                      </div>
                    )}
                  </div>
                  {/* Status Indicator Dot */}
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-xs" title="Verified Active" />
                </div>

                {/* Profile Meta & Details */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                      {result.profile?.name || result.username}
                    </h2>
                    <a 
                      href={result.profile?.github_url || `https://github.com/${result.username}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 text-[#2E9BDA] hover:bg-sky-100 text-xs font-bold transition border border-sky-200/60"
                    >
                      @{result.username} <ArrowUpRight size={11} />
                    </a>
                  </div>

                  {result.profile?.bio && (
                    <p className="text-xs text-slate-600 font-medium line-clamp-1 leading-snug">
                      {result.profile.bio}
                    </p>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] font-semibold text-slate-600">
                    {result.profile?.location && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100/80 border border-slate-200/70">
                        <MapPin size={10} className="text-slate-400" /> {result.profile.location}
                      </span>
                    )}
                    {result.profile?.account_age_years > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-700 border border-indigo-200/60">
                        <Calendar size={10} className="text-indigo-400" /> {result.profile.account_age_years}y Experience
                      </span>
                    )}
                    {result.activity_level && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold capitalize">
                        <Activity size={10} className="text-emerald-600" /> {result.activity_level.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 4 Modern Micro-Stats Cards */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 relative z-10">
                {[
                  { label: 'Repos', val: result.profile?.public_repos || 0, icon: FolderGit2, color: 'text-[#2E9BDA]', bg: 'bg-sky-50' },
                  { label: 'Followers', val: result.profile?.followers || 0, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Languages', val: langList.length, icon: Code2, color: 'text-violet-600', bg: 'bg-violet-50' },
                  { label: 'Tech Stack', val: result.tech_stack?.length || 0, icon: Layers, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map((s, i) => {
                  const Icon = s.icon
                  return (
                    <div key={i} className="bg-slate-50/80 border border-slate-200/70 hover:border-slate-300 rounded-xl p-2 flex items-center gap-2 transition shadow-2xs">
                      <div className={`w-8 h-8 rounded-lg ${s.bg} ${s.color} flex items-center justify-center shrink-0`}>
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{s.label}</p>
                        <p className="text-sm font-black text-slate-900 leading-tight">{s.val.toLocaleString()}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Stack Chips */}
              {result.tech_stack?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider font-mono mr-1">Verified:</span>
                  {result.tech_stack.slice(0, 7).map((tech, i) => (
                    <span key={i} className="text-[10.5px] font-bold bg-slate-100/90 text-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/80">
                      {tech}
                    </span>
                  ))}
                  {result.tech_stack.length > 7 && (
                    <span className="text-[10px] font-bold text-slate-400">+{result.tech_stack.length - 7}</span>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Code Quality Signals & Hirability Checklist (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[#2E9BDA]" /> Code Quality Signals
                </span>
                <span className="text-[10.5px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70">
                  {verifiedCount}/{signals.length} Signals Verified
                </span>
              </div>

              {/* Checklist Grid */}
              <div className="space-y-1.5">
                {signals.map((s, i) => (
                  <div 
                    key={i} 
                    className={`flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                      s.ok 
                        ? 'bg-emerald-50/50 border-emerald-200/70 text-slate-800' 
                        : 'bg-slate-50 border-slate-200/60 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <CheckCircle2 size={13} className={s.ok ? 'text-emerald-600 shrink-0' : 'text-slate-300 shrink-0'} />
                      <span className="truncate text-[11.5px]">{s.label}</span>
                    </div>
                    <span className={`text-[9.5px] font-extrabold font-mono px-1.5 py-0.2 rounded shrink-0 ${
                      s.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {s.ok ? 'PASS' : 'UNSEEN'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Open Source Impact Score */}
              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Open Source Impact</p>
                  <p className="text-xs font-black text-slate-800">
                    {Math.round((hirability.open_source_score || 0.6) * 100)}% Confidence Score
                  </p>
                </div>
                <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-[#2E9BDA] to-emerald-500"
                    style={{ width: `${Math.round((hirability.open_source_score || 0.6) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Row 2: GitHub Language Breakdown + Featured Repositories */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
            
            {/* Language Breakdown Card (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Code2 size={14} className="text-violet-600" /> Language Distribution
                </span>
                <span className="text-[11px] font-bold text-slate-400">{langList.length} Technologies</span>
              </div>

              {/* Official GitHub-Style Color Segmented Bar */}
              <div className="h-2.5 w-full rounded-full flex overflow-hidden gap-0.5 bg-slate-100 p-0.5">
                {langList.map(l => (
                  <div 
                    key={l.name} 
                    style={{ width: `${l.pct}%`, background: l.color }} 
                    className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full" 
                    title={`${l.name}: ${l.count} repos (${l.pct}%)`}
                  />
                ))}
              </div>

              {/* Clean Legend Chips */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs pt-1">
                {langList.slice(0, 6).map(l => (
                  <div key={l.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-800 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ background: l.color }} />
                      <span className="truncate text-[11.5px]">{l.name}</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 ml-1">{l.count} ({l.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Featured Repositories Grid (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <FolderGit2 size={14} className="text-[#2E9BDA]" /> Featured Code Repositories
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {result.top_repositories?.length || 0} repositories analyzed
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(result.top_repositories || []).slice(0, 4).map((repo, i) => (
                  <a 
                    key={repo.name || i}
                    href={repo.url || `https://github.com/${result.username}/${repo.name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl border border-slate-200/70 bg-slate-50/50 hover:bg-white hover:border-[#2E9BDA]/60 hover:shadow-xs transition flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-[#2E9BDA] transition truncate">
                          {repo.name}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md shrink-0">
                          <Star size={9} className="fill-amber-400 text-amber-500" /> {repo.stars || 0}
                        </span>
                      </div>
                      {repo.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 leading-normal font-normal">
                          {repo.description}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-100 text-[10px]">
                      {repo.language ? (
                        <span className="flex items-center gap-1 text-slate-600 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: LANG_COLORS[repo.language] || '#2E9BDA' }} />
                          {repo.language}
                        </span>
                      ) : (
                        <span className="text-slate-400">Codebase</span>
                      )}
                      <span className="text-[#2E9BDA] font-bold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        View Code <ArrowUpRight size={10} />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>

          </div>

          {/* Row 3: Single Compact AI Insight Line */}
          {result.insights?.length > 0 && (
            <div className="w-full bg-gradient-to-r from-sky-50/80 via-indigo-50/40 to-white border border-sky-200/80 rounded-xl px-4 py-2 flex items-center gap-2.5 text-xs text-sky-950 shadow-2xs">
              <Sparkles size={14} className="text-[#2E9BDA] shrink-0" />
              <p className="truncate text-xs font-medium">
                <strong className="font-extrabold text-[#2E9BDA] mr-1">AI Recommendation:</strong> 
                {result.insights[0]}
              </p>
            </div>
          )}

        </div>
      )}

      {/* ── Initial Empty State ── */}
      {!result && !loading && (
        <div className="w-full bg-white border border-slate-200/80 rounded-2xl p-12 flex flex-col items-center text-center gap-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#2E9BDA] flex items-center justify-center">
            <Github size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Ready to Analyze GitHub Profile</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Enter any public GitHub handle above to evaluate repo depth, tech stack, and contribution velocity.
          </p>
        </div>
      )}

    </div>
  )
}
