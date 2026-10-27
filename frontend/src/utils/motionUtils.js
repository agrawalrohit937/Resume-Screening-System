/**
 * Utility functions for optimizing Framer Motion animations on mobile viewports.
 * Minimizes main-thread layout recalculations on mobile (< 768px).
 */

export const isMobileViewport = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768 || (window.matchMedia && window.matchMedia('(max-width: 767px)').matches)
}
