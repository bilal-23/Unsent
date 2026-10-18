import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useRepos } from '../../app/repos'
import { RatingScale } from '../../components/RatingScale'
import { useToast } from '../../components/Toaster'
import { URGE_MAX } from '../../domain/constants'
import { usePreferences } from '../../hooks/useData'
import { clearReflectionTimer } from '../../hooks/useReflectionTimer'
import { t } from '../../i18n'

const INHALE_MS = 4000
const CYCLE_MS = 10000

/** A guided breathing pause. Reduced-motion users see the text and countdown only. */
export function Pause() {
  const [params] = useSearchParams()
  const urgeId = params.get('urge')
  const repos = useRepos()
  const navigate = useNavigate()
  const toast = useToast()
  const preferences = usePreferences()
  const total = (preferences?.pauseSeconds ?? 90) * 1000
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [rating, setRating] = useState<number | undefined>()

  const elapsed = now - startedAt
  const finished = elapsed >= total

  useEffect(() => {
    if (finished) return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [finished])

  const inhale = elapsed % CYCLE_MS < INHALE_MS
  const remaining = Math.max(0, Math.ceil((total - elapsed) / 1000))

  if (finished) {
    return (
      <div className="mx-auto max-w-md space-y-6 pt-6">
        <h1 className="font-serif text-3xl text-ink">{t('Well done for pausing.')}</h1>
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault()
            if (urgeId && rating !== undefined) {
              try {
                await repos.urges.setFollowUp(urgeId, rating)
                clearReflectionTimer()
                toast(t('Saved.'))
              } catch {
                toast(t('Something went wrong. Please try again.'))
              }
            }
            navigate(urgeId ? '/urges' : '/')
          }}
        >
          <RatingScale label={t('How strong is the urge now?')} max={URGE_MAX} value={rating} onChange={setRating} lowHint={t('Barely there')} highHint={t('Very strong')} />
          <div className="flex flex-col gap-2">
            <button type="submit" className="btn-primary">
              {urgeId && rating !== undefined ? t('Save and finish') : t('Finish')}
            </button>
            {!urgeId && (
              <Link to="/urges/new" className="btn-secondary">
                {t('Log an urge')}
              </Link>
            )}
            <Link to="/unsent/new" className="btn-ghost">
              {t('Write it down instead')}
            </Link>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
      <h1 className="sr-only">{t('Take a pause')}</h1>
      <div className="relative flex size-64 items-center justify-center" aria-hidden="true">
        <div className="breathing-circle absolute inset-0 rounded-full bg-accent-soft" />
        <div className="breathing-circle absolute inset-8 rounded-full border border-accent/40" />
      </div>
      <p className="mt-8 font-serif text-2xl text-ink" aria-live="polite">
        {inhale ? t('Breathe in…') : t('Breathe out…')}
      </p>
      <p className="mt-2 text-sm text-muted tabular-nums" aria-live="off">
        {t('{seconds} seconds', { seconds: remaining })}
      </p>
      <button type="button" className="btn-ghost mt-10" onClick={() => setNow(startedAt + total)}>
        {t('Finish early')}
      </button>
    </div>
  )
}
