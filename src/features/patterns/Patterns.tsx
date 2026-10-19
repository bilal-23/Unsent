import { useMemo, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { PageHeader } from '../../components/PageHeader'
import { formatLocalDate, formatTimestamp } from '../../domain/dates'
import { PERIOD_LABELS, summarizePatterns, type PatternPeriod } from '../../domain/patterns'
import { useCheckIns, useMessages, useTrackingHistory, useUrges } from '../../hooks/useData'
import { useToday } from '../../hooks/useToday'
import { t, tp } from '../../i18n'
import { MoodStrip, TriggerBars, WeeklyBars } from './Charts'

export function Patterns() {
  const today = useToday()
  const urges = useUrges()
  const checkIns = useCheckIns()
  const messages = useMessages()
  const trackingHistory = useTrackingHistory()
  const [period, setPeriod] = useState<PatternPeriod>('30')

  const summary = useMemo(
    () =>
      urges && checkIns && messages && trackingHistory ? summarizePatterns({ urges, checkIns, messages, trackingHistory }, period, today) : null,
    [urges, checkIns, messages, trackingHistory, period, today],
  )

  return (
    <div>
      <PageHeader title={t('Patterns')} back="/" helpId="patterns" subtitle={t('A quiet look at your own entries. No scores, no predictions.')} />

      <div role="radiogroup" aria-label={t('Period')} className="mb-5 flex gap-1 rounded-xl bg-surface-2 p-1">
        {(Object.keys(PERIOD_LABELS) as PatternPeriod[]).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={period === value}
            className={`min-h-10 flex-1 rounded-lg text-sm font-medium ${period === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
            onClick={() => setPeriod(value)}
          >
            {t(PERIOD_LABELS[value])}
          </button>
        ))}
      </div>

      {!summary ? (
        <p className="hint">{t('Loading…')}</p>
      ) : summary.isEmpty ? (
        <EmptyState message={t('Your entries will appear here as you use the app.')} />
      ) : (
        <div className="space-y-4">
          <section className="grid grid-cols-3 gap-2 text-center">
            <div className="card px-2">
              <p className="font-serif text-2xl tabular-nums">{summary.urgeCount}</p>
              <p className="text-xs text-muted">{tp(summary.urgeCount, { one: 'urge noted', other: 'urges noted' })}</p>
            </div>
            <div className="card px-2">
              <p className="font-serif text-2xl tabular-nums">{summary.messagesWritten}</p>
              <p className="text-xs text-muted">{tp(summary.messagesWritten, { one: 'message written', other: 'messages written' })}</p>
            </div>
            <div className="card px-2">
              <p className="font-serif text-2xl tabular-nums">{summary.checkInCount}</p>
              <p className="text-xs text-muted">{tp(summary.checkInCount, { one: 'check-in', other: 'check-ins' })}</p>
            </div>
          </section>

          {summary.urgeCount > 0 && (
            <section className="card">
              <h2 className="section-title mb-3">{t('Urges per week')}</h2>
              <WeeklyBars weeks={summary.weeks} />
              {summary.averageIntensity !== null && (
                <p className="hint mt-2">{t('Average intensity: {n} out of 10', { n: summary.averageIntensity.toFixed(1) })}</p>
              )}
            </section>
          )}

          {summary.followUp && (
            <section className="card">
              <h2 className="section-title mb-2">{t('When you checked back')}</h2>
              <p className="font-serif text-lg">
                {tp(summary.followUp.count, {
                  one: 'Across {count} urge you followed up on, intensity went from {before} to {after} on average.',
                  other: 'Across {count} urges you followed up on, intensity went from {before} to {after} on average.',
                }, { before: summary.followUp.averageBefore.toFixed(1), after: summary.followUp.averageAfter.toFixed(1) })}
              </p>
            </section>
          )}

          {summary.triggers.length > 0 && (
            <section className="card">
              <h2 className="section-title mb-3">{t('What tends to set them off')}</h2>
              <TriggerBars triggers={summary.triggers} />
            </section>
          )}

          {summary.moods.length > 0 && (
            <section className="card">
              <h2 className="section-title mb-3">{t('Mood by day')}</h2>
              <MoodStrip moods={summary.moods} start={summary.start} end={summary.end} />
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{formatLocalDate(summary.start, { month: 'short', day: 'numeric' })}</span>
                <span>{t('Today')}</span>
              </div>
            </section>
          )}

          {summary.trackingChanges.length > 0 && (
            <section className="card">
              <h2 className="section-title mb-2">{t('Last-contact date changes')}</h2>
              <ul className="space-y-1.5 text-sm">
                {summary.trackingChanges.map((change) => (
                  <li key={change.id} className="flex flex-wrap justify-between gap-x-3">
                    <span>
                      {change.previousDate
                        ? t('{from} → {to}', { from: formatLocalDate(change.previousDate), to: formatLocalDate(change.newDate) })
                        : t('Started at {date}', { date: formatLocalDate(change.newDate) })}
                      {change.reason && <span className="text-muted"> · {change.reason}</span>}
                    </span>
                    <span className="text-xs text-muted">{formatTimestamp(change.changedAt, { dateStyle: 'medium' })}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
