import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    listeners.forEach((listener) => listener())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    listeners.forEach((listener) => listener())
  })
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

/** iPhone/iPad Safari, not yet added to the Home Screen — the case where Safari may clear site data. */
export function isIosBrowserTab(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  return isIos && !isStandalone()
}

/** Chrome/Edge/Android install prompt, when the browser offers one. */
export function useInstallPrompt() {
  const [available, setAvailable] = useState(() => deferredPrompt !== null)

  useEffect(() => {
    const sync = () => setAvailable(deferredPrompt !== null)
    listeners.add(sync)
    return () => {
      listeners.delete(sync)
    }
  }, [])

  const install = async () => {
    const prompt = deferredPrompt
    if (!prompt) return false
    await prompt.prompt()
    const choice = await prompt.userChoice
    deferredPrompt = null
    setAvailable(false)
    return choice.outcome === 'accepted'
  }

  return { available, install }
}
