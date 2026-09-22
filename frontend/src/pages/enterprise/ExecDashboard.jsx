import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import {
  TrendingUp,
  Users,
  Building,
  Building2,
  ShieldCheck,
  Shield,
  Calendar,
  CheckCircle2,
  Clock,
  PieChart as PieIcon,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Inbox,
  FileText,
  Table,
  Sparkles,
  Lock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getExecAnalytics, seedDemoEEOData } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import CustomDropdown from '../../components/common/CustomDropdown'

export default function ExecDashboard() {
  const { user } = useAuth()
  const { tenantId } = useTenant()
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analyticsError, setAnalyticsError] = useState(false)
  const [selectedQuarter, setSelectedQuarter] = useState('Q3 2026')
  const [diversityTab, setDiversityTab] = useState('summary') // 'summary' | 'race' | 'gender'
  const [seeding, setSeeding] = useState(false)

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setAnalyticsError(false)
    try {
      const res = await getExecAnalytics()
      if (res.data?.success && res.data?.data) {
        setAnalytics(res.data.data)
      } else {
        setAnalytics(res.data || null)
      }
    } catch (err) {
      console.error('[ExecDashboard] Fetch error:', err)
      const msg = err.response?.data?.detail || 'Failed to load executive analytics.'
      toast.error(msg, { duration: 6000 })
      setAnalyticsError(true)
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
  }, [tenantId, fetchAnalytics])

  const kpis = analytics?.kpis || {}
  const approvedHeadcount = Number(kpis.approved_headcount || 0)
  const filledHires = Number(kpis.filled_hires || 0)
  const attainmentPct = Number(kpis.headcount_attainment_pct || 0)
  const offerRate = Number(kpis.offer_acceptance_rate || 0)
  const avgTimeToFill = Number(kpis.avg_time_to_fill_days || 0)

  const headcountData = Array.isArray(analytics?.headcount_by_department) ? analytics.headcount_by_department : []
  const diversityData = Array.isArray(analytics?.diversity_distribution) ? analytics.diversity_distribution : []
  const genderData = Array.isArray(analytics?.gender_distribution) ? analytics.gender_distribution : []
  const raceData = Array.isArray(analytics?.race_distribution) ? analytics.race_distribution : []
  const velocityData = Array.isArray(analytics?.hiring_velocity) ? analytics.hiring_velocity : []
  const totalEeoResponses = Number(analytics?.total_eeo_responses || 0)

  // Seed sample EEO dataset for instant executive demonstration
  const handleSeedDemoData = async () => {
    try {
      setSeeding(true)
      const res = await seedDemoEEOData()
      toast.success(res.data?.message || 'Seeded 10 demo EEO responses into compliance vault!')
      await fetchAnalytics()
    } catch (err) {
      console.error('Demo seed error:', err)
      toast.error(err.response?.data?.detail || 'Failed to seed sample demographic records.')
    } finally {
      setSeeding(false)
    }
  }

  // ── 1. Export as Excel Spreadsheet (.csv) ──────────────────────────────────
  const handleExportExcel = () => {
    try {
      const rows = []
      rows.push(['CAREERPILOT ENTERPRISE TALENT INTELLIGENCE — EXECUTIVE BOARD AUDIT'])
      rows.push([`Reporting Period: ${selectedQuarter}`, `Generated: ${new Date().toLocaleString()}`, 'Status: Official / Confidential'])
      rows.push([])
      rows.push(['1. KEY PERFORMANCE INDICATORS (KPIS)'])
      rows.push(['Metric', 'Current Value', 'Unit / Benchmark', 'Executive Notes'])
      rows.push(['Approved Headcount', approvedHeadcount, 'Roles', 'Total authorized active requisition openings'])
      rows.push(['Filled Hires', filledHires, 'Confirmed Hires', 'Candidates moved to hired status'])
      rows.push(['Headcount Attainment', `${attainmentPct}%`, 'Percentage', 'Filled hires vs approved headcount'])
      rows.push(['Offer Acceptance Rate', `${offerRate}%`, 'Percentage', 'Stage transition fidelity to hired status'])
      rows.push(['Average Time-To-Fill', `${avgTimeToFill} Days`, 'Calendar Days', 'Duration from requisition opening to completion'])
      rows.push([])
      rows.push(['2. DEPARTMENTAL HEADCOUNT PLAN & ALLOCATION'])
      rows.push(['Department', 'Target Headcount', 'Actual Hires', 'Open Requisitions', 'Attainment Rate (%)'])
      if (headcountData.length > 0) {
        headcountData.forEach(d => {
          const app = Number(d.approved || 0)
          const fil = Number(d.filled || 0)
          const openReqs = Math.max(0, app - fil)
          const pct = app > 0 ? Math.round((fil / app) * 100) : 0
          rows.push([d.department || 'General', app, fil, openReqs, `${pct}%`])
        })
      } else {
        rows.push(['No departmental allocations', 0, 0, 0, '0%'])
      }
      rows.push([])
      rows.push(['3. ANONYMIZED DIVERSITY DISTRIBUTION (EEO VAULT PROTECTED)'])
      rows.push(['Demographic Category', 'Representation Share (%)'])
      if (diversityData.length > 0) {
        diversityData.forEach(d => {
          rows.push([d.name || d.category || 'Group', `${d.value || d.count || 0}%`])
        })
      } else {
        rows.push(['No voluntary self-identification data', 'N/A'])
      }

      const csvContent = rows
        .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\r\n')

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Executive_Talent_Summary_${selectedQuarter.replace(/\s+/g, '_')}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Executive Excel Summary (.csv) downloaded for ${selectedQuarter} 📊`, { duration: 3500 })
    } catch (err) {
      console.error('Excel export error:', err)
      toast.error('Failed to export Excel spreadsheet.')
    }
  }

  // ── 2. Export as Institutional Executive Board Deck (Clean White Paper Report) ──
  const handleExportDeck = () => {
    try {
      const generatedAt = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      const deptRows = headcountData.length > 0
        ? headcountData.map(d => {
            const approved = Number(d.approved || 0)
            const filled = Number(d.filled || 0)
            const pct = approved > 0 ? Math.round((filled / approved) * 100) : 0
            return `
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #0F172A;">${d.department || 'General'}</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: center; color: #334155; font-family: monospace;">${approved}</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: center; font-weight: 700; color: #1E40AF; font-family: monospace;">${filled}</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 700; color: ${pct >= 80 ? '#047857' : pct >= 50 ? '#B45309' : '#B91C1C'}; font-family: monospace;">${pct}%</td>
              </tr>
            `
          }).join('')
        : `<tr><td colspan="4" style="padding: 16px; text-align: center; color: #94A3B8; font-style: italic;">No departmental records recorded for this period.</td></tr>`

      const diversityItems = diversityData.length > 0
        ? diversityData.map(d => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; margin-bottom: 6px;">
              <span style="font-size: 11.5px; font-weight: 600; color: #334155;">${d.name || d.category || 'Category'}</span>
              <span style="font-size: 12px; font-weight: 700; color: #0F172A; font-family: monospace;">${d.value || d.count || 0}%</span>
            </div>
          `).join('')
        : `<p style="font-size: 11.5px; color: #94A3B8; font-style: italic;">Anonymized demographic metrics isolated within EEO Vault.</p>`

      const deckHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Executive Board Memorandum — ${selectedQuarter}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #F8FAFC;
      color: #0F172A;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
      line-height: 1.5;
    }
    .memo-container {
      width: 100%;
      max-width: 900px;
      background: #FFFFFF;
      border-radius: 12px;
      border: 1px solid #CBD5E1;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      padding: 48px;
    }
    .header-bar {
      border-bottom: 2px solid #0F172A;
      padding-bottom: 20px;
      margin-bottom: 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .org-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748B; margin-bottom: 4px; }
    .doc-title { font-size: 24px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em; }
    .meta-box { text-align: right; font-size: 11px; color: #475569; }
    .confidential-tag {
      display: inline-block;
      padding: 3px 8px;
      background: #FEE2E2;
      color: #991B1B;
      font-size: 10px;
      font-weight: 800;
      border-radius: 4px;
      letter-spacing: 0.05em;
      margin-top: 6px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .kpi-box {
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 16px;
      background: #FAFAFA;
    }
    .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748B; margin-bottom: 4px; }
    .kpi-val { font-size: 22px; font-weight: 800; color: #0F172A; font-family: 'JetBrains Mono', monospace; }
    .kpi-note { font-size: 10.5px; color: #059669; font-weight: 600; margin-top: 2px; }
    .section-head {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #0F172A;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 28px; }
    th {
      background: #F1F5F9;
      border-top: 1px solid #CBD5E1;
      border-bottom: 1px solid #CBD5E1;
      padding: 8px 14px;
      text-align: left;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
    }
    .memo-footer {
      border-top: 1px solid #E2E8F0;
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10.5px;
      color: #64748B;
    }
    @media print {
      body { background: #FFFFFF; padding: 0; }
      .memo-container { border: none; box-shadow: none; padding: 20px; max-width: 100%; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="memo-container">
    <div class="header-bar">
      <div>
        <div class="org-title">CareerPilot Enterprise • Executive Leadership Portal</div>
        <h1 class="doc-title">Board of Directors Talent Deck</h1>
        <p style="font-size: 12px; color: #475569; margin-top: 2px;">
          Statutory Headcount Attainment & Workforce Performance Audit
        </p>
      </div>
      <div class="meta-box">
        <div><strong>Period:</strong> ${selectedQuarter}</div>
        <div><strong>Date:</strong> ${generatedAt}</div>
        <div class="confidential-tag">CONFIDENTIAL & PRIVILEGED</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-box">
        <div class="kpi-label">Approved Headcount</div>
        <div class="kpi-val">${approvedHeadcount}</div>
        <div class="kpi-note">Active Authorized Requisitions</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Filled Hires</div>
        <div class="kpi-val">${filledHires}</div>
        <div class="kpi-note">${attainmentPct}% Headcount Attainment</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Offer Acceptance</div>
        <div class="kpi-val">${offerRate}%</div>
        <div class="kpi-note">Acceptance Conversion</div>
      </div>
      <div class="kpi-box">
        <div class="kpi-label">Avg Time to Fill</div>
        <div class="kpi-val">${avgTimeToFill}d</div>
        <div class="kpi-note">Requisition Velocity</div>
      </div>
    </div>

    <div class="section-head">
      <span>1. Departmental Allocation: Target vs. Actual Hires</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Department</th>
          <th style="text-align: center;">Target Headcount</th>
          <th style="text-align: center;">Actual Hires</th>
          <th style="text-align: right;">Attainment</th>
        </tr>
      </thead>
      <tbody>
        ${deptRows}
      </tbody>
    </table>

    <div class="section-head">
      <span>2. Workforce Representation (EEO Statutory Safe Vault)</span>
    </div>
    <div style="margin-bottom: 28px;">
      ${diversityItems}
    </div>

    <div class="memo-footer">
      <span>CareerPilot Corporate Governance • Read-Only Executive Brief</span>
      <button class="no-print" onclick="window.print()" style="padding: 6px 14px; background: #0F172A; color: white; border: none; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
        🖨️ Print / Save as PDF
      </button>
      <span>Prepared for Board Meeting Review</span>
    </div>
  </div>
</body>
</html>`

      const blob = new Blob([deckHtml], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Executive_Board_Deck_${selectedQuarter.replace(/\s+/g, '_')}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Executive Board Deck exported & downloaded for ${selectedQuarter} 📊`, { duration: 3500 })
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Failed to generate board deck export.')
    }
  }

  // Resolve active demographic view for chart
  const activeDiversityData = diversityTab === 'race'
    ? (raceData.length > 0 ? raceData : diversityData)
    : diversityTab === 'gender'
    ? (genderData.length > 0 ? genderData : diversityData)
    : diversityData

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-20 font-sans text-slate-800 antialiased">
      
      {/* ── 1. Page Header (Seamless Corporate Banner matching Team Management) ──────────────────── */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-[#eef3fb] border border-slate-200/60 shadow-xs min-h-[190px] flex items-center mb-6">
        
        {/* Background Image - strictly on the right 55% */}
        <div 
          className="absolute top-0 right-0 w-[55%] h-full bg-cover bg-center"
          style={{ 
            backgroundImage: "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')" 
          }}
        />
        
        {/* Exact color stops fading to 0 opacity of the same background color */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#eef3fb] from-[45%] via-[#eef3fb]/85 via-[60%] to-[#eef3fb]/0 z-0 pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10 w-full p-6 sm:p-8 h-full flex flex-col justify-center">
          <div className="max-w-2xl space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100/70 text-indigo-700 text-[11px] font-bold tracking-wider uppercase border border-indigo-200/60">
                <Building2 size={13} />
                Tenant: <span className="font-mono">{tenantId || user?.tenant_id || 'default'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/70 text-amber-800 text-[11px] font-bold tracking-wider uppercase border border-amber-200/60">
                <Shield size={13} />
                Executive Control
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/70 text-emerald-800 text-[11px] font-bold tracking-wider uppercase border border-emerald-200/60">
                <ShieldCheck size={13} />
                Statutory Audit Safe
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
              Executive Talent & <span className="text-indigo-600">Headcount Intelligence</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 max-w-xl leading-relaxed">
              Real-time aggregate analytics across enterprise requisition pipelines, hiring velocity, and diversity benchmarks.
            </p>

            {/* Actions Toolbar */}
            <div className="flex items-center gap-2.5 pt-2 flex-wrap sm:flex-nowrap">
              <CustomDropdown
                value={selectedQuarter}
                onChange={(val) => setSelectedQuarter(val)}
                icon={Calendar}
                options={[
                  { value: 'Q3 2026', label: 'Quarter: Q3 2026 (Active)' },
                  { value: 'Q2 2026', label: 'Quarter: Q2 2026' },
                  { value: 'FY 2026', label: 'Full Year 2026' }
                ]}
                className="w-48 shrink-0"
                buttonClassName="py-2 px-3 text-xs font-semibold rounded-xl bg-white border border-slate-200 shadow-2xs"
              />

              <button
                onClick={fetchAnalytics}
                title="Refresh analytics"
                className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-600 shadow-2xs hover:shadow-xs transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-semibold shadow-2xs hover:shadow-xs transition cursor-pointer"
              >
                <Table className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </button>

              <button
                onClick={handleExportDeck}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs hover:shadow-xs transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-slate-300" />
                <span>Board Deck</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && !analytics ? (
        <div className="p-16 flex flex-col items-center justify-center space-y-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading aggregate enterprise talent intelligence...</p>
        </div>
      ) : (
        <>
          {/* ── 2. Key Metrics Cards (Matching Team Management Card Aesthetic) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Card 1: Approved Headcount */}
            <div className="p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Approved Headcount
                </span>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Building className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-3 font-mono">
                {approvedHeadcount} <span className="text-base font-bold text-slate-500 font-sans">Roles</span>
              </p>
              <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 text-[11.5px] font-semibold text-indigo-600">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Active authorized requisition openings</span>
              </div>
            </div>

            {/* Card 2: Filled Hires */}
            <div className="p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Filled Hires
                </span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-3 font-mono">
                {filledHires} <span className="text-base font-bold text-slate-500 font-sans">Filled</span>
              </p>
              <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 text-[11.5px] font-semibold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{attainmentPct}% Headcount Attainment</span>
              </div>
            </div>

            {/* Card 3: Offer Acceptance */}
            <div className="p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Offer Acceptance
                </span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-3 font-mono">
                {offerRate}%
              </p>
              <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 text-[11.5px] font-semibold text-blue-600">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Stage transition fidelity to hired status</span>
              </div>
            </div>

            {/* Card 4: Avg Time-To-Fill */}
            <div className="p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Avg Time-To-Fill
                </span>
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-3 font-mono">
                {avgTimeToFill} <span className="text-base font-bold text-slate-500 font-sans">Days</span>
              </p>
              <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 text-[11.5px] font-semibold text-purple-600">
                <Clock className="w-3.5 h-3.5" />
                <span>Duration from requisition opening to fill</span>
              </div>
            </div>

          </div>

          {/* ── 3. Charts Row: Departmental Headcount + Anonymized Diversity ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Departmental Headcount (Approved vs. Filled) */}
            <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Departmental Headcount: Approved vs. Filled
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Authorized target headcount vs confirmed candidate hires.</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200" /> Target
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-900 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Actual Hires
                  </span>
                </div>
              </div>

              {headcountData.length === 0 ? (
                <div className="h-72 flex flex-col items-center justify-center p-6 text-center space-y-2 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <Building className="w-10 h-10 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">No departmental headcount data available</p>
                  <p className="text-[11px] text-slate-400 max-w-sm">Approved headcount allocations and hires across departments will appear here once requisitions are initiated.</p>
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={headcountData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="department" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0F172A',
                          color: '#fff',
                          borderRadius: '12px',
                          fontSize: '12px',
                          border: 'none'
                        }}
                      />
                      <Bar dataKey="approved" fill="#E2E8F0" radius={[6, 6, 0, 0]} name="Approved Target" />
                      <Bar dataKey="filled" fill="#2563EB" radius={[6, 6, 0, 0]} name="Actual Hires" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Right: EEO Demographics Aggregate Anonymized Breakdown */}
            <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      Anonymized Diversity
                    </h3>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      EEO Vault Isolated
                    </span>
                  </div>
                  {totalEeoResponses > 0 && (
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {totalEeoResponses} responses
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aggregate candidate self-identification. Strictly decoupled from ATS scoring.
                </p>

                {/* Diversity View Tabs (When responses exist) */}
                {totalEeoResponses > 0 && (
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100/70 rounded-xl mt-3 text-xs">
                    <button
                      onClick={() => setDiversityTab('summary')}
                      className={`flex-1 py-1 px-2 rounded-lg font-semibold transition cursor-pointer ${
                        diversityTab === 'summary' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      URM Overview
                    </button>
                    <button
                      onClick={() => setDiversityTab('race')}
                      className={`flex-1 py-1 px-2 rounded-lg font-semibold transition cursor-pointer ${
                        diversityTab === 'race' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Race / Ethnicity
                    </button>
                    <button
                      onClick={() => setDiversityTab('gender')}
                      className={`flex-1 py-1 px-2 rounded-lg font-semibold transition cursor-pointer ${
                        diversityTab === 'gender' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Gender
                    </button>
                  </div>
                )}
              </div>

              {activeDiversityData.length === 0 ? (
                <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <PieIcon className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-700">No diversity responses submitted yet</p>
                    <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                      Aggregate demographics will populate here as candidates complete voluntary EEO disclosures during job application.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSeedDemoData}
                    disabled={seeding}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition cursor-pointer shadow-2xs"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-indigo-600 ${seeding ? 'animate-spin' : ''}`} />
                    <span>{seeding ? 'Seeding...' : 'Seed Demo EEO Sample'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={activeDiversityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {activeDiversityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || '#6366F1'} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val, name, item) => [`${val}% (${item?.payload?.count || 0} applicants)`, name]}
                          contentStyle={{
                            backgroundColor: '#0F172A',
                            color: '#fff',
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 max-h-36 overflow-y-auto custom-scrollbar">
                    {activeDiversityData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-xs py-0.5">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color || '#6366F1' }} />
                          <span className="text-slate-600 font-medium truncate">{item.name}</span>
                        </div>
                        <span className="font-bold text-slate-900 shrink-0">
                          {item.value}% {item.count ? <span className="text-[10px] text-slate-400 font-normal">({item.count})</span> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-600" /> Statutory EEO-1 standard
                </span>
                {totalEeoResponses > 0 && (
                  <button
                    onClick={handleSeedDemoData}
                    disabled={seeding}
                    className="text-indigo-600 hover:text-indigo-800 text-[11px] font-semibold cursor-pointer"
                  >
                    + Add Test Sample
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* ── 4. Bottom Row: Hiring Velocity & Attainment ── */}
          <div className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Hiring Velocity & Monthly Requisition Progression
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monthly candidate hires completed vs approved target headcount over the last 6 months.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Planned Target
                </span>
                <span className="flex items-center gap-1.5 text-slate-900 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> Confirmed Hires
                </span>
              </div>
            </div>

            {velocityData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center p-6 text-center space-y-2 bg-slate-50/50 rounded-2xl border border-slate-100">
                <Clock className="w-8 h-8 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No monthly hiring velocity recorded</p>
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={velocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        color: '#fff',
                        borderRadius: '12px',
                        fontSize: '12px',
                        border: 'none'
                      }}
                    />
                    <Bar dataKey="target" fill="#E2E8F0" radius={[6, 6, 0, 0]} name="Monthly Target" />
                    <Bar dataKey="hires" fill="#4F46E5" radius={[6, 6, 0, 0]} name="Confirmed Hires" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  )
}

