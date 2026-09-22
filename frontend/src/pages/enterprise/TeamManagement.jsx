import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  Trash2,
  Building2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Lock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import { getTeamMembers, inviteTeamMember, revokeTeamInvite, removeTeamMember } from '../../services/api'
import Loader from '../../components/Loader'

const ROLE_CONFIG = {
  recruiter: {
    label: 'Recruiter',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
    desc: 'Candidate pipelines, ATS screening, job posting, and talent pools.',
  },
  hiring_manager: {
    label: 'Hiring Manager',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    desc: 'Requisition headcount approvals and department pipeline evaluations.',
  },
  interviewer: {
    label: 'Interviewer',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    desc: 'Structured interview kits, scorecards, and candidate evaluations.',
  },
  executive: {
    label: 'Executive (Owner)',
    color: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    desc: 'Full company oversight, executive intelligence, and billing control.',
  },
}

export default function TeamManagement() {
  const { user } = useAuth()
  const { tenantId } = useTenant()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [members, setMembers] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [activeTab, setActiveTab] = useState('members') // 'members' | 'invites'

  // Modal State for Invites
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('interviewer')
  const [submittingInvite, setSubmittingInvite] = useState(false)
  const [generatedInvite, setGeneratedInvite] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  // State for Remove Member Modal
  const [memberToRemove, setMemberToRemove] = useState(null)
  const [removingMember, setRemovingMember] = useState(false)

  const userRoles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
  ].filter(Boolean).map((r) => String(r).toLowerCase().trim())
  const canRemoveMember = userRoles.some((r) => ['executive', 'exec', 'admin', 'platform_admin'].includes(r))

  // Configured roles: count only distinct enterprise roles (strictly excluding base 'candidate' role)
  const configuredRolesCount = useMemo(() => {
    const enterpriseRoles = members
      .flatMap((m) => (m.roles?.length ? m.roles : [m.role]))
      .filter((r) => Boolean(r) && String(r).toLowerCase().trim() !== 'candidate')

    const uniqueEnterpriseRoles = new Set(
      enterpriseRoles.map((r) => String(r).toLowerCase().trim())
    )

    return uniqueEnterpriseRoles.size || (members.length > 0 ? 1 : 0)
  }, [members])

  const fetchTeamData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true)
      else setRefreshing(true)
      const res = await getTeamMembers()
      const data = res.data || {}
      setMembers(data.members || [])
      setPendingInvites(data.pending_invites || [])
    } catch (err) {
      console.error('Failed to load team data:', err)
      toast.error(err.response?.data?.detail || 'Failed to fetch organization team members.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchTeamData()
  }, [tenantId])

  const handleSendInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid work email.')
      return
    }

    try {
      setSubmittingInvite(true)
      const res = await inviteTeamMember({
        email: inviteEmail.trim(),
        role: inviteRole,
      })
      toast.success(`Invitation generated for ${inviteEmail}!`)
      setGeneratedInvite(res.data)
      setInviteEmail('')
      fetchTeamData(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate invitation.')
    } finally {
      setSubmittingInvite(false)
    }
  }

  const handleCopyLink = (link, id = 'modal') => {
    if (!link) return
    navigator.clipboard.writeText(link)
    setCopiedId(id)
    toast.success('Invite link copied to clipboard!')
    setTimeout(() => setCopiedId(null), 3000)
  }

  const handleRevokeInvite = async (inviteId) => {
    if (!window.confirm('Are you sure you want to revoke this invitation? The link will expire immediately.')) {
      return
    }
    try {
      await revokeTeamInvite(inviteId)
      toast.success('Invitation revoked.')
      fetchTeamData(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to revoke invite.')
    }
  }

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return
    try {
      setRemovingMember(true)
      await removeTeamMember(memberToRemove.id)
      toast.success(`${memberToRemove.full_name || memberToRemove.email} has been removed from the organization.`)
      // Dynamically update the table to remove user without full page reload
      setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id))
      setMemberToRemove(null)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove team member.')
    } finally {
      setRemovingMember(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-20 font-sans text-slate-800 antialiased">
      {/* ── 1. Page Header (Seamless Image Fade UI matching Company Profile) ──────────────────── */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-[#eef3fb] border border-slate-200/60 shadow-xs min-h-[220px] flex items-center mb-6">
        
        {/* Background Image - strictly on the right 55% */}
        <div 
          className="absolute top-0 right-0 w-[55%] h-full bg-cover bg-center"
          style={{ 
            backgroundImage: "url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop')" 
          }}
        />
        
        {/* Exact color stops fading to 0 opacity of the same background color */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#eef3fb] from-[45%] via-[#eef3fb]/80 via-[60%] to-[#eef3fb]/0 z-0 pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10 w-full p-6 sm:p-8 md:p-10 h-full flex flex-col justify-center">
          <div className="max-w-xl space-y-3.5 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100/70 text-indigo-700 text-[11px] font-bold tracking-wider uppercase border border-indigo-200/60">
                <Building2 size={13} />
                Tenant: <span className="font-mono">{tenantId || user?.tenant_id || 'default'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/70 text-amber-800 text-[11px] font-bold tracking-wider uppercase border border-amber-200/60">
                <Shield size={13} />
                Executive Control
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Team Management & <span className="text-indigo-600">Access Control</span>
            </h1>

            <p className="text-sm text-slate-600 max-w-md leading-relaxed">
              Invite recruiters, hiring managers, and interviewers to your organization. Each member receives scoped permissions tailored to their active roles.
            </p>

            {/* Actions: cleanly placed on the solid left side, leaving the right team image unobstructed */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setGeneratedInvite(null)
                  setShowInviteModal(true)
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all transform hover:-translate-y-0.5 active:scale-98 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                Invite Team Member
              </button>

              <button
                onClick={() => fetchTeamData(true)}
                disabled={refreshing}
                className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-600 shadow-xs hover:shadow-sm transition-all cursor-pointer"
                title="Refresh Team"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Key Metrics Cards (Matching Company Profile White Card Aesthetic) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: Active Members */}
        <div className="p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Active Team Members
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-3">
            {members.length}
          </p>
          <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 text-[11.5px] font-semibold text-indigo-600">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Organization members with active login access</span>
          </div>
        </div>

        {/* Card 2: Pending Invites */}
        <div className="p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pending Invitations
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-3">
            {pendingInvites.length}
          </p>
          <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 text-[11.5px] font-semibold text-amber-700">
            <span className={`w-1.5 h-1.5 rounded-full ${pendingInvites.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-blue-500'}`} />
            <span>{pendingInvites.length > 0 ? `${pendingInvites.length} awaiting acceptance` : 'No invites pending'}</span>
          </div>
        </div>

        {/* Card 3: Configured Roles */}
        <div className="p-6 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Configured Roles
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-3">
            {configuredRolesCount}
          </p>
          <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 text-[11.5px] font-semibold text-purple-600">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Multi-tenant flexible role matrix</span>
          </div>
        </div>
      </div>

      {/* ── 3. Tabs: Active Members vs Pending Invites ── */}
      <div className="space-y-4 pt-2">
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === 'members'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Active Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
              activeTab === 'invites'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Pending Invitations ({pendingInvites.length})
          </button>
        </div>

        {/* ── TAB 1: Active Members Table ── */}
        {activeTab === 'members' && (
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
            {members.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">No Team Members Found</h3>
                <p className="text-slate-500 text-xs mt-1">Start by inviting your colleagues to this organization.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50/80">
                      <th className="py-3.5 px-6">Member</th>
                      <th className="py-3.5 px-6">Assigned Roles</th>
                      <th className="py-3.5 px-6">Status</th>
                      <th className="py-3.5 px-6">Joined Date</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {members.map((m) => {
                      const roles = m.roles?.length ? m.roles : [m.role]
                      const isOwner = roles.includes('executive') || roles.includes('exec')
                      const isSelf = m.id === user?.id || m.id === user?._id || m.email === user?.email
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {m.profile_picture ? (
                                <img
                                  src={m.profile_picture}
                                  alt={m.full_name}
                                  className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-xs"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                                  {m.full_name?.charAt(0) || m.email.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-2">
                                  {m.full_name || 'Team Member'}
                                  {isOwner && (
                                    <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                      Owner
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 font-medium">{m.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-wrap gap-1.5">
                              {roles
                                .filter((r) => String(r).toLowerCase().trim() !== 'candidate' || roles.length === 1)
                                .map((r) => {
                                  const cfg = ROLE_CONFIG[r] || {
                                    label: r,
                                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                                  }
                                  return (
                                    <span
                                      key={r}
                                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}
                                    >
                                      {cfg.label}
                                    </span>
                                  )
                                })}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Active
                            </span>
                          </td>
                          <td className="py-4 px-6 text-slate-500 text-xs font-medium">
                            {m.created_at ? new Date(m.created_at).toLocaleDateString() : 'Active Member'}
                          </td>
                          <td className="py-4 px-6 text-right">
                            {canRemoveMember ? (
                              isSelf ? (
                                <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60 select-none">
                                  You
                                </span>
                              ) : (
                                <button
                                  onClick={() => setMemberToRemove(m)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                                  title={`Remove ${m.full_name || m.email} from organization`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Remove
                                </button>
                              )
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Pending Invitations Table ── */}
        {activeTab === 'invites' && (
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
            {pendingInvites.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <Mail className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">No Pending Invitations</h3>
                <p className="text-slate-500 text-xs mt-1">All invited colleagues have accepted or expired.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50/80">
                      <th className="py-3.5 px-6">Invitee Email</th>
                      <th className="py-3.5 px-6">Assigned Role</th>
                      <th className="py-3.5 px-6">Expires In</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {pendingInvites.map((inv) => {
                      const cfg = ROLE_CONFIG[inv.role] || {
                        label: inv.role,
                        color: 'bg-slate-100 text-slate-700 border-slate-200',
                      }
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-900">{inv.email}</div>
                            <div className="text-xs text-slate-500 font-medium">
                              Invited by {inv.invited_by_name || 'Executive'}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-slate-500 text-xs font-medium">
                            {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : '7 Days'}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {inv.invite_link && (
                                <button
                                  onClick={() => handleCopyLink(inv.invite_link, inv.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                                >
                                  {copiedId === inv.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-blue-600" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                                      Copy Link
                                    </>
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => handleRevokeInvite(inv.id)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                                title="Revoke Invite"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 4. Invite Modal (Clean White Card Theme) ── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in text-slate-900">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Invite Team Member</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Grant scoped role access in <span className="font-mono font-semibold">{tenantId || 'Organization'}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5">
              {generatedInvite ? (
                /* Success view with copy link */
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-blue-900">Invitation Link Generated!</h4>
                      <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                        A secure token was created for <span className="font-bold">{generatedInvite.email}</span> with role{' '}
                        <span className="font-bold underline">{generatedInvite.role}</span>.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Direct Invitation Link
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedInvite.invite_link}
                        className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 select-all outline-none"
                      />
                      <button
                        onClick={() => handleCopyLink(generatedInvite.invite_link, 'modal')}
                        className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                      >
                        {copiedId === 'modal' ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy Link
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Share this URL directly with the invitee. When opened, they can set their password and immediately join your organization.
                    </p>
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button
                      onClick={() => setShowInviteModal(false)}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* Invite Form */
                <form onSubmit={handleSendInvite} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Work Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        placeholder="colleague@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 text-sm outline-none transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Assign Role
                    </label>
                    <div className="grid grid-cols-1 gap-2.5">
                      {['interviewer', 'hiring_manager', 'recruiter'].map((r) => {
                        const cfg = ROLE_CONFIG[r]
                        const isSelected = inviteRole === r
                        return (
                          <div
                            key={r}
                            onClick={() => setInviteRole(r)}
                            className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start justify-between ${
                              isSelected
                                ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                                : 'bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">{cfg.label}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.color}`}>
                                  {r}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-medium leading-relaxed">{cfg.desc}</p>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center mt-1 shrink-0 transition-all ${
                                isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingInvite}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {submittingInvite ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Send Invitation
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Remove Team Member Confirmation Modal ──────────────────────────── */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-5 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Remove Team Member
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Are you sure you want to remove <strong className="text-slate-900 font-bold">{memberToRemove.full_name || memberToRemove.email}</strong> from this organization?
              </p>
              <div className="mt-3.5 p-3.5 bg-amber-50/90 rounded-2xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-950">
                  <Lock className="w-3.5 h-3.5 shrink-0 text-amber-700" /> Tenant Access Revocation
                </p>
                <p className="leading-relaxed text-amber-800">
                  Their employer permissions, talent pools, and pipeline access will be immediately revoked. Their personal candidate account and resumes will be safely preserved.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={removingMember}
                onClick={() => setMemberToRemove(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removingMember}
                onClick={handleConfirmRemoveMember}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {removingMember ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Confirm Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
