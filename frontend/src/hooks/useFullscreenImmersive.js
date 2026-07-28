import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Fullscreen gate for the interview.
 *
 * FIX vs previous version: the old hook fired `onUnexpectedExit` for EVERY
 * exit from fullscreen — including ones WE caused on purpose by calling
 * `exitImmersive()` ourselves (e.g. when the user clicks "End Practice").
 * That meant ending the interview normally could get logged as a cheating
 * event and, in the worst case, trip the 3-warning auto-abort.
 *
 * Now `exitImmersive()` marks the next exit as "intentional" before it
 * happens, so the fullscreenchange listener knows to swallow it silently
 * instead of reporting it as suspicious.
 */
export function useFullscreenImmersive({
  onUnexpectedExit,
  enterOnMount = false,
} = {}) {
  const [immersive, setImmersive] = useState(false)
  const onUnexpectedExitRef = useRef(onUnexpectedExit)
  onUnexpectedExitRef.current = onUnexpectedExit

  // When true, the very next "exit fullscreen" transition was caused by us
  // (exitImmersive()) and should NOT be reported as unexpected.
  const intentionalExitRef = useRef(false)

  const syncFromDocument = useCallback(() => {
    setImmersive(!!document.fullscreenElement)
  }, [])

  useEffect(() => {
    syncFromDocument()
    const handler = () => {
      const isFs = !!document.fullscreenElement
      setImmersive(isFs)
      if (!isFs) {
        if (intentionalExitRef.current) {
          // We caused this exit on purpose (End Practice, restart, etc.) —
          // consume the flag and do NOT treat it as a violation.
          intentionalExitRef.current = false
        } else {
          onUnexpectedExitRef.current?.()
        }
      }
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [syncFromDocument])

  const enterImmersive = useCallback(async () => {
    try {
      const el = document.documentElement
      if (!document.fullscreenElement) {
        await el.requestFullscreen()
      }
      syncFromDocument()
    } catch (e) {
      // Fullscreen might be blocked (e.g. not called from a direct user
      // gesture, or the browser/OS denies it). Swallow and let the caller
      // decide what to do — never crash the flow over this.
      syncFromDocument()
    }
  }, [syncFromDocument])

  const exitImmersive = useCallback(async () => {
    intentionalExitRef.current = true
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        // Nothing to exit — clear the flag immediately so it doesn't leak
        // into a future *actually* unexpected exit.
        intentionalExitRef.current = false
      }
    } catch (e) {
      intentionalExitRef.current = false
    } finally {
      syncFromDocument()
    }
  }, [syncFromDocument])

  useEffect(() => {
    if (enterOnMount) enterImmersive()
  }, [enterOnMount, enterImmersive])

  return useMemo(
    () => ({ immersive, enterImmersive, exitImmersive }),
    [immersive, enterImmersive, exitImmersive]
  )
}