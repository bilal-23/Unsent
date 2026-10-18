import { Link } from 'react-router'
import { intentionStatus, noContactStatus } from '../../domain/dates'
import { useTrackers } from '../../hooks/useData'
import { t, tp } from '../../i18n'

/** Optional extra trackers. Same framing as the main count: no failure states. */
export function TrackerCards({ today }: { today: string }) {
  const trackers = useTrackers()?.filter((tracker) => !tracker.archived)
  if (!trackers?.length) return null
  return (
    <section aria-label={t('Other trackers')} className="grid gap-2 sm:grid-cols-2">
      {trackers.map((tracker) => {
        const status = noContactStatus(tracker.startDate, today)
        const intention = intentionStatus(tracker.intentionDays, status)
        return (
          <Link key={tracker.id} to="/trackers" className="card block hover:bg-surface-2">
            <p className="text-sm font-medium">{tracker.name}</p>
            <p className="mt-1 text-sm text-muted">
              {status.kind === 'ok'
                ? tp(status.days, { zero: 'Starting today', one: '{count} day', other: '{count} days' })
                : t('Check the start date')}
              {intention.kind === 'inProgress' && ` · ${t('aiming for {of}', { of: intention.of })}`}
              {intention.kind === 'reached' && ` · ${t('intention reached')}`}
            </p>
          </Link>
        )
      })}
    </section>
  )
}
