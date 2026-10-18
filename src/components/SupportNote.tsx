import { t } from '../i18n'

/** A calm, non-clinical pointer to real-world support. The link opens only when tapped. */
export function SupportNote({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`rounded-xl border border-line bg-surface-2 ${compact ? 'px-3 py-2.5' : 'p-4'} text-sm text-muted`}>
      <p>
        {t('If things feel like too much, you deserve support. Talking to someone you trust, a doctor, or a helpline can help.')}{' '}
        <a className="link" href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">
          {t('Find a helpline near you')}
        </a>
        {'. '}
        {t('If you are in immediate danger, contact your local emergency number.')}
      </p>
    </aside>
  )
}
