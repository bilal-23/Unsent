import type { UnsentMessage } from '../domain/types'

const haystacks = new WeakMap<UnsentMessage, string>()

/** Lower-cased searchable text, cached per record object (live queries return new objects on change). */
function haystack(message: UnsentMessage, sealed: boolean): string {
  if (sealed) return ''
  let text = haystacks.get(message)
  if (text === undefined) {
    text = `${message.title}\n${message.body}\n${message.tags.join(' ')}`.toLocaleLowerCase()
    haystacks.set(message, text)
  }
  return text
}

/** Every whitespace-separated term must appear. Sealed letters never match. */
export function searchMessages(messages: readonly UnsentMessage[], query: string, isSealed: (m: UnsentMessage) => boolean): UnsentMessage[] {
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return [...messages]
  return messages.filter((message) => {
    const text = haystack(message, isSealed(message))
    return terms.every((term) => text.includes(term))
  })
}
