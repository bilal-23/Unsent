import type { IsoTimestamp, LocalDate } from './types'

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

const pad = (n: number) => String(n).padStart(2, '0')

function parseParts(date: string): [number, number, number] | null {
  const match = LOCAL_DATE_RE.exec(date)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** True for a real calendar date in `YYYY-MM-DD` form (rejects 2026-02-30, year < 1900). */
export function isValidLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false
  const parts = parseParts(value)
  if (!parts) return false
  const [y, m, d] = parts
  if (y < 1900 || m < 1 || m > 12 || d < 1) return false
  const probe = new Date(Date.UTC(y, m - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
}

/**
 * Integer day index for a calendar date. Uses UTC purely as a fixed calendar so
 * daylight-saving and timezone offsets can never shift the result.
 */
export function dayNumber(date: LocalDate): number {
  const parts = parseParts(date)
  if (!parts) throw new RangeError(`Invalid local date: ${date}`)
  const [y, m, d] = parts
  return Date.UTC(y, m - 1, d) / MS_PER_DAY
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return dayNumber(to) - dayNumber(from)
}

/** The local calendar date of an instant, using the device's current timezone. */
export function toLocalDate(instant: Date = new Date()): LocalDate {
  return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`
}

/** Local calendar date on which an ISO timestamp fell. */
export function localDateOf(timestamp: IsoTimestamp): LocalDate {
  return toLocalDate(new Date(timestamp))
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const shifted = new Date((dayNumber(date) + days) * MS_PER_DAY)
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: LocalDate): LocalDate {
  const n = dayNumber(date)
  // 1970-01-01 (day 0) was a Thursday; shift so Monday = 0.
  const weekday = (((n + 3) % 7) + 7) % 7
  return addDays(date, -weekday)
}

/** A Date at local noon on the given calendar date, safe for Intl formatting. */
function toDisplayDate(date: LocalDate): Date {
  const [y, m, d] = parseParts(date) ?? [1970, 1, 1]
  return new Date(y, m - 1, d, 12)
}

export function formatLocalDate(date: LocalDate, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  if (!isValidLocalDate(date)) return date
  return new Intl.DateTimeFormat(undefined, options).format(toDisplayDate(date))
}

export function formatTimestamp(
  timestamp: IsoTimestamp,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, options).format(date)
}

export function nowIso(): IsoTimestamp {
  return new Date().toISOString()
}

export function currentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
  return Math.max(1000, next.getTime() - now.getTime())
}

export type NoContactStatus =
  | { kind: 'unset' }
  | { kind: 'future'; date: LocalDate }
  | { kind: 'ok'; date: LocalDate; days: number }

/** Interprets a stored last-contact date against today. Never yields a negative count. */
export function noContactStatus(lastContactDate: string | undefined | null, today: LocalDate): NoContactStatus {
  if (!lastContactDate || !isValidLocalDate(lastContactDate)) return { kind: 'unset' }
  const days = daysBetween(lastContactDate, today)
  if (days < 0) return { kind: 'future', date: lastContactDate }
  return { kind: 'ok', date: lastContactDate, days }
}

export type IntentionStatus = { kind: 'none' } | { kind: 'inProgress'; day: number; of: number } | { kind: 'reached'; of: number }

/** Neutral progress towards an optional intention. There is no "failed" state by design. */
export function intentionStatus(intentionDays: number | undefined, status: NoContactStatus): IntentionStatus {
  if (!intentionDays || status.kind !== 'ok') return { kind: 'none' }
  if (status.days >= intentionDays) return { kind: 'reached', of: intentionDays }
  return { kind: 'inProgress', day: status.days, of: intentionDays }
}
