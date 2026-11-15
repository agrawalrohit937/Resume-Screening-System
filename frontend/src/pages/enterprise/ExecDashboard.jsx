import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
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
  Loader2,
  RefreshCw,
  FileText,
  Table,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getExecAnalytics, getRequisitions, recordApprovalDecision } from '../../services/api'
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
  const [requisitions, setRequisitions] = useState([])
  const [actionLoading, setActionLoading] = useState({})

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setAnalyticsError(false)
    try {
      const [analyticsRes, reqRes] = await Promise.allSettled([
        getExecAnalytics(),
        getRequisitions(),
      ])

      if (analyticsRes.status === 'fulfilled') {
        const res = analyticsRes.value
        if (res.data?.success && res.data?.data) {
          setAnalytics(res.data.data)
        } else {
          setAnalytics(res.data || null)
        }
      }

      if (reqRes.status === 'fulfilled' && Array.isArray(reqRes.value?.data)) {
        setRequisitions(reqRes.value.data)
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

  const handleRequisitionDecision = async (reqId, decision) => {
    setActionLoading(prev => ({ ...prev, [reqId]: decision }))
    try {
      await recordApprovalDecision(reqId, {
        decision,
        comments: `${decision === 'approved' ? 'Approved' : 'Rejected'} by Company Executive`,
      })
      toast.success(`Requisition ${decision === 'approved' ? 'Approved' : 'Rejected'}! 📋`)
      await fetchAnalytics()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update requisition decision.')
    } finally {
      setActionLoading(prev => ({ ...prev, [reqId]: null }))
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [tenantId, fetchAnalytics])

  const scrollContainerRef = useRef(null)

  const scrollHorizontally = (offset) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' })
    }
  }

  // Sort requisitions: Pending approval first, then most recent created_at first
  const sortedRequisitions = useMemo(() => {
    return [...requisitions].sort((a, b) => {
      if (a.status === 'pending_approval' && b.status !== 'pending_approval') return -1
      if (b.status === 'pending_approval' && a.status !== 'pending_approval') return 1
      const da = new Date(a.created_at || 0).getTime()
      const db = new Date(b.created_at || 0).getTime()
      if (db !== da) return db - da
      return String(b.id || '').localeCompare(String(a.id || ''))
    })
  }, [requisitions])

  // Headcount fallback calculation from live requisitions state if backend hasn't refreshed
  const reqApprovedCount = useMemo(() => {
    return requisitions
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + (Number(r.headcount) || 1), 0)
  }, [requisitions])

  const kpis = analytics?.kpis || {}
  const approvedHeadcount = Math.max(Number(kpis.approved_headcount || 0), reqApprovedCount)
  const filledHires = Number(kpis.filled_hires || 0)
  const attainmentPct = approvedHeadcount > 0 ? Math.round((filledHires / approvedHeadcount) * 100) : Number(kpis.headcount_attainment_pct || 0)
  const offerRate = Number(kpis.offer_acceptance_rate || 0)
  const avgTimeToFill = Number(kpis.avg_time_to_fill_days || 0)
  const hasCompletedHires = filledHires > 0

  const backendHeadcount = Array.isArray(analytics?.headcount_by_department) ? analytics.headcount_by_department : []
  const headcountData = useMemo(() => {
    if (backendHeadcount.length > 0) return backendHeadcount
    // Synthesize from live requisitions if backend hasn't populated
    const map = {}
    requisitions.forEach(r => {
      const dept = r.department || 'Engineering'
      if (!map[dept]) map[dept] = { department: dept, approved: 0, filled: 0 }
      if (r.status === 'approved') {
        map[dept].approved += Number(r.headcount) || 1
      }
      map[dept].filled += Number(r.filled_count) || 0
    })
    return Object.values(map).filter(d => d.approved > 0 || d.filled > 0)
  }, [backendHeadcount, requisitions])

  const diversityData = Array.isArray(analytics?.diversity_distribution) ? analytics.diversity_distribution : []
  const genderData = Array.isArray(analytics?.gender_distribution) ? analytics.gender_distribution : []
  const raceData = Array.isArray(analytics?.race_distribution) ? analytics.race_distribution : []
  const velocityData = Array.isArray(analytics?.hiring_velocity) ? analytics.hiring_velocity : []
  const totalEeoResponses = Number(analytics?.total_eeo_responses || 0)
  const hasVelocityActivity = velocityData.some((item) => (
    Number(item.hires || 0) > 0 || Number(item.target || 0) > 0
  ))

  // ── 1. Export as Excel Spreadsheet (.csv) ──────────────────────────────────
  const handleExportExcel = () => {
    try {
      const rows = []
      rows.push(['CAREERSHALA ENTERPRISE TALENT INTELLIGENCE — EXECUTIVE BOARD AUDIT'])
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
        <div class="org-title">CareerShala Enterprise • Executive Leadership Portal</div>
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
      <span>CareerShala Corporate Governance • Read-Only Executive Brief</span>
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

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-20 font-sans text-slate-800 antialiased">
      
      {/* ── 1. Page Header (Seamless Corporate Banner matching Team Management) ──────────────────── */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-[#eef3fb] border border-slate-200/60 shadow-xs min-h-[190px] flex items-center mb-6">
        
        {/* Background Image - strictly on the right 55% */}
        <div 
          className="hidden sm:block absolute top-0 right-0 w-[55%] h-full bg-cover bg-center"
          style={{ 
            backgroundImage: "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')" 
          }}
        />
        
        {/* Exact color stops fading to 0 opacity of the same background color */}
        <div className="hidden sm:block absolute inset-0 bg-gradient-to-r from-[#eef3fb] from-[45%] via-[#eef3fb]/85 via-[60%] to-[#eef3fb]/0 z-0 pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10 w-full p-5 sm:p-8 h-full flex flex-col justify-center">
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

              <Link
                to="/interviewer/dashboard"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs hover:shadow-xs transition cursor-pointer"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Candidate Evaluations</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {loading && !analytics ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="h-3 w-28 bg-slate-200 rounded" />
                  <div className="w-10 h-10 rounded-xl bg-slate-100" />
                </div>
                <div className="h-8 w-20 bg-slate-200 rounded mt-4" />
                <div className="h-3 w-36 bg-slate-100 rounded mt-3 pt-2.5 border-t border-slate-100" />
              </div>
            ))}
          </div>
          <div className="bg-white p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs h-40 animate-pulse" />
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
              <p className="text-3xl font-black text-slate-900 mt-3">
                {approvedHeadcount} <span className="text-base font-bold text-slate-500">Roles</span>
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
              <p className="text-3xl font-black text-slate-900 mt-3">
                {filledHires} <span className="text-base font-bold text-slate-500">Filled</span>
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
              <p className="text-3xl font-black text-slate-900 mt-3">
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
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-3">
              {hasCompletedHires ? avgTimeToFill : '—'} <span className="text-base font-bold text-slate-500">{hasCompletedHires ? 'Days' : ''}</span>
              </p>
              <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 text-[11.5px] font-semibold text-indigo-600">
                <Clock className="w-3.5 h-3.5" />
                <span>Duration from requisition opening to fill</span>
              </div>
            </div>

          </div>

          {/* ── 2.5 Headcount Requisitions & Budget Approval Section (Horizontal Stream) ── */}
          {sortedRequisitions.length > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      Headcount Requisitions &amp; Budget Governance
                    </h3>
                    {sortedRequisitions.filter(r => r.status === 'pending_approval').length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                        {sortedRequisitions.filter(r => r.status === 'pending_approval').length} Pending Sign-Off
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Executive sign-off for new team requisitions, salary bands, and headcount allocation (recent first).
                  </p>
                </div>

                {/* Horizontal Navigation & Counter */}
                <div className="flex items-center gap-2.5">
                  <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">
                    {sortedRequisitions.length} Requisitions • Scroll horizontally
                  </span>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => scrollHorizontally(-380)}
                      title="Scroll Left"
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollHorizontally(380)}
                      title="Scroll Right"
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Horizontal Scroll Track (Prevents vertical page bloat) */}
              <div className="relative">
                <div
                  ref={scrollContainerRef}
                  className="flex items-stretch gap-4 overflow-x-auto pb-3 pt-1 px-0.5 custom-scrollbar snap-x snap-mandatory scroll-smooth"
                >
                  {sortedRequisitions.map((req) => {
                    const isApproved = req.status === 'approved'
                    const isRejected = req.status === 'rejected'
                    const isPending = !isApproved && !isRejected
                    const isLoading = actionLoading[req.id]

                    const sym = (req.budget_currency === 'INR' || !req.budget_currency || req.budget_currency === '$') ? '₹ ' : `${req.budget_currency} `
                    const formattedBudget = req.budget_range || (
                      req.budget_min && req.budget_max
                        ? `${sym}${Number(req.budget_min).toLocaleString()} - ${sym}${Number(req.budget_max).toLocaleString()}`
                        : req.budget_min
                        ? `${sym}${Number(req.budget_min).toLocaleString()}`
                        : 'Unspecified'
                    )

                    return (
                      <div
                        key={req.id}
                        className="w-[340px] sm:w-[380px] shrink-0 snap-start p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between space-y-4 shadow-2xs"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                                isApproved
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isRejected
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending Sign-Off'}
                            </span>
                            <div className="text-right">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Salary Range</span>
                              <div className="text-xs font-bold text-slate-800 mt-0.5">{formattedBudget}</div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-bold text-slate-900 text-base">{req.title}</h4>
                            <p className="text-xs text-slate-500 mt-0.5 font-medium">
                              {req.department || 'Engineering'} • Headcount: <strong className="text-slate-800">{req.headcount || 1}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">Requested by</span>
                          <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                            {req.hiring_manager_name || 'Hiring Manager'}
                          </span>
                        </div>

                        {/* Executive Action Buttons */}
                        {isPending && (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={!!isLoading}
                              onClick={() => handleRequisitionDecision(req.id, 'approved')}
                              className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                            >
                              {isLoading === 'approved' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Approve Headcount
                            </button>
                            <button
                              type="button"
                              disabled={!!isLoading}
                              onClick={() => handleRequisitionDecision(req.id, 'rejected')}
                              className="px-4 py-2 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {isLoading === 'rejected' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <X className="w-3.5 h-3.5" />
                              )}
                              Reject
                            </button>
                          </div>
                        )}

                        {isApproved && (
                          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Approved &amp; authorized for job posting by Executive</span>
                          </div>
                        )}

                        {isRejected && (
                          <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                            <X className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>Requisition rejected during executive budget review</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  )
}
