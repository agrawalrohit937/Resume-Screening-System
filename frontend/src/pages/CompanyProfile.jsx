import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExternalLink, ArrowLeft, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getJobsByCompany } from '../services/api'
import { getCompanyWebsiteUrl } from './JobFeed'

/**
 * Direct Company Portal Redirector.
 * Replaces dummy synthesized profile page with instant redirect to the company's official website.
 */
export default function CompanyProfile() {
  const { companyName: rawCompanyName } = useParams()
  const companyName = decodeURIComponent(rawCompanyName || '').trim()
  const navigate = useNavigate()
  const [targetUrl, setTargetUrl] = useState(null)
  const [isRedirecting, setIsRedirecting] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function performRedirect() {
      if (!companyName) {
        navigate('/jobs', { replace: true })
        return
      }

      // Check quick mapped/cached website first
      const quickUrl = getCompanyWebsiteUrl({ company_name: companyName })

      try {
        const res = await getJobsByCompany(companyName)
        const jobList = res.data?.jobs || []
        const profile = res.data?.company_profile
        const customSite = profile?.website || jobList[0]?.company_website

        if (customSite && isMounted) {
          const formatted = customSite.startsWith('http') ? customSite : `https://${customSite}`
          setTargetUrl(formatted)
          window.location.replace(formatted)
          return
        }
      } catch (err) {
        console.warn('Could not query database for company website:', err)
      }

      if (quickUrl && isMounted) {
        setTargetUrl(quickUrl)
        window.location.replace(quickUrl)
        return
      }

      if (isMounted) {
        setIsRedirecting(false)
        toast.error(`No official website listed for "${companyName}". Redirecting to jobs...`)
        setTimeout(() => {
          navigate('/jobs', { replace: true })
        }, 1200)
      }
    }

    performRedirect()

    return () => {
      isMounted = false
    }
  }, [companyName, navigate])

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 max-w-md w-full mx-auto space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto shadow-xs">
          <Loader2 size={28} className="animate-spin text-indigo-600" />
        </div>

        <div>
          <h2 className="text-xl font-extrabold text-slate-900 font-poppins">
            Redirecting to {companyName || 'Company'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Taking you directly to the official external company portal.
          </p>
        </div>

        {targetUrl && (
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm"
          >
            <span>Open {companyName} Website</span>
            <ExternalLink size={14} />
          </a>
        )}

        <button
          type="button"
          onClick={() => navigate('/jobs', { replace: true })}
          className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
        >
          <ArrowLeft size={13} />
          <span>Back to Explore Jobs</span>
        </button>
      </div>
    </div>
  )
}
