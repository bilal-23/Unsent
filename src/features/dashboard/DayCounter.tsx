import type { FadeStage } from '../../domain/fade'
import { formatLocalDate, type IntentionStatus, type NoContactStatus } from '../../domain/dates'
import { t, tp } from '../../i18n'

export function DayCounter({
  status,
  intention,
  stage,
  onEditDate,
  onHadContact,
  onEditIntention,
  onHide,
}: {
  status: NoContactStatus
  intention: IntentionStatus
  stage: FadeStage
  onEditDate: () => void
  onHadContact: () => void
  onEditIntention: () => void
  onHide: () => void
}) {
  if (status.kind === 'unset') {
    return (
      <section className="card">
        <p className="font-medium">{t('Set your last-contact date')}</p>
        <p className="hint mt-1">{t('Unsent counts calendar days from the date you choose.')}</p>
        <button type="button" className="btn-primary mt-4" onClick={onEditDate}>
          {t('Set date')}
        </button>
      </section>
    )
  }

  if (status.kind === 'future') {
    return (
      <section className="card">
        <p className="font-medium">{t('This date is in the future')}</p>
        <p className="hint mt-1">
          {t('Your last-contact date is set to {date}, which has not happened yet here. This can happen after changing time zones.', {
            date: formatLocalDate(status.date),
          })}
        </p>
        <button type="button" className="btn-primary mt-4" onClick={onEditDate}>
          {t('Update the date')}
        </button>
      </section>
    )
  }

  const { days, date } = status
  const daysLabel = tp(days, { zero: 'Last contact: today', one: '{count} day since last contact', other: '{count} days since last contact' })

  if (stage === 'living') {
    return (
      <section className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted" aria-label={t('No-contact status')}>
        <span>{daysLabel}</span>
        <button type="button" className="link" onClick={onHadContact}>
          {t('I had contact')}
        </button>
      </section>
    )
  }

  const compact = stage === 'settling'

  return (
    <section className="card" aria-label={t('No-contact status')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {days === 0 ? (
            <p className={`font-serif text-ink ${compact ? 'text-2xl' : 'text-3xl'}`}>{t('Last contact: today')}</p>
          ) : (
            <p className="text-ink">
              <span className={`font-serif tabular-nums ${compact ? 'text-4xl' : 'text-6xl'}`}>{days}</span>{' '}
              <span className={compact ? 'text-base' : 'text-lg'}>
                {tp(days, { one: 'day since last contact', other: 'days since last contact' })}
              </span>
            </p>
          )}
          <p className="hint mt-1">{t('Last contact: {date}', { date: formatLocalDate(date, { dateStyle: 'long' }) })}</p>
        </div>
      </div>

      {intention.kind === 'inProgress' && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-muted">
              {t('Day {day} of your {of}-day intention', { day: intention.day, of: intention.of })}
            </span>
            <button type="button" className="link text-xs" onClick={onEditIntention}>
              {t('Change')}
            </button>
          </div>
          <div
            className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={intention.of}
            aria-valuenow={intention.day}
            aria-label={t('Intention progress')}
          >
            <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.min(100, (intention.day / intention.of) * 100)}%` }} />
          </div>
        </div>
      )}
      {intention.kind === 'reached' && (
        <div className="mt-4 rounded-xl bg-accent-soft px-3 py-2.5 text-sm">
          <p>{t('You reached your {of}-day intention.', { of: intention.of })}</p>
          <button type="button" className="link mt-1" onClick={onEditIntention}>
            {t('Set a new one')}
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <button type="button" className="link" onClick={onHadContact}>
          {t('I had contact')}
        </button>
        <button type="button" className="link" onClick={onEditDate}>
          {t('Edit date')}
        </button>
        {intention.kind === 'none' && (
          <button type="button" className="link" onClick={onEditIntention}>
            {t('Set an intention')}
          </button>
        )}
        <button type="button" className="link" onClick={onHide}>
          {t('Hide count')}
        </button>
      </div>
    </section>
  )
}
