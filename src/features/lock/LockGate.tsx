import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRepos } from '../../app/repos'
import { flushAllAutosaves } from '../../lib/autosaveRegistry'
import type { LockStatus } from '../../repositories/lockRepo'
import { LockScreen } from './LockScreen'

interface LockContextValue {
  status: LockStatus
  /** Re-reads lock status after enabling/disabling. */
  refresh: () => void
  lockNow: () => Promise<void>
}

const LockContext = createContext<LockContextValue>({ status: 'off', refresh: () => {}, lockNow: async () => {} })

// eslint-disable-next-line react-refresh/only-export-components
export function useLock() {
  return useContext(LockContext)
}

/**
 * Shows the lock screen while encrypted data is locked, and auto-locks after the
 * app has been in the background for the configured time.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const repos = useRepos()
  const [status, setStatus] = useState<LockStatus>(() => repos.lock.status())
  const hiddenAt = useRef<number | null>(null)
  const autoLockMinutes = useRef(5)

  const refresh = useCallback(() => setStatus(repos.lock.status()), [repos])

  const lockNow = useCallback(async () => {
    await flushAllAutosaves()
    repos.lock.lock()
    setStatus(repos.lock.status())
  }, [repos])

  // Keep the auto-lock delay in sync with preferences (read lazily; no live query while locked).
  useEffect(() => {
    if (status !== 'unlocked') return
    repos.preferences
      .get()
      .then((prefs) => {
        autoLockMinutes.current = prefs.autoLockMinutes
      })
      .catch(() => {})
  }, [repos, status])

  useEffect(() => {
    if (status !== 'unlocked') return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        if (autoLockMinutes.current === 0) void lockNow()
        return
      }
      if (hiddenAt.current !== null && Date.now() - hiddenAt.current >= autoLockMinutes.current * 60_000) void lockNow()
      hiddenAt.current = null
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [status, lockNow])

  const value = useMemo(() => ({ status, refresh, lockNow }), [status, refresh, lockNow])

  if (status === 'locked') return <LockScreen onUnlocked={refresh} />
  return <LockContext.Provider value={value}>{children}</LockContext.Provider>
}
