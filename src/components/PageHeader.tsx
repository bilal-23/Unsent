import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { t } from '../i18n'
import { Icon } from './Icon'

export function PageHeader({ title, back, actions, subtitle }: { title: string; back?: string; actions?: ReactNode; subtitle?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start gap-2">
      {back && (
        <Link to={back} className="btn-ghost -ms-3 px-2" aria-label={t('Back')}>
          <Icon name="back" className="size-5 rtl:rotate-180" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="hint mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
