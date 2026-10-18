import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../i18n'

interface State {
  error: Error | null
}

/** Last-resort screen. Shows no record contents and never logs journal text. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log only the error type and component stack: never user content.
    console.error(error.name, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const chunkFailed = /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(this.state.error.message)
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
        <h1 className="text-2xl font-semibold">{t('Something went wrong')}</h1>
        <p className="mt-3 text-muted">
          {chunkFailed
            ? t('Part of the app has not been downloaded yet. Connect to the internet once to finish setting up offline use.')
            : t('Your saved entries are safe on this device. Reloading usually fixes this.')}
        </p>
        <button type="button" className="btn-primary mt-6" onClick={() => window.location.reload()}>
          {t('Reload')}
        </button>
      </div>
    )
  }
}
