import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loader from './Loader'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function RoleGuard({ allowedRoles = [], fallbackPath = '/dashboard', showAccessDeniedCard = false, children }) {
  const { user, loading, hasRole } = useAuth()

  if (loading) {
    return <Loader />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const userRoles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
  ].filter(Boolean).map((r) => String(r).toLowerCase().trim())

  const normalizedAllowed = allowedRoles.map((r) => String(r).toLowerCase().trim())

  const isAuthorized =
    (typeof hasRole === 'function' && hasRole(allowedRoles)) ||
    userRoles.some((r) => normalizedAllowed.includes(r)) ||
    (userRoles.some((r) => ['executive', 'exec', 'admin', 'platform_admin'].includes(r)) &&
      normalizedAllowed.some((r) => ['recruiter', 'hiring_manager', 'interviewer', 'exec', 'executive'].includes(r)))

  if (!isAuthorized) {
    // Smart fallback: don't boot an employer user with an active tenant to candidate dashboard
    const hasValidTenant = Boolean(user?.tenant_id && user.tenant_id !== 'default')
    const isPlatformAdmin = userRoles.some((r) => ['admin', 'platform_admin'].includes(r))
    const isEmployer = (isPlatformAdmin || hasValidTenant) &&
      userRoles.some((r) => ['executive', 'exec', 'recruiter', 'hiring_manager', 'interviewer', 'admin'].includes(r))

    const resolvedFallback = fallbackPath !== '/dashboard'
      ? fallbackPath
      : isEmployer
      ? (userRoles.some((r) => ['executive', 'exec'].includes(r))
          ? '/exec/dashboard'
          : userRoles.includes('hiring_manager')
          ? '/hiring-manager/dashboard'
          : '/recruiter/dashboard')
      : '/dashboard'

    if (showAccessDeniedCard) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 mx-auto flex items-center justify-center shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Access Restricted</h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Your role <span className="font-semibold text-slate-700 uppercase">({user?.role || userRoles[0] || 'User'})</span> does not possess the permissions required to view this enterprise portal.
              </p>
              <div className="mt-3 inline-block px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-600 font-medium">
                Required: {allowedRoles.join(' / ').toUpperCase()}
              </div>
            </div>
            <div className="pt-2">
              <Link
                to={resolvedFallback}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" /> Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )
    }
    return <Navigate to={resolvedFallback} replace />
  }

  return children
}
