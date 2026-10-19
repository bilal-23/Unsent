import { describe, expect, it } from 'vitest'
import { planMerge, type BackupData, type LocalSnapshot } from './backup'
import { logsByHabit, weekHistory, weekProgress, weekSummaryKind } from './habits'
import { PROMPTS } from './prompts'
import type { HabitLog } from './types'

const log = (habitId: string, localDate: string, id = `${habitId}-${localDate}`): HabitLog => ({ id, habitId, localDate, createdAt: '2026-10-01T00:00:00.000Z' })

describe('habit weeks', () => {
  const done = new Set(['2026-10-12', '2026-10-14', '2026-10-05'])

  it('is Monday-based and marks today and future days', () => {
    const week = weekProgress({ targetPerWeek: 3 }, done, '2026-10-15') // Thursday
    expect(week.weekStart).toBe('2026-10-12')
    expect(week.days.map((d) => d.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'])
    expect(week.days.find((d) => d.isToday)?.date).toBe('2026-10-15')
    expect(week.days.filter((d) => d.isFuture).length).toBe(3)
    expect(week).toMatchObject({ done: 2, target: 3, met: false })
  })

  it('describes progress without failure states', () => {
    expect(weekSummaryKind(weekProgress({ targetPerWeek: 2 }, done, '2026-10-15'))).toBe('met')
    expect(weekSummaryKind(weekProgress({ targetPerWeek: 3 }, done, '2026-10-15'))).toBe('onTrack')
    expect(weekSummaryKind(weekProgress({ targetPerWeek: 3 }, new Set(), '2026-10-15'))).toBe('fresh')
  })

  it('lists recent weeks oldest first, ending with this week', () => {
    const history = weekHistory({ targetPerWeek: 1 }, done, '2026-10-15', 3)
    expect(history.map((w) => [w.weekStart, w.done])).toEqual([
      ['2026-09-28', 0],
      ['2026-10-05', 1],
      ['2026-10-12', 2],
    ])
  })

  it('groups logs by habit', () => {
    const map = logsByHabit([log('a', '2026-10-01'), log('a', '2026-10-02'), log('b', '2026-10-01')])
    expect([...map.get('a')!]).toEqual(['2026-10-01', '2026-10-02'])
    expect(map.get('b')!.size).toBe(1)
  })
})

describe('merging habit check-offs', () => {
  it('takes the union: one check-off per habit per day', () => {
    const empty = { settings: undefined, preferences: undefined, trackingHistory: [], messages: [], urges: [], checkIns: [], personalItems: [], plans: [], lifeLog: [], trackers: [], exerciseEntries: [], voiceNotes: [], habits: [], habitLogs: [] }
    const local: LocalSnapshot = { ...empty, habitLogs: [log('gym', '2026-10-01', 'l1')] }
    const incoming: BackupData = { ...empty, settings: null, preferences: null, habitLogs: [log('gym', '2026-10-01', 'other-id'), log('gym', '2026-10-02', 'l2'), log('gym', '2026-10-01', 'l1')] }
    const plan = planMerge(local, incoming)
    expect(plan.put.habitLogs.map((l) => l.id)).toEqual(['l2'])
    expect(plan.summary.habitLogs).toEqual({ added: 1, updated: 0, unchanged: 2 })
  })
})

describe('writing prompts', () => {
  it('offers plenty of variety, with no duplicates', () => {
    expect(PROMPTS.message.length).toBeGreaterThanOrEqual(40)
    expect(PROMPTS.checkIn.length).toBeGreaterThanOrEqual(25)
    expect(PROMPTS.urge.length).toBeGreaterThanOrEqual(20)
    for (const list of Object.values(PROMPTS)) expect(new Set(list).size).toBe(list.length)
  })
})
