import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Fullscreen gate for the interview with cross-browser vendor prefix support.
 */
function getFullscreenElement() {
  if (typeof document === 'undefined') return null
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  )
}

export function useFullscreenImmersive({
  onUnexpectedExit,
  enterOnMount = false,
} = {}) {
  const [immersive, setImmersive] = useState(false)
  const onUnexpectedExitRef = useRef(onUnexpectedExit)
  onUnexpectedExitRef.current = onUnexpectedExit

  // When true, the next "exit fullscreen" transition was intentional (exitImmersive)
  const intentionalExitRef = useRef(false)

  const syncFromDocument = useCallback(() => {
    setImmersive(!!getFullscreenElement())
  }, [])

  useEffect(() => {
    syncFromDocument()
    const handler = () => {
      const isFs = !!getFullscreenElement()
      setImmersive(isFs)
      if (!isFs) {
        if (intentionalExitRef.current) {
          intentionalExitRef.current = false
        } else {
          onUnexpectedExitRef.current?.()
        }
      }
    }

    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange']
    events.forEach((evt) => document.addEventListener(evt, handler))

    return () => {
      events.forEach((evt) => document.removeEventListener(evt, handler))
    }
  }, [syncFromDocument])

  const enterImmersive = useCallback(async () => {
    try {
      const el = document.documentElement
      if (!getFullscreenElement()) {
        const requestMethod =
          el.requestFullscreen ||
          el.webkitRequestFullscreen ||
          el.mozRequestFullScreen ||
          el.msRequestFullscreen

        if (requestMethod) {
          await requestMethod.call(el)
        }
      }
      syncFromDocument()
    } catch (e) {
      syncFromDocument()
    }
  }, [syncFromDocument])

  const exitImmersive = useCallback(async () => {
    intentionalExitRef.current = true
    try {
      if (getFullscreenElement()) {
        const exitMethod =
          document.exitFullscreen ||
          document.webkitExitFullscreen ||
          document.mozCancelFullScreen ||
          document.msExitFullscreen

        if (exitMethod) {
          await exitMethod.call(document)
        }
      } else {
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