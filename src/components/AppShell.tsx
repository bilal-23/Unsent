import { useEffect, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { useOnline } from '../hooks/useOnline'
import { usePrivacyCover } from '../hooks/usePrivacyCover'
import { useReflectionTimer } from '../hooks/useReflectionTimer'
import { t } from '../i18n'
import { Icon, type IconName } from './Icon'

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/unsent', label: 'Unsent', icon: 'pen' },
  { to: '/urges', label: 'Urges', icon: 'wave' },
  { to: '/journal', label: 'Journal', icon: 'book' },
  { to: '/settings', label: 'Settings', icon: 'gear' },
]

function NavItems({ variant }: { variant: 'bar' | 'rail' }) {
  return (
    <>
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            variant === 'bar'
              ? `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium ${isActive ? 'text-accent' : 'text-muted hover:text-ink'}`
              : `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${isActive ? 'bg-accent-soft text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'}`
          }
        >
          <Icon name={item.icon} className={variant === 'bar' ? 'size-6' : 'size-5'} />
          <span>{t(item.label)}</span>
        </NavLink>
      ))}
    </>
  )
}

function ReflectionBanner() {
  const { pendingUrgeId, isDue, dismiss } = useReflectionTimer()
  const navigate = useNavigate()
  if (!pendingUrgeId || !isDue) return null
  return (
    <div className="card mb-4 flex flex-wrap items-center gap-3 border-accent bg-accent-soft" role="status">
      <p className="min-w-0 flex-1 text-sm">{t('It has been a little while. How strong is the urge now?')}</p>
      <button
        type="button"
        className="btn-primary btn-sm"
        onClick={() => {
          dismiss()
          navigate(`/urges/${pendingUrgeId}?followup=1`)
        }}
      >
        {t('Check in')}
      </button>
      <button type="button" className="btn-ghost btn-sm" onClick={dismiss}>
        {t('Dismiss')}
      </button>
    </div>
  )
}

/** "/" opens search, unless the user is typing somewhere. */
function useSearchShortcut() {
  const navigate = useNavigate()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      navigate('/search')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navigate])
}

export function AppShell({ children, privacyCover, banners }: { children: ReactNode; privacyCover: boolean; banners?: ReactNode }) {
  const online = useOnline()
  usePrivacyCover(privacyCover)
  useSearchShortcut()

  return (
    <div className="min-h-dvh md:flex">
      {/* A button, not href="#main": with hash routing a fragment link would change the route. */}
      <button
        type="button"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
        onClick={() => document.getElementById('main')?.focus()}
      >
        {t('Skip to content')}
      </button>

      <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-56 md:shrink-0 md:flex-col md:border-e md:border-line md:p-4">
        <div className="mb-6 flex items-center gap-2 px-3 pt-2">
          <span className="font-serif text-xl text-ink">Unsent</span>
        </div>
        <nav aria-label={t('Main')} className="flex flex-col gap-1">
          <NavItems variant="rail" />
        </nav>
        <NavLink
          to="/search"
          className={({ isActive }) =>
            `mt-4 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${isActive ? 'bg-accent-soft text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'}`
          }
        >
          <Icon name="search" className="size-5" />
          <span className="flex-1">{t('Search')}</span>
          <kbd className="rounded border border-line px-1.5 text-xs text-muted">/</kbd>
        </NavLink>
      </aside>

      <div className="min-w-0 flex-1">
        {banners}
        {!online && (
          <div className="flex justify-center px-4 pt-3">
            <p className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted" role="status">
              {t('Offline — everything still works')}
            </p>
          </div>
        )}
        <main id="main" tabIndex={-1} className="mx-auto outline-none w-full max-w-2xl px-4 pt-6 pb-28 sm:px-6 md:pb-12">
          <ReflectionBanner />
          {children}
        </main>
      </div>

      <nav
        aria-label={t('Main')}
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur md:hidden"
      >
        <NavItems variant="bar" />
      </nav>

      <div className="privacy-cover-overlay fixed inset-0 z-[100] items-center justify-center bg-bg" aria-hidden="true">
        <span className="font-serif text-3xl text-muted">Unsent</span>
      </div>
    </div>
  )
}
