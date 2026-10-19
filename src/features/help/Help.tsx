import { Link } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { SupportNote } from '../../components/SupportNote'
import { useToast } from '../../components/Toaster'
import { HELP, HELP_ORDER } from '../../domain/help'
import { resetHelp } from '../../hooks/useHelp'
import { t } from '../../i18n'

/** Every feature in one place. */
export function Help() {
  const toast = useToast()
  return (
    <div>
      <PageHeader title={t('Help')} back="/settings" subtitle={t('What each part of Unsent is for.')} />
      <div className="space-y-3">
        {HELP_ORDER.map((id) => {
          const topic = HELP[id]
          return (
            <section key={id} id={`help-${id}`} className="card scroll-mt-6" aria-labelledby={`help-${id}-title`}>
              <h2 id={`help-${id}-title`} className="text-lg font-semibold">
                {t(topic.title)}
              </h2>
              <div className="mt-1.5 space-y-1.5 text-muted">
                {topic.body.map((paragraph) => (
                  <p key={paragraph}>{t(paragraph)}</p>
                ))}
              </div>
              <Link to={topic.path} className="link mt-2 inline-block text-sm">
                {t('Go to {topic}', { topic: t(topic.title) })}
              </Link>
            </section>
          )
        })}
        <section className="card">
          <h2 className="text-lg font-semibold">{t('Your privacy')}</h2>
          <p className="mt-1.5 text-muted">{t('Everything stays on this device. There is no account, no server and no tracking.')}</p>
          <Link to="/privacy" className="link mt-2 inline-block text-sm">
            {t('How your data is stored')}
          </Link>
        </section>
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => {
            resetHelp()
            toast(t('Tips will show again on each screen.'))
          }}
        >
          {t('Show the tips on every screen again')}
        </button>
        <SupportNote />
      </div>
    </div>
  )
}
