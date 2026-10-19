import { Link } from 'react-router'
import { HELP, type HelpId } from '../domain/help'
import { useHelp } from '../hooks/useHelp'
import { t } from '../i18n'
import { Icon } from './Icon'

/** "What is this?" — a short, dismissible explanation at the top of a screen. */
export function HelpNote({ id }: { id: HelpId }) {
  const { visible, dismiss } = useHelp(id)
  if (!visible) return null
  const topic = HELP[id]
  return (
    <aside className="mb-4 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-sm" aria-label={t('About {topic}', { topic: t(topic.title) })}>
      <div className="flex items-start gap-3">
        <Icon name="info" className="mt-0.5 size-5 text-accent" />
        <div className="min-w-0 flex-1 space-y-1.5 text-ink">
          {topic.body.map((paragraph) => (
            <p key={paragraph}>{t(paragraph)}</p>
          ))}
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <button type="button" className="link font-medium" onClick={dismiss}>
              {t('Got it')}
            </button>
            <Link to="/help" className="link">
              {t('All help')}
            </Link>
          </div>
        </div>
      </div>
    </aside>
  )
}

/** The (i) button that brings a dismissed note back. */
export function HelpButton({ id }: { id: HelpId }) {
  const { visible, show } = useHelp(id)
  if (visible) return null
  return (
    <button type="button" className="btn-ghost px-2.5" aria-label={t('What is this?')} title={t('What is this?')} onClick={show}>
      <Icon name="info" />
    </button>
  )
}
