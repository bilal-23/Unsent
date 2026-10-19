import { addDays, daysBetween, startOfWeek } from './dates'
import type { Habit, HabitLog, LocalDate } from './types'

/**
 * Habits are measured against a weekly goal ("3 times this week"), never as a streak:
 * a missed day is simply a blank day, and every Monday starts fresh.
 */
export interface WeekDay {
  date: LocalDate
  done: boolean
  isToday: boolean
  isFuture: boolean
}

export interface WeekProgress {
  weekStart: LocalDate
  done: number
  target: number
  met: boolean
  days: WeekDay[]
}

/** Done dates per habit id, for quick lookups. */
export function logsByHabit(logs: readonly HabitLog[]): Map<string, Set<LocalDate>> {
  const map = new Map<string, Set<LocalDate>>()
  for (const log of logs) {
    const set = map.get(log.habitId)
    if (set) set.add(log.localDate)
    else map.set(log.habitId, new Set([log.localDate]))
  }
  return map
}

export function weekProgress(habit: Pick<Habit, 'targetPerWeek'>, doneDates: ReadonlySet<LocalDate>, today: LocalDate, weekOffset = 0): WeekProgress {
  const weekStart = addDays(startOfWeek(today), weekOffset * 7)
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i)
    return { date, done: doneDates.has(date), isToday: date === today, isFuture: daysBetween(today, date) > 0 }
  })
  const done = days.filter((day) => day.done).length
  return { weekStart, done, target: habit.targetPerWeek, met: done >= habit.targetPerWeek, days }
}

/** The last `weeks` weeks, oldest first, ending with the current week. */
export function weekHistory(habit: Pick<Habit, 'targetPerWeek'>, doneDates: ReadonlySet<LocalDate>, today: LocalDate, weeks = 8): WeekProgress[] {
  return Array.from({ length: weeks }, (_, i) => weekProgress(habit, doneDates, today, i - (weeks - 1)))
}

/** Plain-language summary for the current week. No "failed", no "streak". */
export function weekSummaryKind(progress: WeekProgress): 'met' | 'onTrack' | 'fresh' {
  if (progress.met) return 'met'
  return progress.done > 0 ? 'onTrack' : 'fresh'
}
