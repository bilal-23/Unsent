import type { AutosaveStatus } from '../lib/AutosaveController'
import { t } from '../i18n'

export function SaveStatus({ status, onRetry, hint }: { status: AutosaveStatus; onRetry?: () => void; hint?: string }) {
  return (
    <div className="flex min-h-6 items-center gap-2 text-sm" role="status" aria-live="polite">
      {status === 'saving' && <span className="text-muted">{t('Saving…')}</span>}
      {status === 'saved' && <span className="text-muted">{t('Saved')}</span>}
      {status === 'error' && (
        <span className="flex flex-wrap items-center gap-2 font-medium text-danger">
          {t('Unable to save — your text is still here.')}
          {hint && <span className="font-normal text-muted">{hint}</span>}
          {onRetry && (
            <button type="button" className="link font-medium" onClick={onRetry}>
              {t('Retry')}
            </button>
          )}
        </span>
      )}
    </div>
  )
}
