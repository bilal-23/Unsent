import { useCallback, useSyncExternalStore } from 'react'
import type { HelpId } from '../domain/help'
import { readJson, writeJson } from '../lib/storage'

/** Which help notes the user has dismissed (a per-device convenience, not user data). */
const KEY = 'unsent:help-dismissed'
const listeners = new Set<() => void>()
let cache: readonly string[] | null = null

function read(): readonly string[] {
  if (!cache) cache = readJson<string[]>('localStorage', KEY) ?? []
  return cache
}

function write(next: readonly string[]) {
  cache = next
  writeJson('localStorage', KEY, next)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useHelp(id: HelpId) {
  const dismissed = useSyncExternalStore(subscribe, read, read)
  const visible = !dismissed.includes(id)
  const dismiss = useCallback(() => write([...read().filter((d) => d !== id), id]), [id])
  const show = useCallback(() => write(read().filter((d) => d !== id)), [id])
  return { visible, dismiss, show }
}

/** Brings every help note back. */
export function resetHelp(): void {
  write([])
}
