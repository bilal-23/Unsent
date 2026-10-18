import { useEffect, useState, type ReactNode } from 'react'
import { STORAGE_ERROR_MESSAGES, StorageError } from '../db/errors'
import { t } from '../i18n'
import type { Repos } from '../repositories'
import { subscribe } from '../services/tabSync'

type State = { kind: 'opening' } | { kind: 'ready' } | { kind: 'failed'; message: string } | { kind: 'outdated' } | { kind: 'blocked' }

/** Opens the local database before anything renders and watches for other-tab upgrades. */
export function Bootstrap({ repos, children }: { repos: Repos; children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'opening' })

  useEffect(() => {
    let cancelled = false
    const offVersion = repos.connection.onVersionChange(() => setState({ kind: 'outdated' }))
    const offBlocked = repos.connection.onBlocked(() => setState({ kind: 'blocked' }))
    repos.connection
      .open()
      .then(() => repos.lock.init())
      .then(() => !cancelled && setState({ kind: 'ready' }))
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof StorageError ? STORAGE_ERROR_MESSAGES[error.kind] : STORAGE_ERROR_MESSAGES.unavailable
        setState({ kind: 'failed', message })
      })
    return () => {
      cancelled = true
      offVersion()
      offBlocked()
    }
  }, [repos])

  // Another tab replaced or wiped all data: start fresh from Home.
  useEffect(
    () =>
      subscribe((message) => {
        if (message === 'data-wiped' || message === 'data-replaced') window.location.hash = '#/'
      }),
    [],
  )

  if (state.kind === 'opening') return null
  if (state.kind === 'ready') return <>{children}</>

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      {state.kind === 'failed' && (
        <>
          <h1 className="text-2xl font-semibold">{t('Storage is not available')}</h1>
          <p className="mt-3 text-muted">{state.message}</p>
          <p className="mt-3 text-muted">
            {t('Unsent keeps everything in your browser’s local storage. Private browsing, blocked site data, or a full disk can prevent this. Try a normal window, or free up space.')}
          </p>
        </>
      )}
      {state.kind === 'outdated' && (
        <>
          <h1 className="text-2xl font-semibold">{t('Unsent was updated in another tab')}</h1>
          <p className="mt-3 text-muted">{t('Reload to continue with the latest version.')}</p>
        </>
      )}
      {state.kind === 'blocked' && (
        <>
          <h1 className="text-2xl font-semibold">{t('Finishing an update')}</h1>
          <p className="mt-3 text-muted">{t('Close other tabs with Unsent open, then reload.')}</p>
        </>
      )}
      <button type="button" className="btn-primary mt-6" onClick={() => window.location.reload()}>
        {t('Reload')}
      </button>
    </div>
  )
}
