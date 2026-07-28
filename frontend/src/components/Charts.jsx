import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'

const TIP = {
  contentStyle: {
    background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
    fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#0F172A',
    boxShadow: '0 8px 24px rgba(15,23,42,0.10)', padding: '10px 14px',
  },
  cursor: { fill: 'rgba(46,155,218,0.05)' },
}

const scoreColor = (pct) => (pct >= 80 ? '#10B981' : pct >= 60 ? '#2E9BDA' : pct >= 40 ? '#F59E0B' : '#F43F5E')

// ── Score Trend (used elsewhere in analytics — kept, restyled to match) ────
export function ScoreTrendChart({ data = [] }) {
  const formatted = data.map((d) => ({ ...d, score: Math.round((d.score || 0) * 100) }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2E9BDA" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#2E9BDA" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <Tooltip {...TIP} formatter={(v) => [`${v}%`, 'Score']} />
        <Area type="monotone" dataKey="score" stroke="#2E9BDA" strokeWidth={2.5} fill="url(#scoreGrad)" dot={{ fill: '#fff', stroke: '#2E9BDA', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function SkillDemandChart({ data = [] }) {
  const d = data.slice(0, 10).map((s) => ({ skill: s.skill, demand: Math.round((s.market_demand_score || 0) * 100) }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={d} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="skill" width={80} tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip {...TIP} formatter={(v) => [`${v}%`, 'Demand']} />
        <Bar dataKey="demand" fill="#2E9BDA" radius={[0, 6, 6, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DistributionPie({ data }) {
  const PALETTE = ['#10B981', '#2E9BDA', '#F59E0B', '#F43F5E']
  const chartData = [
    { name: 'Strong ≥80%', value: data?.strong_matches || 0 },
    { name: 'Good 60-79%', value: data?.good_matches || 0 },
    { name: 'Partial 40-59%', value: 0 },
    { name: 'Poor <40%', value: data?.poor_matches || 0 },
  ].filter((d) => d.value > 0)

  if (chartData.length === 0) return <div className="h-48 flex items-center justify-center text-blue-900/35 text-sm font-medium">Run ATS checks to see distribution</div>
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
          {chartData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip {...TIP} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontFamily: 'Inter', fontSize: 11, color: '#64748B', paddingTop: 8 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function MissingSkillsChart({ data = [] }) {
  const d = data.slice(0, 8).map((s) => ({ skill: s.skill, count: s.frequency || s.demand_count || 0 }))
  const COLORS = ['#F43F5E', '#F59E0B', '#8B5CF6', '#2E9BDA', '#0EA5E9', '#10B981', '#FB923C', '#EC4899']
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={d} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="skill" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} angle={-35} textAnchor="end" interval={0} />
        <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip {...TIP} formatter={(v) => [v, 'Missing frequency']} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={36}>
          {d.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function SkillRadarChart({ data = [] }) {
  const d = data.slice(0, 7).map((s) => ({ skill: (s.skill || '').slice(0, 10), demand: Math.round((s.market_demand_score || 0) * 100) }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={d} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
        <PolarGrid stroke="#EEF2F7" gridType="polygon" />
        <PolarAngleAxis dataKey="skill" tick={{ fill: '#64748B', fontSize: 10 }} />
        <Radar name="Demand" dataKey="demand" stroke="#2E9BDA" fill="#2E9BDA" fillOpacity={0.12} strokeWidth={2} dot={{ fill: '#2E9BDA', r: 3 }} />
        <Tooltip {...TIP} formatter={(v) => [`${v}%`, 'Market Demand']} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ── NEW: Skill Breakdown — horizontal bars replace the hard-to-read radar ──
// Built from summary.skill_radar (same field, same 5 sub-scores) but shown
// as labeled bars: instantly scannable "which skill is weak" instead of a
// blob shape you have to interpret.
export function SkillBreakdownBars({ skillRadar }) {
  if (!skillRadar) return null
  const rows = [
    ['Technical Knowledge', skillRadar.technical_knowledge],
    ['Communication', skillRadar.communication],
    ['Problem Solving', skillRadar.problem_solving],
    ['Confidence', skillRadar.confidence],
    ['Interview Readiness', skillRadar.interview_readiness],
  ].filter(([, v]) => v !== undefined && v !== null)

  if (rows.length === 0) return null

  return (
    <div className="space-y-4">
      {rows.map(([label, val], i) => {
        const v = Math.round(val || 0)
        const c = scoreColor(v)
        return (
          <div key={label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[13px] font-bold text-blue-950">{label}</span>
              <span className="text-[13px] font-mono font-extrabold tabular-nums" style={{ color: c }}>{v}</span>
            </div>
            <div className="h-2.5 rounded-full bg-blue-50 overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${v}%` }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full" style={{ background: c }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── NEW: Per-question score strip — replaces the disconnected bar chart ───
// Reads left-to-right like a timeline of "how the interview went" instead
// of an abstract chart with no narrative.
export function QuestionScoreStrip({ answers = [] }) {
  if (answers.length === 0) return null
  return (
    <div className="flex items-end gap-2 h-28">
      {answers.map((a, i) => {
        const v = Math.round(a.evaluation?.overall_score || 0)
        const c = scoreColor(v)
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
            <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color: c }}>{v}</span>
            <div className="w-full rounded-t-lg bg-blue-50 relative overflow-hidden" style={{ height: 64 }}>
              <motion.div
                initial={{ height: 0 }} animate={{ height: `${Math.max(4, v)}%` }}
                transition={{ duration: 0.6, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-0 left-0 right-0 rounded-t-lg" style={{ background: c }}
              />
            </div>
            <span className="text-[10px] font-bold text-blue-900/35">Q{i + 1}</span>
          </div>
        )
      })}
    </div>
  )
}