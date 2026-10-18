/**
 * Safe wrappers for small, non-sensitive per-device conveniences. Web storage can
 * be unavailable (private mode, blocked site data), so every access is guarded.
 * Never put journal content here except the tab-scoped autosave shadow copy.
 */
function safeStore(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window[kind]
  } catch {
    return null
  }
}

export function readJson<T>(kind: 'localStorage' | 'sessionStorage', key: string): T | null {
  try {
    const raw = safeStore(kind)?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJson(kind: 'localStorage' | 'sessionStorage', key: string, value: unknown): boolean {
  try {
    safeStore(kind)?.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(kind: 'localStorage' | 'sessionStorage', key: string): void {
  try {
    safeStore(kind)?.removeItem(key)
  } catch {
    // ignore
  }
}

/** Removes every key this app owns (prefix `unsent:`). */
export function clearAppKeys(): void {
  for (const kind of ['localStorage', 'sessionStorage'] as const) {
    const store = safeStore(kind)
    if (!store) continue
    try {
      const keys: string[] = []
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i)
        if (key?.startsWith('unsent:')) keys.push(key)
      }
      keys.forEach((key) => store.removeItem(key))
    } catch {
      // ignore
    }
  }
}

/** Removes tab-scoped autosave shadow copies (plaintext), e.g. when the app lock is turned on. */
export function clearDraftShadows(): void {
  const store = safeStore('sessionStorage')
  if (!store) return
  try {
    const keys: string[] = []
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key?.startsWith('unsent:draft:')) keys.push(key)
    }
    keys.forEach((key) => store.removeItem(key))
  } catch {
    // ignore
  }
}

export const STORAGE_KEYS = {
  theme: 'unsent:theme',
  display: 'unsent:display',
  idea: 'unsent:idea',
  reflectionTimer: 'unsent:reflection',
  installTipDismissed: 'unsent:install-tip-dismissed',
  draft: (id: string) => `unsent:draft:${id}`,
} as const
