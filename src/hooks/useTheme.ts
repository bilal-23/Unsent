import { useEffect } from 'react'
import type { ThemePreference } from '../domain/types'
import { STORAGE_KEYS, writeJson } from '../lib/storage'

/** Applies the theme preference to <html>; mirrored to localStorage so public/theme-init.js avoids a flash. */
export function useApplyTheme(theme: ThemePreference | undefined) {
  useEffect(() => {
    if (!theme) return
    const root = document.documentElement
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = theme === 'system' ? (media?.matches ? 'dark' : 'light') : theme
      root.dataset.theme = resolved
      root.style.colorScheme = resolved
    }
    apply()
    writeJson('localStorage', STORAGE_KEYS.theme, theme)
    if (theme !== 'system' || !media) return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}
