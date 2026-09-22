/**
 * Centralized profile avatar resolution & Cloudinary optimization helper for CareerShala.
 *
 * Injects `q_auto,f_auto,w_100,c_fill` parameters on Cloudinary URLs to reduce image sizes
 * from ~167 KB to ~5-10 KB on mobile and desktop viewports.
 */

export function optimizeCloudinaryUrl(url, width = 100) {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (trimmed.startsWith('data:')) {
    return trimmed
  }
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
    return null
  }
  if (trimmed.includes('res.cloudinary.com')) {
    if (!trimmed.includes('q_auto')) {
      return trimmed.replace('/upload/', `/upload/q_auto,f_auto,w_${width},c_fill/`)
    }
  }
  return trimmed
}

export function resolveAvatarUrl(user, width = 100) {
  if (!user) return null

  const getValidUrl = (url) => optimizeCloudinaryUrl(url, width)

  return (
    getValidUrl(user.avatar_url) ||
    getValidUrl(user.display_picture) ||
    getValidUrl(user.profile_picture) ||
    getValidUrl(user.profile_photo_url) ||
    getValidUrl(user.photo_url) ||
    getValidUrl(user.picture) ||
    (user.linked_accounts && typeof user.linked_accounts === 'object' && (
      getValidUrl(user.linked_accounts.google?.picture) ||
      getValidUrl(user.linked_accounts.linkedin?.picture) ||
      getValidUrl(user.linked_accounts.github?.picture)
    )) ||
    getValidUrl(user.google_picture) ||
    null
  )
}

export function getInitials(fullName) {
  if (!fullName) return '?'
  const parts = String(fullName).trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return parts[0][0].toUpperCase()
}

/**
 * Clean logo resolution helper for companies.
 * Returns valid uploaded logo image URL if present, or null for monogram fallback.
 */
export function resolveCompanyLogo(companyOrName) {
  if (!companyOrName) return null

  let logoCandidate = null

  if (typeof companyOrName === 'string') {
    const trimmed = companyOrName.trim()
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/') || trimmed.startsWith('data:')) {
      logoCandidate = trimmed
    }
  } else if (typeof companyOrName === 'object') {
    logoCandidate =
      companyOrName.company_logo ||
      companyOrName.logo_url ||
      companyOrName.logo ||
      companyOrName.profile_picture ||
      null
  }

  if (logoCandidate && typeof logoCandidate === 'string' && logoCandidate.trim()) {
    const trimmed = logoCandidate.trim()
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/') || trimmed.startsWith('data:')) {
      return optimizeCloudinaryUrl(trimmed, 140)
    }
  }

  return null
}


