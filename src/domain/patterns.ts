import { addDays, daysBetween, localDateOf, startOfWeek } from './dates'
import type { DailyCheckIn, LocalDate, TrackingHistory, UnsentMessage, UrgeEntry } from './types'

export type PatternPeriod = '7' | '30' | '90' | 'all'

export const PERIOD_LABELS: Record<PatternPeriod, string> = {
  '7': '7 days',
  '30': '30 days',
  '90': '90 days',
  all: 'All time',
}

/** Weekly charts never show more than this many weeks, even for "all time". */
export const MAX_WEEKS = 52

export interface WeekBucket {
  weekStart: LocalDate
  count: number
  averageIntensity: number | null
}

export interface TriggerCount {
  trigger: string
  count: number
}

export interface MoodPoint {
  date: LocalDate
  mood: number
}

export interface PatternSummary {
  start: LocalDate
  end: LocalDate
  urgeCount: number
  averageIntensity: number | null
  weeks: WeekBucket[]
  triggers: TriggerCount[]
  urgesWithoutTrigger: number
  followUp: { count: number; averageBefore: number; averageAfter: number } | null
  moods: MoodPoint[]
  checkInCount: number
  messagesWritten: number
  trackingChanges: TrackingHistory[]
  isEmpty: boolean
}

export interface PatternInput {
  urges: readonly UrgeEntry[]
  checkIns: readonly DailyCheckIn[]
  messages: readonly Pick<UnsentMessage, 'createdAt'>[]
  trackingHistory: readonly TrackingHistory[]
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)

function earliestDate(input: PatternInput, today: LocalDate): LocalDate {
  let earliest = today
  const consider = (date: LocalDate) => {
    if (daysBetween(date, earliest) > 0) earliest = date
  }
  input.urges.forEach((u) => consider(localDateOf(u.createdAt)))
  input.checkIns.forEach((c) => consider(c.localDate))
  input.messages.forEach((m) => consider(localDateOf(m.createdAt)))
  return earliest
}

export function periodStart(period: PatternPeriod, today: LocalDate, input: PatternInput): LocalDate {
  if (period === 'all') return earliestDate(input, today)
  return addDays(today, -(Number(period) - 1))
}

const inRange = (date: LocalDate, start: LocalDate, end: LocalDate) =>
  daysBetween(start, date) >= 0 && daysBetween(date, end) >= 0

export function summarizePatterns(input: PatternInput, period: PatternPeriod, today: LocalDate): PatternSummary {
  const start = periodStart(period, today, input)
  const end = today

  const urges = input.urges.filter((u) => inRange(localDateOf(u.createdAt), start, end))
  const checkIns = input.checkIns.filter((c) => inRange(c.localDate, start, end))
  const messagesWritten = input.messages.filter((m) => inRange(localDateOf(m.createdAt), start, end)).length

  // Weekly buckets, Monday-based, contiguous so quiet weeks show as zero.
  const weekMap = new Map<LocalDate, number[]>()
  const firstWeek = startOfWeek(start)
  for (let week = firstWeek; daysBetween(week, end) >= 0; week = addDays(week, 7)) {
    weekMap.set(week, [])
  }
  for (const urge of urges) {
    weekMap.get(startOfWeek(localDateOf(urge.createdAt)))?.push(urge.intensity)
  }
  const weeks = [...weekMap.entries()]
    .map(([weekStart, values]) => ({ weekStart, count: values.length, averageIntensity: mean(values) }))
    .slice(-MAX_WEEKS)

  const triggerCounts = new Map<string, number>()
  let urgesWithoutTrigger = 0
  for (const urge of urges) {
    const trigger = urge.trigger?.trim()
    if (!trigger) {
      urgesWithoutTrigger++
      continue
    }
    triggerCounts.set(trigger, (triggerCounts.get(trigger) ?? 0) + 1)
  }
  const triggers = [...triggerCounts.entries()]
    .map(([trigger, count]) => ({ trigger, count }))
    .sort((a, b) => b.count - a.count || a.trigger.localeCompare(b.trigger))

  const followed = urges.filter((u) => typeof u.followUpIntensity === 'number')
  const followUp = followed.length
    ? {
        count: followed.length,
        averageBefore: mean(followed.map((u) => u.intensity))!,
        averageAfter: mean(followed.map((u) => u.followUpIntensity!))!,
      }
    : null

  const moods = checkIns
    .map((c) => ({ date: c.localDate, mood: c.mood }))
    .sort((a, b) => daysBetween(b.date, a.date))

  const trackingChanges = [...input.trackingHistory].sort((a, b) => b.changedAt.localeCompare(a.changedAt))

  return {
    start,
    end,
    urgeCount: urges.length,
    averageIntensity: mean(urges.map((u) => u.intensity)),
    weeks,
    triggers,
    urgesWithoutTrigger,
    followUp,
    moods,
    checkInCount: checkIns.length,
    messagesWritten,
    trackingChanges,
    isEmpty: urges.length === 0 && checkIns.length === 0 && messagesWritten === 0 && trackingChanges.length === 0,
  }
}
