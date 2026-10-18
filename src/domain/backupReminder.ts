import { daysBetween, localDateOf } from './dates'
import type { LocalDate, Preferences, TrackingSettings } from './types'

export const BACKUP_REMINDER_DAYS = 14

/** True when there is data worth protecting and no backup in the last two weeks (and not snoozed). */
export function needsBackupReminder(prefs: Preferences, settings: TrackingSettings, today: LocalDate, hasAnyData: boolean): boolean {
  if (!hasAnyData) return false
  if (prefs.backupReminderSnoozedUntil && daysBetween(today, prefs.backupReminderSnoozedUntil) > 0) return false
  const since = prefs.lastBackupAt ? localDateOf(prefs.lastBackupAt) : localDateOf(settings.createdAt)
  return daysBetween(since, today) >= BACKUP_REMINDER_DAYS
}
