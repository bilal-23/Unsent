import { useCallback, useEffect, useState } from 'react'
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '../lib/storage'

interface TimerState {
  urgeId: string
  dueAt: number
}

/**
 * The optional "check back in 20 minutes" exercise after logging an urge.
 * Lives only in this tab's session (survives a refresh, not a closed tab) and
 * uses no notification permission: it surfaces as a banner when the app is open.
 */
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export function startReflectionTimer(urgeId: string, minutes: number): void {
  writeJson('sessionStorage', STORAGE_KEYS.reflectionTimer, { urgeId, dueAt: Date.now() + minutes * 60_000 } satisfies TimerState)
  notify()
}

export function clearReflectionTimer(): void {
  removeKey('sessionStorage', STORAGE_KEYS.reflectionTimer)
  notify()
}

export function useReflectionTimer() {
  const [state, setState] = useState<TimerState | null>(() => readJson<TimerState>('sessionStorage', STORAGE_KEYS.reflectionTimer))
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const sync = () => setState(readJson<TimerState>('sessionStorage', STORAGE_KEYS.reflectionTimer))
    listeners.add(sync)
    return () => {
      listeners.delete(sync)
    }
  }, [])

  useEffect(() => {
    if (!state) return
    const tick = () => setNow(Date.now())
    const interval = setInterval(tick, 15_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [state])

  const dismiss = useCallback(() => clearReflectionTimer(), [])

  return {
    pendingUrgeId: state?.urgeId ?? null,
    dueAt: state?.dueAt ?? null,
    isDue: !!state && now >= state.dueAt,
    minutesLeft: state ? Math.max(0, Math.ceil((state.dueAt - now) / 60_000)) : 0,
    dismiss,
  }
}
