import { Link } from 'react-router'
import { SupportNote } from '../../components/SupportNote'
import type { Preferences } from '../../domain/types'
import { usePersonalItems } from '../../hooks/useData'
import { startReflectionTimer, useReflectionTimer } from '../../hooks/useReflectionTimer'
import { t, tp } from '../../i18n'

/** Shown right after an urge is saved: the user's own reasons and coping ideas, a pause, and an optional check-back. */
export function AfterUrgePanel({ urgeId, preferences, onDone }: { urgeId: string; preferences: Preferences; onDone: () => void }) {
  const reasons = usePersonalItems('reason')
  const coping = usePersonalItems('coping')
  const { pendingUrgeId } = useReflectionTimer()
  const timerStarted = pendingUrgeId === urgeId

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl text-ink">{t('Noted.')}</h1>
        <p className="hint mt-1">{t('Urges rise and fall. You do not have to act on this one.')}</p>
      </div>

      {reasons && reasons.length > 0 && (
        <section className="card" aria-labelledby="reasons-title">
          <h2 id="reasons-title" className="section-title">
            {t('Why you chose this')}
          </h2>
          <ul className="mt-2 space-y-1 font-serif text-lg text-ink">
            {reasons.map((reason) => (
              <li key={reason.id}>· {reason.text}</li>
            ))}
          </ul>
        </section>
      )}

      {coping && coping.length > 0 && (
        <section className="card" aria-labelledby="coping-title">
          <h2 id="coping-title" className="section-title">
            {t('Things that help you')}
          </h2>
          <ul className="mt-2 space-y-1 text-ink">
            {coping.map((item) => (
              <li key={item.id}>· {item.text}</li>
            ))}
          </ul>
        </section>
      )}

      {(!reasons?.length || !coping?.length) && (
        <p className="text-sm text-muted">
          {t('You can add your own reasons and coping ideas in')}{' '}
          <Link to="/settings#lists" className="link">
            {t('Settings')}
          </Link>
          .
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Link to={`/pause?urge=${urgeId}`} className="btn-primary">
          {tp(preferences.pauseSeconds, { one: 'Take a {count}-second pause', other: 'Take a {count}-second pause' })}
        </Link>
        {preferences.reflectionReminderEnabled && !timerStarted && (
          <button type="button" className="btn-secondary" onClick={() => startReflectionTimer(urgeId, preferences.reflectionReminderMinutes)}>
            {tp(preferences.reflectionReminderMinutes, {
              one: 'Check back with me in {count} minute',
              other: 'Check back with me in {count} minutes',
            })}
          </button>
        )}
        {timerStarted && (
          <p className="rounded-xl bg-accent-soft px-3 py-2.5 text-center text-sm" role="status">
            {tp(preferences.reflectionReminderMinutes, {
              one: 'Okay. If Unsent is open in {count} minute, it will ask how you feel.',
              other: 'Okay. If Unsent is open in {count} minutes, it will ask how you feel.',
            })}
          </p>
        )}
        <button type="button" className="btn-ghost" onClick={onDone}>
          {t('Done')}
        </button>
      </div>

      <SupportNote compact />
    </div>
  )
}
