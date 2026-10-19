/**
 * System notifications while Unsent is open or in the background (desktop and
 * Android). There is no server, so nothing can arrive once the app is closed — and
 * iPhone pauses web apps in the background. Text is always neutral.
 */
export type NotificationSupport = 'unsupported' | 'default' | 'granted' | 'denied'

export function notificationSupport(): NotificationSupport {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (notificationSupport() === 'unsupported') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return notificationSupport()
  }
}

/** Shows a notification. Opening it takes the user to `path` (a hash route). */
export async function showNotification(title: string, body: string, path = '#/'): Promise<boolean> {
  if (notificationSupport() !== 'granted') return false
  const options: NotificationOptions = { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'unsent', data: { path } }
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.showNotification(title, options)
      return true
    }
    const notification = new Notification(title, options)
    notification.onclick = () => {
      window.focus()
      window.location.hash = path.replace(/^#/, '')
      notification.close()
    }
    return true
  } catch {
    return false
  }
}
