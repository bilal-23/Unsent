import { useEffect } from 'react'
import { useReflectionTimer } from '../../hooks/useReflectionTimer'
import { t } from '../../i18n'
import { showNotification } from '../../services/reminders/notifications'

/**
 * When the urge check-back comes due while Unsent is in the background, show a
 * neutral system notification (if the user turned this on). When the app is visible,
 * the in-app banner handles it instead.
 */
export function CheckBackNotifier({ enabled }: { enabled: boolean }) {
  const { pendingUrgeId, dueAt } = useReflectionTimer()
  useEffect(() => {
    if (!enabled || !pendingUrgeId || !dueAt) return
    const delay = dueAt - Date.now()
    if (delay < -60_000) return
    const timer = setTimeout(() => {
      if (document.visibilityState === 'hidden') {
        void showNotification(t('Unsent'), t('A moment to check in with yourself.'), `#/urges/${pendingUrgeId}?followup=1`)
      }
    }, Math.max(0, delay))
    return () => clearTimeout(timer)
  }, [enabled, pendingUrgeId, dueAt])
  return null
}
