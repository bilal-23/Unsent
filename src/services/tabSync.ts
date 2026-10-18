/**
 * Minimal cross-tab signalling. Record-level changes already propagate through
 * Dexie live queries; this only covers whole-database events.
 */
export type TabMessage = 'data-replaced' | 'data-wiped'

const CHANNEL_NAME = 'unsent'

function openChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME)
  } catch {
    return null
  }
}

export function broadcast(message: TabMessage): void {
  const channel = openChannel()
  if (!channel) return
  channel.postMessage(message)
  channel.close()
}

export function subscribe(handler: (message: TabMessage) => void): () => void {
  const channel = openChannel()
  if (!channel) return () => {}
  channel.onmessage = (event: MessageEvent<TabMessage>) => handler(event.data)
  return () => channel.close()
}
