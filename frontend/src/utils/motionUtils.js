/**
 * Utility functions for optimizing Framer Motion animations on mobile viewports.
 * Minimizes main-thread layout recalculations on mobile (< 768px).
 */

export const isMobileViewport = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768 || (window.matchMedia && window.matchMedia('(max-width: 767px)').matches)
}

/**
 * Returns light/simplified animation props for mobile screens to unblock main thread.
 * @param {Object} desktopProps - Normal desktop Framer Motion props
 */
export const getMobileOptimizedProps = (desktopProps = {}) => {
  if (isMobileViewport()) {
    return {
      initial: { opacity: 1 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.15 }
    }
  }
  return desktopProps
}
