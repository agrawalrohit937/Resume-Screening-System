/**
 * Standardized Date & Time Formatters for CareerPilot
 */

/**
 * Formats an ISO date string or Date object into a readable localized date.
 * Default format: "20 Sep 2026" (or equivalent per locale).
 *
 * @param {string | number | Date | null | undefined} dateInput
 * @param {Intl.DateTimeFormatOptions & { locale?: string }} [options]
 * @returns {string} Formatted date string or '-' on invalid/missing input
 */
export function formatDate(dateInput, options = {}) {
  if (!dateInput) return '-'
  try {
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return '-'
    const locale = options.locale || 'en-IN'
    const defaultOpts = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
    const { locale: _l, ...formatOpts } = options
    return d.toLocaleDateString(locale, { ...defaultOpts, ...formatOpts })
  } catch {
    return '-'
  }
}

/**
 * Formats an ISO date string or Date object into a readable localized time.
 * Default format: "01:04 PM".
 *
 * @param {string | number | Date | null | undefined} dateInput
 * @param {string} [locale='en-IN']
 * @returns {string} Formatted time string or empty string on invalid/missing input
 */
export function formatTime(dateInput, locale = 'en-IN') {
  if (!dateInput) return ''
  try {
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/**
 * Formats an ISO date string or Date object into a full date and time string.
 * Example: "Sep 20, 2026, 01:04 PM".
 *
 * @param {string | number | Date | null | undefined} dateInput
 * @param {string} [locale='en-IN']
 * @returns {string} Formatted date-time string or '-' on invalid/missing input
 */
export function formatDateTime(dateInput, locale = 'en-IN') {
  if (!dateInput) return '-'
  try {
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}
