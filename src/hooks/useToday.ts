import { useSyncExternalStore } from 'react'
import { msUntilNextLocalMidnight, toLocalDate } from '../domain/dates'

/**
 * The current local calendar date, shared by every component. Re-evaluates at
 * local midnight, when the page becomes visible or focused, and every minute
 * (sleep/wake and timezone changes fire no event). Notifies only on change.
 */
let current = toLocalDate()
const listeners = new Set<() => void>()
let teardown: (() => void) | null = null

function refresh() {
  const next = toLocalDate()
  if (next !== current) {
    current = next
    listeners.forEach((listener) => listener())
  }
}

function start() {
  let midnightTimer: ReturnType<typeof setTimeout>
  const scheduleMidnight = () => {
    midnightTimer = setTimeout(() => {
      refresh()
      scheduleMidnight()
    }, msUntilNextLocalMidnight())
  }
  scheduleMidnight()
  const interval = setInterval(refresh, 60_000)
  document.addEventListener('visibilitychange', refresh)
  window.addEventListener('focus', refresh)
  return () => {
    clearTimeout(midnightTimer)
    clearInterval(interval)
    document.removeEventListener('visibilitychange', refresh)
    window.removeEventListener('focus', refresh)
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!teardown) teardown = start()
  refresh()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && teardown) {
      teardown()
      teardown = null
    }
  }
}

export function useToday(): string {
  return useSyncExternalStore(subscribe, () => current, () => current)
}

/** Test helper: re-read the clock immediately. */
export function refreshToday(): void {
  refresh()
}
