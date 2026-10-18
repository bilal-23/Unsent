import { useRegisterSW } from 'virtual:pwa-register/react'
import { t } from '../i18n'
import { flushAllAutosaves } from '../lib/autosaveRegistry'

/**
 * Registers the service worker (on every screen, including onboarding) and offers
 * a reload when a new version is ready. Never reloads on its own: that could
 * interrupt someone mid-sentence.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-3" role="status">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm shadow-lg">
        <span>{t('A new version of Unsent is ready.')}</span>
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={async () => {
            await flushAllAutosaves()
            await updateServiceWorker(true)
          }}
        >
          {t('Reload')}
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setNeedRefresh(false)}>
          {t('Later')}
        </button>
      </div>
    </div>
  )
}
