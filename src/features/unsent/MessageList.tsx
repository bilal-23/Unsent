import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { SearchButton } from '../../components/SearchButton'
import { formatLocalDate, formatTimestamp } from '../../domain/dates'
import { isSealed } from '../../domain/sealing'
import type { HistorySort, UnsentMessage } from '../../domain/types'
import { useMessages, usePreferences } from '../../hooks/useData'
import { useToday } from '../../hooks/useToday'
import { t, tp } from '../../i18n'
import { searchMessages } from '../../lib/search'
import { VoiceNotes } from './VoiceNotes'

type Tab = 'active' | 'archived' | 'voice'
const PAGE_SIZE = 50

function preview(body: string) {
  const line = body.trim().split('\n').find((l) => l.trim()) ?? ''
  return line.length > 140 ? `${line.slice(0, 140)}…` : line
}

export function MessageList() {
  const messages = useMessages()
  const preferences = usePreferences()
  const today = useToday()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => (searchParams.get('tab') === 'voice' ? 'voice' : 'active'))
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [sortOverride, setSortOverride] = useState<HistorySort | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const deferredQuery = useDeferredValue(query)

  const sort = sortOverride ?? preferences?.defaultHistorySort ?? 'updated'

  const inTab = useMemo(() => {
    const status = tab === 'archived' ? 'archived' : 'draft'
    return messages?.filter((m) => m.status === status) ?? []
  }, [messages, tab])

  /** Tags used in this tab (sealed letters reveal nothing, not even tags), most used first. */
  const tags = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>()
    for (const message of inTab) {
      if (isSealed(message, today)) continue
      for (const label of message.tags) {
        const key = label.toLocaleLowerCase()
        const entry = counts.get(key)
        if (entry) entry.count++
        else counts.set(key, { label, count: 1 })
      }
    }
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label))
  }, [inTab, today])
  const activeTag = tag && tags.some(([key]) => key === tag) ? tag : null

  const visible = useMemo(() => {
    const sealedCheck = (m: UnsentMessage) => isSealed(m, today)
    const tagged = activeTag ? inTab.filter((m) => !sealedCheck(m) && m.tags.some((name) => name.toLocaleLowerCase() === activeTag)) : inTab
    const matched = searchMessages(tagged, deferredQuery, sealedCheck)
    const key = sort === 'created' ? 'createdAt' : 'updatedAt'
    return matched.sort((a, b) => b[key].localeCompare(a[key]))
  }, [inTab, activeTag, deferredQuery, sort, today])

  const counts = useMemo(
    () => ({
      active: messages?.filter((m) => m.status === 'draft').length ?? 0,
      archived: messages?.filter((m) => m.status === 'archived').length ?? 0,
    }),
    [messages],
  )

  return (
    <div>
      <PageHeader
        title={t('Unsent')}
        helpId="unsent"
        subtitle={t('Messages that stay here.')}
        actions={
          <>
            <SearchButton />
            {tab !== 'voice' && (
              <Link to="/unsent/new" className="btn-primary">
                <Icon name="plus" />
                <span className="hidden sm:inline">{t('Write')}</span>
                <span className="sr-only sm:hidden">{t('Write an unsent message')}</span>
              </Link>
            )}
          </>
        }
      />

      <div role="tablist" aria-label={t('Message lists')} className="mb-4 flex gap-1 rounded-xl bg-surface-2 p-1">
        {(
          [
            ['active', t('Drafts'), counts.active],
            ['archived', t('Archive'), counts.archived],
            ['voice', t('Voice'), null],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-medium ${tab === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
            onClick={() => {
              setTab(value)
              setTag(null)
              setLimit(PAGE_SIZE)
            }}
          >
            {label}
            {count !== null && count > 0 && <span className="ms-1.5 text-xs text-muted tabular-nums">{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'voice' ? (
        <VoiceNotes />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{t('Search messages')}</span>
              <Icon name="search" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                className="field ps-9"
                placeholder={t('Search')}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setLimit(PAGE_SIZE)
                }}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              <span className="sr-only">{t('Sort by')}</span>
              <select className="field w-auto py-2" value={sort} onChange={(e) => setSortOverride(e.target.value as HistorySort)}>
                <option value="updated">{t('Recently edited')}</option>
                <option value="created">{t('Recently created')}</option>
              </select>
            </label>
          </div>

          {tags.length > 0 && (
            <div className="scroll-row -mt-1 mb-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('Filter by tag')}>
              <button type="button" className={`chip shrink-0 ${!activeTag ? 'chip-selected' : ''}`} aria-pressed={!activeTag} onClick={() => setTag(null)}>
                {t('All tags')}
              </button>
              {tags.map(([key, { label, count }]) => (
                <button
                  key={key}
                  type="button"
                  className={`chip shrink-0 ${activeTag === key ? 'chip-selected' : ''}`}
                  aria-pressed={activeTag === key}
                  onClick={() => {
                    setTag(activeTag === key ? null : key)
                    setLimit(PAGE_SIZE)
                  }}
                >
                  #{label} <span className="ms-1 text-xs text-muted tabular-nums">{count}</span>
                </button>
              ))}
            </div>
          )}

          {!messages ? (
            <p className="hint">{t('Loading…')}</p>
          ) : visible.length === 0 ? (
            query || activeTag ? (
              <p className="hint py-6 text-center">{t('No messages match your search.')}</p>
            ) : tab === 'archived' ? (
              <EmptyState message={t('Archived messages will appear here.')} />
            ) : (
              <EmptyState
                message={t('Write what you need to say. It can stay here.')}
                action={
                  <Link to="/unsent/new" className="btn-primary">
                    {t('Write an unsent message')}
                  </Link>
                }
              />
            )
          ) : (
            <>
              {query && <p className="hint mb-2">{tp(visible.length, { one: '{count} message found', other: '{count} messages found' })}</p>}
              <ul className="space-y-2">
                {visible.slice(0, limit).map((message) => {
                  const sealed = isSealed(message, today)
                  return (
                    <li key={message.id}>
                      <Link to={`/unsent/${message.id}`} className="card block hover:bg-surface-2">
                        {sealed ? (
                          <p className="flex items-center gap-2 text-muted">
                            <Icon name="lock" className="size-4" />
                            {t('Sealed until {date}', { date: formatLocalDate(message.sealedUntil!) })}
                          </p>
                        ) : (
                          <>
                            <p className="font-medium text-ink">{message.title.trim() || t('Untitled')}</p>
                            {message.body.trim() && <p className="mt-1 line-clamp-2 font-serif text-muted">{preview(message.body)}</p>}
                          </>
                        )}
                        <p className="mt-2 text-xs text-muted">
                          {sort === 'created'
                            ? t('Written {date}', { date: formatTimestamp(message.createdAt, { dateStyle: 'medium' }) })
                            : t('Edited {date}', { date: formatTimestamp(message.updatedAt) })}
                          {!sealed && message.tags.length > 0 && ` · ${message.tags.join(', ')}`}
                        </p>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              {visible.length > limit && (
                <button type="button" className="btn-secondary mt-4 w-full" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                  {t('Show more')}
                </button>
              )}
            </>
          )}
          <p className="mt-8 text-center text-sm">
            <Link to="/deleted" className="link">
              {t('Recently deleted')}
            </Link>
          </p>
        </>
      )}
    </div>
  )
}
