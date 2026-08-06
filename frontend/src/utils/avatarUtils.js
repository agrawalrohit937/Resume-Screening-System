/**
 * Centralized profile avatar resolution helper for CareerShala.
 *
 * Priority order:
 * 1. user.display_picture (Server-side resolved primary picture - custom upload or provider)
 * 2. user.profile_picture (Cloudinary URL or saved picture)
 * 3. user.google_picture / linked provider pictures
 * 4. null (Triggers initial avatar fallback)
 */
export function resolveAvatarUrl(user) {
  if (!user) return null

  const getValidUrl = (url) => {
    if (!url || typeof url !== 'string') return null
    const trimmed = url.trim()
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
      return trimmed
    }
    return null
  }

  return (
    getValidUrl(user.display_picture) ||
    getValidUrl(user.profile_picture) ||
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
