/**
 * Builds an iCalendar (.ics) file for a recurring reminder. The phone's own calendar
 * shows the notification — no server, no push, and Unsent need not be open.
 *
 * Times are "floating" (no time zone): 21:00 stays 21:00 wherever the phone is.
 */
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'
export const WEEKDAYS: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

export interface ReminderSpec {
  title: string
  /** `HH:mm` local time. */
  time: string
  /** Empty or all seven = every day. */
  days: Weekday[]
  /** Optional link that opens the app. */
  url?: string
  note?: string
  /** First day it may occur (defaults to today). */
  from?: Date
  uid?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** RFC 5545 text escaping. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Folds lines longer than 75 octets (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const charSize = new TextEncoder().encode(char).length
    if (size + charSize > (parts.length ? 74 : 75)) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += char
    size += charSize
  }
  parts.push(current)
  return parts.join('\r\n ')
}

function weekdayCode(date: Date): Weekday {
  return WEEKDAYS[(date.getDay() + 6) % 7]
}

/** The first date on/after `from` whose weekday is in `days` (local time). */
export function firstOccurrence(from: Date, days: readonly Weekday[]): Date {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  if (!days.length || days.length === 7) return date
  for (let i = 0; i < 7; i++) {
    if (days.includes(weekdayCode(date))) return date
    date.setDate(date.getDate() + 1)
  }
  return date
}

export function buildIcs(spec: ReminderSpec, now: Date = new Date()): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(spec.time)
  if (!match) throw new Error('Time must be HH:mm')
  const everyDay = !spec.days.length || spec.days.length === 7
  const start = firstOccurrence(spec.from ?? now, spec.days)
  const dtStart = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}T${match[1]}${match[2]}00`
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const ordered = WEEKDAYS.filter((day) => spec.days.includes(day))
  const rule = everyDay ? 'FREQ=DAILY' : `FREQ=WEEKLY;BYDAY=${ordered.join(',')}`
  const description = [spec.note, spec.url].filter(Boolean).join('\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Unsent//Reminders//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${spec.uid ?? crypto.randomUUID()}@unsent.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,
    'DURATION:PT5M',
    `RRULE:${rule}`,
    `SUMMARY:${escapeText(spec.title)}`,
    ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
    ...(spec.url ? [`URL:${spec.url}`] : []),
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(spec.title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
