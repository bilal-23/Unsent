import { Link } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { MOOD_LABELS } from '../../domain/constants'
import { formatLocalDate } from '../../domain/dates'
import { useCheckIns } from '../../hooks/useData'
import { useToday } from '../../hooks/useToday'
import { t } from '../../i18n'

export function CheckInList() {
  const checkIns = useCheckIns()
  const today = useToday()
  const hasToday = checkIns?.some((c) => c.localDate === today)

  return (
    <div>
      <Link to="/journal/check-in/today" className="btn-primary mb-4 w-full">
        {hasToday ? t("Edit today's check-in") : t("Today's check-in")}
      </Link>
      {!checkIns ? (
        <p className="hint">{t('Loading…')}</p>
      ) : checkIns.length === 0 ? (
        <EmptyState message={t("A check-in is optional. Start whenever you're ready.")} />
      ) : (
        <ul className="space-y-2">
          {checkIns.map((checkIn) => (
            <li key={checkIn.id}>
              <Link to={`/journal/check-in/${checkIn.localDate}`} className="card block hover:bg-surface-2">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{checkIn.localDate === today ? t('Today') : formatLocalDate(checkIn.localDate, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                  <p className="text-sm text-muted">
                    {t('Mood: {label}', { label: t(MOOD_LABELS[checkIn.mood]) })}
                  </p>
                </div>
                {checkIn.reflection && <p className="mt-1 line-clamp-2 font-serif text-muted">{checkIn.reflection}</p>}
                {checkIn.personalWin && <p className="mt-1 text-sm text-ink">✓ {checkIn.personalWin}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
