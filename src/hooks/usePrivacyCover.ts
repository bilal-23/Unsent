import { useEffect, useState } from 'react'

/**
 * Covers the screen whenever the page is hidden, so the app switcher is less
 * likely to show journal content. On touch devices it also reacts to `blur`,
 * which fires as the app switcher opens; on desktop that would cover the app
 * whenever another window takes focus, so it is skipped there. Best effort:
 * some browsers capture the switcher snapshot before the page can react.
 */
export function usePrivacyCover(enabled: boolean): boolean {
  const [covered, setCovered] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const hide = () => setCovered(true)
    const show = () => setCovered(document.visibilityState === 'hidden')
    const onVisibility = () => (document.visibilityState === 'hidden' ? hide() : show())
    const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false
    document.addEventListener('visibilitychange', onVisibility)
    if (touch) window.addEventListener('blur', hide)
    window.addEventListener('focus', show)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (touch) window.removeEventListener('blur', hide)
      window.removeEventListener('focus', show)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
    }
  }, [enabled])

  const active = enabled && covered
  useEffect(() => {
    document.documentElement.classList.toggle('privacy-cover', active)
  }, [active])

  return active
}
