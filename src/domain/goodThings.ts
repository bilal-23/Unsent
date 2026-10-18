import { daysBetween, localDateOf, startOfWeek } from './dates'
import type { DailyCheckIn, LifeLogEntry, LocalDate, Plan } from './types'

export type GoodThingSource = 'idea' | 'moment' | 'plan' | 'win'

export interface GoodThing {
  key: string
  source: GoodThingSource
  text: string
  date: LocalDate
  /** Id of the underlying record, for deletion where it applies. */
  recordId: string
}

export const GOOD_THING_LABELS: Record<GoodThingSource, string> = {
  idea: 'Idea',
  moment: 'Moment',
  plan: 'Plan done',
  win: 'Win',
}

/** Combines everything good the user recorded into one newest-first timeline. */
export function collectGoodThings(lifeLog: readonly LifeLogEntry[], plans: readonly Plan[], checkIns: readonly DailyCheckIn[]): GoodThing[] {
  const items: GoodThing[] = [
    ...lifeLog.map((entry) => ({
      key: `log-${entry.id}`,
      source: entry.kind,
      text: entry.text,
      date: entry.localDate,
      recordId: entry.id,
    })),
    ...plans
      .filter((plan) => plan.status === 'done' && plan.doneAt)
      .map((plan) => ({
        key: `plan-${plan.id}`,
        source: 'plan' as const,
        text: plan.text,
        date: localDateOf(plan.doneAt!),
        recordId: plan.id,
      })),
    ...checkIns
      .filter((checkIn) => checkIn.personalWin?.trim())
      .map((checkIn) => ({
        key: `win-${checkIn.id}`,
        source: 'win' as const,
        text: checkIn.personalWin!.trim(),
        date: checkIn.localDate,
        recordId: checkIn.id,
      })),
  ]
  return items.sort((a, b) => daysBetween(a.date, b.date) || a.key.localeCompare(b.key))
}

export interface GoodThingWeek {
  weekStart: LocalDate
  items: GoodThing[]
}

export function groupByWeek(items: readonly GoodThing[]): GoodThingWeek[] {
  const weeks = new Map<LocalDate, GoodThing[]>()
  for (const item of items) {
    const week = startOfWeek(item.date)
    const bucket = weeks.get(week)
    if (bucket) bucket.push(item)
    else weeks.set(week, [item])
  }
  return [...weeks.entries()].map(([weekStart, weekItems]) => ({ weekStart, items: weekItems }))
}

/** Idea ids done within the last `days` days, so today's suggestion stays fresh. */
export function recentlyDoneIdeaIds(lifeLog: readonly LifeLogEntry[], today: LocalDate, days = 30): Set<string> {
  const ids = new Set<string>()
  for (const entry of lifeLog) {
    if (entry.kind === 'idea' && entry.ideaId && daysBetween(entry.localDate, today) < days) ids.add(entry.ideaId)
  }
  return ids
}
