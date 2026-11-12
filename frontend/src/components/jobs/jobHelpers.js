import toast from 'react-hot-toast'

export const resolveJobLogo = (job) => {
  if (!job) return null
  return (
    job.company_logo ||
    job.logo_url ||
    job.company_profile?.logo_url ||
    job.company?.logo_url ||
    job.company_profile?.logo ||
    null
  )
}

export const normalizeJob = (job) => {
  const source = job || {}
  const rawId = source.id || source._id || `job_${Math.random().toString(36).slice(2, 11)}`
  const applyUrl = source.external_apply_url || null

  return {
    ...source,
    id: String(rawId),
    title: source.title || 'Untitled role',
    company_name: source.company_name || 'Unknown company',
    location: source.location || 'Remote',
    work_mode: source.work_mode || 'Remote',
    company_logo: resolveJobLogo(source),
    salary_range: source.salary_range || null,
    external_apply_url: applyUrl,
    is_external: Boolean(source.is_external === true || ['true', 'True', 1].includes(source.is_external)),
    publisher_source:
      source.publisher_source ||
      (applyUrl?.includes('linkedin.com') ? 'LinkedIn' : applyUrl?.includes('naukri.com') ? 'Naukri' : 'Direct'),
    required_skills: Array.isArray(source.required_skills) ? source.required_skills : [],
    applicant_count: Number(source.applicant_count || 0),
    min_years: Number(source.min_years ?? 0),
    status: source.status || 'open',
  }
}

export const getCompanyWebsiteUrl = (jobOrCompany) => {
  if (!jobOrCompany) return null
  const site =
    jobOrCompany.company_website ||
    jobOrCompany.website ||
    jobOrCompany.company_profile?.website ||
    jobOrCompany.company?.website ||
    null

  if (typeof site === 'string' && site.trim()) {
    const trimmed = site.trim()
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  }

  return null
}

export const dedupeCaseInsensitive = (items) => {
  const seen = new Set()
  const out = []
  for (const raw of items || []) {
    const item = String(raw || '').trim()
    const key = item.toLowerCase()
    if (item && !seen.has(key)) {
      seen.add(key)
      out.push(item)
    }
  }
  return out
}

export const shareJobListing = async (job) => {
  if (!job) return
  const jobId = job.id || job._id
  const shareUrl = `${window.location.origin}/jobs?jobId=${jobId}`
  const jobTitle = job.title || 'Career Opportunity'
  const companyName = job.company_name || 'CareerShala'

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${jobTitle} at ${companyName} | CareerShala`,
        text: `Check out this opportunity for ${jobTitle} at ${companyName}!`,
        url: shareUrl,
      })
      return
    } catch (err) {
      if (err?.name === 'AbortError') return
    }
  }

  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => toast.success('Job link copied to clipboard! 📋'))
      .catch(() => toast.success(`Job link: ${shareUrl}`))
  } else {
    toast.success(`Job link: ${shareUrl}`)
  }
}

