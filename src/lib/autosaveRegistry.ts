/** Lets app-level actions (update reload, lock) flush any open editor first. */
const flushers = new Set<() => Promise<void>>()

export function registerFlusher(flush: () => Promise<void>): () => void {
  flushers.add(flush)
  return () => {
    flushers.delete(flush)
  }
}

export async function flushAllAutosaves(): Promise<void> {
  await Promise.allSettled([...flushers].map((flush) => flush()))
}
