import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ScoreRing from './ScoreRing'
import { AnimatedBar } from './AnimatedNumber'

const TABS = ['Overview', 'Keywords', 'Skills', 'Explain', 'Roadmap']

function ScoreRow({ label, value, color, delay = 0 }) {
  const pct = Math.round((value || 0) * 100)
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-ink-600 font-body">{label}</span>
        <span className="font-mono text-sm font-bold" style={{ color }}>{pct}%</span>
      </div>
      <AnimatedBar value={pct} color={color} delay={delay} height={8}/>
    </div>
  )
}

function Chip({ word, matched }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border m-0.5 transition-all
      ${matched
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-xs'
        : 'bg-rose-50 border-rose-200 text-rose-600 line-through opacity-70'
      }`}>
      {matched ? '✓' : '✕'} {word}
    </span>
  )
}

function ExplainCard({ section, index }) {
  const pct = Math.round((section.score || 0) * 100)
  const color = pct >= 80 ? '#10B981' : pct >= 60 ? '#6366F1' : pct >= 40 ? '#F59E0B' : '#F43F5E'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="rounded-xl border border-ink-100 bg-white p-4 space-y-3 shadow-xs hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-sm text-ink-800 font-body leading-snug">{section.section}</p>
        <span className="font-display font-bold text-lg shrink-0" style={{ color }}>{pct}%</span>
      </div>
      <AnimatedBar value={pct} color={color} delay={index * 80} height={6}/>
      <p className="text-xs text-ink-500 font-body leading-relaxed">{section.reason}</p>
      {section.suggestions?.map((s, i) => (
        <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
          <span className="text-amber-500 mt-0.5 shrink-0">→</span><span>{s}</span>
        </div>
      ))}
    </motion.div>
  )
}

function GapCard({ gap }) {
  const impColors = {
    critical: { bg: 'bg-rose-50/70', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-800' },
    important: { bg: 'bg-amber-50/70', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
    nice_to_have: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-ink-600', badge: 'bg-slate-100 text-slate-800' },
  }
  const style = impColors[gap.importance] || impColors.nice_to_have
  return (
    <div className={`p-4 rounded-xl border ${style.bg} ${style.border} space-y-2 hover:scale-[1.01] transition-transform`}>
      <div className="flex items-center justify-between">
        <span className="font-mono font-semibold text-sm capitalize text-ink-800">{gap.skill}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${style.badge}`}>{gap.importance}</span>
      </div>
      {gap.estimated_learning_weeks && (
        <p className="text-[11px] font-mono text-ink-400">⏱ ~{gap.estimated_learning_weeks} weeks to learn</p>
      )}
      {gap.learning_resources?.slice(0, 2).map((r, i) => (
        <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
          className="block text-[11px] text-indigo-600 hover:text-indigo-800 font-mono truncate transition-colors">
          ↗ {r.title}
        </a>
      ))}
    </div>
  )
}

export default function ATSResumeAnalyzer({ result, jdTitle }) {
  const [activeTab, setActiveTab] = useState(0)

  // Sub-components mapped data handles safely
  const { 
    scores = {}, 
    keyword_analysis = {}, 
    matched_skills = [], 
    missing_skills = [], 
    skill_gaps = [], 
    explanation = [], 
    overall_assessment = '', 
    strengths = [], 
    weaknesses = [], 
    improvement_suggestions = [], 
    recommendation = '' 
  } = result || {}

  const recConfig = {
    strong_match: { label: 'Strong Match', color: '#10B981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    good_match: { label: 'Good Match', color: '#6366F1', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
    partial_match: { label: 'Partial Match', color: '#F59E0B', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    poor_match: { label: 'Poor Match', color: '#F43F5E', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
  }[recommendation] || { label: 'Analyzed', color: '#6366F1', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8 w-full space-y-8 font-body text-ink-800">
      
      {/* HEADER SECTION */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight font-display sm:text-3xl">
          ATS Resume Analyzer
        </h1>
        <p className="text-sm text-ink-500">
          Upload your resume and paste the job description to get AI-powered ATS scoring and skill gap analysis.
        </p>
      </div>

      {/* REFACTOR: MODULAR RE-STRUCTURED INPUT CARD CONTAINER */}
      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
        
        {/* Top tech header status indicator */}
        <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50/40 px-6 py-3 text-xs text-ink-500 font-mono">
          <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span>Hybrid BERT Semantic Matcher + TF-IDF Active</span>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            
            {/* Left Hand: Metadata Inputs & Dropzone */}
            <div className="lg:col-span-5 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  1. Your Resume
                </label>
                <div className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/30 p-6 text-center transition hover:bg-ink-50/60 hover:border-indigo-400 cursor-pointer h-[160px]">
                  <div className="p-3 bg-white rounded-lg shadow-xs border border-ink-100 group-hover:scale-110 transition-transform mb-2">
                    📄
                  </div>
                  <p className="text-sm font-medium text-ink-700">Drop PDF / DOCX here</p>
                  <p className="text-xs text-ink-400 mt-0.5">or click to browse • max 10MB</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  3. Job Title <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Senior Python Developer"
                  className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm placeholder:text-ink-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition bg-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  4. Required Skills <span className="text-ink-400 font-normal">(optional)</span>
                </label>
                <input 
                  type="text" 
                  placeholder="python, docker, aws, kubernetes"
                  className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm placeholder:text-ink-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition bg-white"
                />
              </div>
            </div>

            {/* Right Hand: Deep Job Description Input */}
            <div className="lg:col-span-7 flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  2. Job Description
                </label>
                <div className="flex gap-1.5">
                  <button className="rounded-lg bg-ink-50 border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100 transition flex items-center gap-1">📋 Paste</button>
                  <button className="rounded-lg bg-ink-50 border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100 transition flex items-center gap-1">📎 File</button>
                </div>
              </div>
              <textarea 
                placeholder="Paste the full job description here... Include required skills, responsibilities, and qualifications requested."
                className="w-full flex-1 min-h-[320px] lg:min-h-0 rounded-xl border border-ink-200 p-4 text-sm placeholder:text-ink-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition resize-none bg-white"
              />
            </div>
          </div>

          {/* Configuration Summary & Modern Processing Button */}
          <div className="pt-5 border-t border-ink-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2 text-[11px] font-mono">
              <span className="rounded-md bg-indigo-50 px-2 py-1 border border-indigo-100 text-indigo-700">BERT Semantic • 60%</span>
              <span className="rounded-md bg-emerald-50 px-2 py-1 border border-emerald-100 text-emerald-700">TF-IDF Keywords • 40%</span>
              <span className="rounded-md bg-slate-50 px-2 py-1 border border-slate-100 text-ink-500">Skill Gap Analysis</span>
            </div>

            <button className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500 transform active:scale-98 transition-all duration-150 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
              Analyze & Score Resume
            </button>
          </div>
        </div>
      </div>

      {/* CONDITIONAL ANALYSIS OUTPUT SECTION */}
      {result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          
          {/* Hero Score Card */}
          <div className={`rounded-2xl p-6 ${recConfig.bg} border ${recConfig.border} relative overflow-hidden shadow-xs`}>
            <div className="absolute inset-0 bg-mesh opacity-40 pointer-events-none"/>
            <div className="relative flex flex-col md:flex-row items-center gap-6">
              <ScoreRing score={scores.final_score} size={130} label="ATS Score"/>
              <div className="flex-1 text-center md:text-left space-y-3">
                <div>
                  <span className={`inline-flex items-center rounded-full bg-white px-3.5 py-1 text-xs font-semibold border ${recConfig.border} ${recConfig.text} shadow-xs`}>
                    ✦ {recConfig.label}
                  </span>
                  {jdTitle && <p className="text-xs font-mono text-ink-400 mt-2">vs. {jdTitle}</p>}
                </div>
                <p className="text-sm text-ink-600 font-body leading-relaxed max-w-xl">{overall_assessment}</p>

                <div className="grid grid-cols-3 gap-3 pt-1">
                  {[
                    { label: 'BERT Score', val: scores.bert_score, color: '#6366F1' },
                    { label: 'TF-IDF Overlap', val: scores.tfidf_score, color: '#10B981' },
                    { label: 'Match Rate', val: keyword_analysis?.keyword_match_rate, color: '#F59E0B' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="bg-white/90 backdrop-blur-xs rounded-xl p-2.5 text-center border border-white/60 shadow-2xs">
                      <p className="text-[10px] font-mono text-ink-400 mb-0.5">{label}</p>
                      <p className="font-display font-bold text-base" style={{ color }}>{Math.round((val || 0) * 100)}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Bar Tabs */}
          <div className="border-b border-ink-100 flex gap-2 overflow-x-auto no-scrollbar py-1">
            {TABS.map((tab, i) => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(i)} 
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-all whitespace-nowrap
                  ${activeTab === i 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-ink-400 hover:text-ink-600 hover:border-ink-200'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Dynamic Tab Panel Blocks */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {/* OVERVIEW TAB */}
              {activeTab === 0 && (
                <div className="rounded-2xl border border-ink-100 bg-white p-6 space-y-5 shadow-xs">
                  <h3 className="font-display font-semibold text-ink-800 text-base">Score Breakdown</h3>
                  <div className="space-y-4">
                    <ScoreRow label="BERT Semantic Similarity" value={scores.bert_score} color="#6366F1" delay={0}/>
                    <ScoreRow label="TF-IDF Keyword Overlap" value={scores.tfidf_score} color="#10B981" delay={100}/>
                    <ScoreRow label="Experience Relevance" value={scores.experience_score} color="#F59E0B" delay={200}/>
                    <ScoreRow label="Education Match" value={scores.education_score} color="#8B5CF6" delay={300}/>
                    <ScoreRow label="Skills Coverage" value={scores.skills_score} color="#0EA5E9" delay={400}/>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-indigo-50/50 border border-indigo-100/60 rounded-xl">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-mono text-xs font-bold">ƒ</div>
                    <p className="text-xs font-mono text-indigo-700">Final Score formula weights: 60% BERT Neural Embeddings + 40% Exact TF-IDF Vectorization Match</p>
                  </div>
                </div>
              )}

              {/* KEYWORDS TAB */}
              {activeTab === 1 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display font-semibold text-ink-800 text-sm">Matched Contextual Keywords</h3>
                      <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded text-xs font-medium">{(keyword_analysis?.matched_keywords || matched_skills || []).length} found</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(keyword_analysis?.matched_keywords || matched_skills || []).slice(0, 40).map(k => <Chip key={k} word={k} matched/>)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display font-semibold text-ink-800 text-sm">Missing Recommended Keywords</h3>
                      <span className="bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded text-xs font-medium">{(keyword_analysis?.missing_keywords || []).length} missing</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(keyword_analysis?.missing_keywords || []).slice(0, 40).map(k => <Chip key={k} word={k} matched={false}/>)}
                    </div>
                  </div>
                </div>
              )}

              {/* SKILLS TAB */}
              {activeTab === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-xs">
                      <h3 className="font-display font-semibold text-ink-800 mb-3 text-sm">✓ Covered Requirements</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(matched_skills || []).map(s => (
                          <div key={s} className="flex items-center gap-2 text-xs font-body py-0.5">
                            <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-[9px]">✓</span>
                            <span className="text-ink-700 capitalize truncate">{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-xs">
                      <h3 className="font-display font-semibold text-ink-800 mb-3 text-sm">○ Critical Skill Shortages</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(missing_skills || []).slice(0, 16).map(s => (
                          <div key={s} className="flex items-center gap-2 text-xs font-body py-0.5">
                            <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 text-[10px]">○</span>
                            <span className="text-ink-600 capitalize truncate">{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {skill_gaps?.length > 0 && (
                    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-xs">
                      <h3 className="font-display font-semibold text-ink-800 mb-4 text-sm">Targeted Learning Path Insights</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {skill_gaps.slice(0, 9).map((g, i) => <GapCard key={i} gap={g}/>)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* EXPLAIN TAB */}
              {activeTab === 3 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(explanation || []).map((s, i) => <ExplainCard key={i} section={s} index={i}/>)}
                </div>
              )}

              {/* ROADMAP TAB */}
              {activeTab === 4 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-xs">
                      <h3 className="font-display font-semibold text-ink-800 mb-3 text-sm">Key Resume Strengths</h3>
                      <div className="space-y-2.5">
                        {(strengths || []).map((s, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                            <span className="w-4 h-4 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[9px]">✓</span>
                            <span className="text-xs text-ink-700 font-body leading-relaxed">{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-xs">
                      <h3 className="font-display font-semibold text-ink-800 mb-3 text-sm">Structural Disadvantages</h3>
                      <div className="space-y-2.5">
                        {(weaknesses || []).map((w, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-rose-50/50 border border-rose-100 rounded-xl">
                            <span className="w-4 h-4 rounded-full bg-rose-200 text-rose-800 flex items-center justify-center shrink-0 mt-0.5 text-xs">→</span>
                            <span className="text-xs text-ink-700 font-body leading-relaxed">{w}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-xs">
                    <h3 className="font-display font-semibold text-ink-800 mb-4 text-sm">Strategic Optimization Action Items</h3>
                    <div className="space-y-3">
                      {(improvement_suggestions || []).map((s, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="flex items-start gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200"
                        >
                          <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-600 font-mono text-[10px] font-bold">
                            {String(i+1).padStart(2, '0')}
                          </div>
                          <span className="text-xs text-ink-700 font-body leading-relaxed">{s}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}