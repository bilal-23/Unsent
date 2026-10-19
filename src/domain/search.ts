/**
 * Local full-text search over the user's own entries. Everything runs in memory;
 * nothing is indexed to disk or sent anywhere.
 */
export type SearchKind = 'message' | 'urge' | 'checkIn' | 'goodThing' | 'plan' | 'habit' | 'exercise' | 'voiceNote' | 'list'

export interface SearchDocument {
  key: string
  kind: SearchKind
  /** Short label shown as the result's heading. */
  title: string
  /** Searchable text shown in snippets (title is searched too). */
  text: string
  /** Extra searchable words that are never shown in snippets, e.g. tags. */
  keywords?: string
  /** For newest-first ordering: ISO timestamp or YYYY-MM-DD. */
  sortKey: string
  href: string
}

export interface Snippet {
  before: string
  match: string
  after: string
}

export interface SearchHit {
  doc: SearchDocument
  snippet: Snippet | null
}

/**
 * Lower-cases and removes accents while keeping string length unchanged, so match
 * positions found in the normalised text map straight back onto the original.
 */
export function foldForSearch(text: string): string {
  let out = ''
  for (const char of text) {
    if (char.length !== 1) {
      out += char
      continue
    }
    const base = char.normalize('NFD').charAt(0).toLowerCase()
    out += base.length === 1 ? base : char
  }
  return out
}

export function searchTerms(query: string): string[] {
  return foldForSearch(query.trim())
    .split(/\s+/)
    .filter(Boolean)
}

const SNIPPET_RADIUS = 60

/** A short excerpt around the first match of `term`, cut at word boundaries. */
export function makeSnippet(text: string, term: string): Snippet | null {
  const folded = foldForSearch(text)
  const index = folded.indexOf(term)
  if (index === -1) return null
  let start = Math.max(0, index - SNIPPET_RADIUS)
  let end = Math.min(text.length, index + term.length + SNIPPET_RADIUS)
  if (start > 0) {
    const space = text.indexOf(' ', start)
    if (space !== -1 && space < index) start = space + 1
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end)
    if (space > index + term.length) end = space
  }
  const clean = (s: string) => s.replace(/\s+/g, ' ')
  return {
    before: (start > 0 ? '…' : '') + clean(text.slice(start, index)),
    match: text.slice(index, index + term.length),
    after: clean(text.slice(index + term.length, end)) + (end < text.length ? '…' : ''),
  }
}

/**
 * Every term must appear somewhere in the title or text (AND search). Results are
 * newest first. Accents and case are ignored ("ca va" finds "Ça va").
 */
export function searchDocuments(documents: readonly SearchDocument[], query: string): SearchHit[] {
  const terms = searchTerms(query)
  if (!terms.length) return []
  const hits: SearchHit[] = []
  for (const doc of documents) {
    const haystack = foldForSearch(`${doc.title}\n${doc.text}\n${doc.keywords ?? ''}`)
    if (!terms.every((term) => haystack.includes(term))) continue
    const first = terms[0]
    hits.push({ doc, snippet: makeSnippet(doc.text, first) ?? makeSnippet(doc.title, first) })
  }
  return hits.sort((a, b) => b.doc.sortKey.localeCompare(a.doc.sortKey))
}
