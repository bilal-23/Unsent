import { describe, expect, it } from 'vitest'
import { foldForSearch, makeSnippet, searchDocuments, type SearchDocument } from './search'

const doc = (key: string, text: string, sortKey = '2026-10-01', title = 'T'): SearchDocument => ({ key, kind: 'message', title, text, sortKey, href: '/' })

describe('search', () => {
  it('ignores case and accents without changing string length', () => {
    expect(foldForSearch('Ça VA, Zoë')).toBe('ca va, zoe')
    for (const text of ['Ça va 🌿 大丈夫', 'naïve café', '💙x']) expect(foldForSearch(text)).toHaveLength(text.length)
  })

  it('requires every term (AND), anywhere in title or text, newest first', () => {
    const docs = [doc('a', 'walked by the lake', '2026-10-01'), doc('b', 'the lake was cold', '2026-10-05'), doc('c', 'stayed home', '2026-10-09', 'Lake day')]
    expect(searchDocuments(docs, 'lake').map((h) => h.doc.key)).toEqual(['c', 'b', 'a'])
    expect(searchDocuments(docs, 'lake cold').map((h) => h.doc.key)).toEqual(['b'])
    expect(searchDocuments(docs, '   ')).toEqual([])
  })

  it('finds accented words from plain input and highlights the original text', () => {
    const [hit] = searchDocuments([doc('a', 'Au revoir. Ça va aller, je pense.')], 'ca va')
    expect(hit.snippet).toEqual({ before: 'Au revoir. ', match: 'Ça', after: ' va aller, je pense.' })
  })

  it('matches hidden keywords (like tags) without putting them in the snippet', () => {
    const [hit] = searchDocuments([{ ...doc('a', 'The lake at dusk'), keywords: '#memories memories' }], 'memories')
    expect(hit.doc.key).toBe('a')
    expect(hit.snippet).toBeNull()
  })

  it('cuts long snippets at word boundaries', () => {
    const long = `${'word '.repeat(40)}needle ${'more '.repeat(40)}`
    const snippet = makeSnippet(long, 'needle')!
    expect(snippet.match).toBe('needle')
    expect(snippet.before.startsWith('…')).toBe(true)
    expect(snippet.after.endsWith('…')).toBe(true)
    expect(snippet.before.length).toBeLessThan(70)
  })

  it('stays fast on thousands of entries', () => {
    const docs = Array.from({ length: 6000 }, (_, i) => doc(String(i), `entry number ${i} about ordinary things ${'filler '.repeat(30)}`))
    const started = performance.now()
    const hits = searchDocuments(docs, 'number 5999')
    expect(hits.map((h) => h.doc.key)).toEqual(['5999'])
    expect(performance.now() - started).toBeLessThan(500)
  })
})
