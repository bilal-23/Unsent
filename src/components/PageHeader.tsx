import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { HelpId } from '../domain/help'
import { t } from '../i18n'
import { HelpButton, HelpNote } from './HelpNote'
import { Icon } from './Icon'

export function PageHeader({
  title,
  back,
  actions,
  subtitle,
  helpId,
}: {
  title: string
  back?: string
  actions?: ReactNode
  subtitle?: ReactNode
  /** Shows the screen's help note (dismissible) and an (i) button to bring it back. */
  helpId?: HelpId
}) {
  return (
    <>
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
      {(actions || helpId) && (
        <div className="flex shrink-0 items-center gap-2">
          {helpId && <HelpButton id={helpId} />}
          {actions}
        </div>
      )}
    </header>
    {helpId && <HelpNote id={helpId} />}
    </>
  )
}
