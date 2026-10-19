import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { searchDocuments, type SearchKind } from '../../domain/search'
import { useCheckIns, useExerciseEntries, useHabits, useLifeLog, useMessages, usePersonalItems, usePlans, useUrges, useVoiceNotes } from '../../hooks/useData'
import { useToday } from '../../hooks/useToday'
import { t, tp } from '../../i18n'
import { buildSearchDocuments } from './buildDocuments'

const KIND_LABELS: Record<SearchKind, string> = {
  message: 'Messages',
  urge: 'Urges',
  checkIn: 'Check-ins',
  goodThing: 'Good things',
  plan: 'Plans',
  habit: 'Habits',
  exercise: 'Exercises',
  voiceNote: 'Voice notes',
  list: 'Your lists',
}

const KIND_BADGES: Record<SearchKind, string> = {
  message: 'Message',
  urge: 'Urge',
  checkIn: 'Check-in',
  goodThing: 'Good thing',
  plan: 'Plan',
  habit: 'Habit',
  exercise: 'Exercise',
  voiceNote: 'Voice note',
  list: 'List',
}

const PAGE_SIZE = 50

/** One search across everything the user has written. The query stays in memory — never in the URL or storage. */
export function Search() {
  const today = useToday()
  const messages = useMessages()
  const urges = useUrges()
  const checkIns = useCheckIns()
  const lifeLog = useLifeLog()
  const plans = usePlans()
  const exercises = useExerciseEntries()
  const voiceNotes = useVoiceNotes()
  const reasons = usePersonalItems('reason')
  const coping = usePersonalItems('coping')
  const habits = useHabits()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<SearchKind | 'all'>('all')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const deferredQuery = useDeferredValue(query)

  const ready = messages && urges && checkIns && lifeLog && plans && exercises && voiceNotes && reasons && coping && habits
  const documents = useMemo(
    () => (ready ? buildSearchDocuments({ messages, urges, checkIns, lifeLog, plans, exercises, voiceNotes, reasons, coping, habits }, today) : []),
    [ready, messages, urges, checkIns, lifeLog, plans, exercises, voiceNotes, reasons, coping, habits, today],
  )
  const hits = useMemo(() => searchDocuments(documents, deferredQuery), [documents, deferredQuery])
  const counts = useMemo(() => {
    const map = new Map<SearchKind, number>()
    for (const hit of hits) map.set(hit.doc.kind, (map.get(hit.doc.kind) ?? 0) + 1)
    return map
  }, [hits])
  const visible = kind === 'all' ? hits : hits.filter((hit) => hit.doc.kind === kind)

  return (
    <div>
      <PageHeader title={t('Search')} back="/" helpId="search" subtitle={t('Everything you have written, searched only on this device.')} />
      <label className="relative block">
        <span className="sr-only">{t('Search everything')}</span>
        <Icon name="search" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          className="field ps-9"
          placeholder={t('Search messages, urges, check-ins…')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setLimit(PAGE_SIZE)
          }}
          autoFocus
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>

      {deferredQuery.trim() && hits.length > 0 && (
        <div className="scroll-row mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('Filter results')}>
          <button type="button" className={`chip shrink-0 ${kind === 'all' ? 'chip-selected' : ''}`} aria-pressed={kind === 'all'} onClick={() => setKind('all')}>
            {t('All')} <span className="ms-1 text-xs text-muted tabular-nums">{hits.length}</span>
          </button>
          {(Object.keys(KIND_LABELS) as SearchKind[])
            .filter((k) => counts.get(k))
            .map((k) => (
              <button key={k} type="button" className={`chip shrink-0 ${kind === k ? 'chip-selected' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
                {t(KIND_LABELS[k])} <span className="ms-1 text-xs text-muted tabular-nums">{counts.get(k)}</span>
              </button>
            ))}
        </div>
      )}

      <div className="mt-4" aria-live="polite">
        {!ready ? (
          <p className="hint">{t('Loading…')}</p>
        ) : !deferredQuery.trim() ? (
          <p className="hint py-6 text-center">{t('Type a word or two. Sealed letters are never searched.')}</p>
        ) : visible.length === 0 ? (
          <p className="hint py-6 text-center">{t('Nothing matches “{query}”.', { query: deferredQuery.trim() })}</p>
        ) : (
          <>
            <p className="hint mb-2">{tp(visible.length, { one: '{count} result', other: '{count} results' })}</p>
            <ul className="space-y-2">
              {visible.slice(0, limit).map(({ doc, snippet }) => (
                <li key={doc.key}>
                  <Link to={doc.href} className="card block hover:bg-surface-2">
                    <p className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate font-medium text-ink">{doc.title}</span>
                      <span className="shrink-0 text-xs text-muted">{t(KIND_BADGES[doc.kind])}</span>
                    </p>
                    {snippet && (
                      <p className="mt-1 font-serif text-muted">
                        {snippet.before}
                        <mark className="rounded bg-accent-soft px-0.5 text-ink">{snippet.match}</mark>
                        {snippet.after}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            {visible.length > limit && (
              <button type="button" className="btn-secondary mt-4 w-full" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                {t('Show more')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
