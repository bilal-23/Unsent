import { Link } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { formatTimestamp } from '../../domain/dates'
import { useUrges } from '../../hooks/useData'
import { t } from '../../i18n'

export function UrgeList() {
  const urges = useUrges()
  return (
    <div>
      <PageHeader
        title={t('Urges')}
        subtitle={t('Noticing an urge is not acting on it.')}
        actions={
          <Link to="/urges/new" className="btn-primary">
            <Icon name="plus" />
            <span className="hidden sm:inline">{t('Log an urge')}</span>
            <span className="sr-only sm:hidden">{t('Log an urge')}</span>
          </Link>
        }
      />
      {!urges ? (
        <p className="hint">{t('Loading…')}</p>
      ) : urges.length === 0 ? (
        <EmptyState
          message={t('When an urge comes up, you can record it here.')}
          action={
            <Link to="/urges/new" className="btn-primary">
              {t('Log an urge')}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2">
          {urges.map((urge) => (
            <li key={urge.id}>
              <Link to={`/urges/${urge.id}`} className="card flex items-start gap-4 hover:bg-surface-2">
                <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-2">
                  <span className="text-lg leading-none font-semibold tabular-nums">{urge.intensity}</span>
                  <span className="text-[0.6rem] text-muted">/10</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{[urge.trigger && t(urge.trigger), urge.emotion && t(urge.emotion)].filter(Boolean).join(' · ') || t('Urge noted')}</p>
                  {urge.note && <p className="mt-0.5 line-clamp-2 font-serif text-muted">{urge.note}</p>}
                  <p className="mt-1 text-xs text-muted">
                    {formatTimestamp(urge.createdAt)}
                    {urge.followUpIntensity !== undefined
                      ? ` · ${t('Later: {n}/10', { n: urge.followUpIntensity })}`
                      : ''}
                  </p>
                </div>
                {urge.followUpIntensity === undefined && <span className="shrink-0 self-center text-xs text-accent">{t('Add follow-up')}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
