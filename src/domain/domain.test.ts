import { describe, expect, it } from 'vitest'
import { planMerge, type BackupData, type LocalSnapshot } from './backup'
import { needsBackupReminder } from './backupReminder'
import { noContactStatus, intentionStatus } from './dates'
import { fadeStage } from './fade'
import { collectGoodThings, groupByWeek, recentlyDoneIdeaIds } from './goodThings'
import { IDEAS, ideaForDay } from './ideas'
import { summarizePatterns } from './patterns'
import { nextPromptIndex, PROMPTS } from './prompts'
import { isReadyToOpen, isSealed } from './sealing'
import { DEFAULT_PREFERENCES, type DailyCheckIn, type LifeLogEntry, type Plan, type TrackingSettings, type UrgeEntry } from './types'

const urge = (id: string, createdAt: string, intensity: number, extra: Partial<UrgeEntry> = {}): UrgeEntry => ({
  id,
  intensity,
  createdAt,
  updatedAt: createdAt,
  ...extra,
})

describe('sealed letters', () => {
  it('stays sealed until the chosen date, then is ready to open', () => {
    const letter = { sealedUntil: '2026-11-01' }
    expect(isSealed(letter, '2026-10-31')).toBe(true)
    expect(isReadyToOpen(letter, '2026-10-31')).toBe(false)
    expect(isSealed(letter, '2026-11-01')).toBe(false)
    expect(isReadyToOpen(letter, '2026-11-01')).toBe(true)
    expect(isReadyToOpen(letter, '2026-12-01')).toBe(true)
  })

  it('is neither sealed nor ready without a valid date', () => {
    expect(isSealed({}, '2026-10-18')).toBe(false)
    expect(isReadyToOpen({ sealedUntil: 'garbage' }, '2026-10-18')).toBe(false)
  })
})

describe('patterns', () => {
  const urges = [
    urge('a', new Date(2026, 9, 6, 10).toISOString(), 8, { trigger: 'Loneliness', followUpIntensity: 4 }),
    urge('b', new Date(2026, 9, 7, 22).toISOString(), 6, { trigger: 'Loneliness' }),
    urge('c', new Date(2026, 9, 14, 9).toISOString(), 4, { trigger: 'Seeing a reminder', followUpIntensity: 2 }),
    urge('d', new Date(2026, 9, 17, 9).toISOString(), 3),
    urge('old', new Date(2026, 7, 1, 9).toISOString(), 9, { trigger: 'Anger or frustration' }),
  ]
  const input = { urges, checkIns: [] as DailyCheckIn[], messages: [], trackingHistory: [] }

  it('buckets urges by Monday-based week, including quiet weeks', () => {
    const summary = summarizePatterns(input, '30', '2026-10-18')
    expect(summary.start).toBe('2026-09-19')
    const counts = Object.fromEntries(summary.weeks.map((w) => [w.weekStart, w.count]))
    expect(counts['2026-10-05']).toBe(2)
    expect(counts['2026-10-12']).toBe(2)
    expect(counts['2026-09-28']).toBe(0)
    expect(summary.urgeCount).toBe(4)
  })

  it('ranks triggers and counts urges without one', () => {
    const summary = summarizePatterns(input, '30', '2026-10-18')
    expect(summary.triggers[0]).toEqual({ trigger: 'Loneliness', count: 2 })
    expect(summary.urgesWithoutTrigger).toBe(1)
  })

  it('averages follow-ups only over urges that have one', () => {
    const summary = summarizePatterns(input, '30', '2026-10-18')
    expect(summary.followUp).toEqual({ count: 2, averageBefore: 6, averageAfter: 3 })
  })

  it('includes everything for "all time" and reports empty periods', () => {
    expect(summarizePatterns(input, 'all', '2026-10-18').urgeCount).toBe(5)
    const empty = summarizePatterns({ ...input, urges: [] }, '7', '2026-10-18')
    expect(empty.isEmpty).toBe(true)
    expect(empty.averageIntensity).toBeNull()
  })

  it('keeps weekly buckets stable across the DST change', () => {
    const dstUrges = [urge('x', new Date(2026, 10, 1, 1, 30).toISOString(), 5), urge('y', new Date(2026, 10, 2, 9).toISOString(), 5)]
    const summary = summarizePatterns({ ...input, urges: dstUrges }, '7', '2026-11-03')
    const counts = Object.fromEntries(summary.weeks.map((w) => [w.weekStart, w.count]))
    expect(counts['2026-10-26']).toBe(1)
    expect(counts['2026-11-02']).toBe(1)
  })
})

describe('good things', () => {
  const lifeLog: LifeLogEntry[] = [
    { id: 'l1', kind: 'idea', ideaId: 'rest-01', text: 'Go to bed earlier', localDate: '2026-10-17', createdAt: 'x', updatedAt: 'x' },
    { id: 'l2', kind: 'moment', text: 'Coffee with Sam', localDate: '2026-10-10', createdAt: 'x', updatedAt: 'x' },
  ]
  const plans: Plan[] = [
    { id: 'p1', text: 'Book a pottery class', status: 'done', doneAt: new Date(2026, 9, 18, 12).toISOString(), createdAt: 'x', updatedAt: 'x' },
    { id: 'p2', text: 'Learn guitar', status: 'open', createdAt: 'x', updatedAt: 'x' },
  ]
  const checkIns: DailyCheckIn[] = [
    { id: 'c1', localDate: '2026-10-16', mood: 3, personalWin: 'Cooked dinner', createdAt: 'x', updatedAt: 'x' },
    { id: 'c2', localDate: '2026-10-15', mood: 2, createdAt: 'x', updatedAt: 'x' },
  ]

  it('combines ideas, moments, finished plans and wins, newest first', () => {
    const items = collectGoodThings(lifeLog, plans, checkIns)
    expect(items.map((i) => i.text)).toEqual(['Book a pottery class', 'Go to bed earlier', 'Cooked dinner', 'Coffee with Sam'])
    expect(groupByWeek(items).map((w) => w.weekStart)).toEqual(['2026-10-12', '2026-10-05'])
  })

  it('remembers recently done ideas so today’s idea stays fresh', () => {
    const recent = recentlyDoneIdeaIds(lifeLog, '2026-10-18')
    expect(recent.has('rest-01')).toBe(true)
    for (let offset = 0; offset < 20; offset++) expect(ideaForDay('2026-10-18', offset, recent).id).not.toBe('rest-01')
  })
})

describe('ideas library', () => {
  it('has stable, unique ids and a deterministic daily pick', () => {
    expect(new Set(IDEAS.map((i) => i.id)).size).toBe(IDEAS.length)
    expect(IDEAS.length).toBeGreaterThanOrEqual(55)
    expect(ideaForDay('2026-10-18', 0).id).toBe(ideaForDay('2026-10-18', 0).id)
    expect(ideaForDay('2026-10-18', 1).id).not.toBe(ideaForDay('2026-10-18', 0).id)
  })
})

describe('prompts', () => {
  it('never repeats the previous prompt', () => {
    for (let i = 0; i < 50; i++) {
      const previous = i % PROMPTS.message.length
      expect(nextPromptIndex('message', previous, () => previous / PROMPTS.message.length)).not.toBe(previous)
    }
  })
})

describe('fade mode', () => {
  const at = (days: number, intention?: number) => {
    const status = noContactStatus(`2026-10-${String(18 - Math.min(days, 17)).padStart(2, '0')}`, '2026-10-18')
    const fixed = days > 17 ? { kind: 'ok' as const, date: '2026-01-01', days } : status
    return fadeStage(fixed, intentionStatus(intention, fixed), true)
  }

  it('moves from the counter to the user’s life over time', () => {
    expect(at(3)).toBe('early')
    expect(at(14)).toBe('settling')
    expect(at(60)).toBe('living')
  })

  it('settles early once an intention is reached', () => {
    expect(at(7, 7)).toBe('settling')
  })

  it('stays put when fade mode is off', () => {
    const status = { kind: 'ok' as const, date: '2026-01-01', days: 200 }
    expect(fadeStage(status, { kind: 'none' }, false)).toBe('early')
  })
})

describe('backup reminder', () => {
  const settings = { createdAt: new Date(2026, 8, 1).toISOString() } as TrackingSettings

  it('appears after two weeks without a backup when there is data', () => {
    expect(needsBackupReminder({ ...DEFAULT_PREFERENCES }, settings, '2026-10-18', true)).toBe(true)
    expect(needsBackupReminder({ ...DEFAULT_PREFERENCES }, settings, '2026-10-18', false)).toBe(false)
    expect(needsBackupReminder({ ...DEFAULT_PREFERENCES, lastBackupAt: new Date(2026, 9, 10).toISOString() }, settings, '2026-10-18', true)).toBe(false)
  })

  it('respects a snooze', () => {
    expect(needsBackupReminder({ ...DEFAULT_PREFERENCES, backupReminderSnoozedUntil: '2026-10-20' }, settings, '2026-10-18', true)).toBe(false)
  })
})

describe('planMerge', () => {
  const empty: LocalSnapshot = {
    settings: undefined,
    preferences: undefined,
    trackingHistory: [],
    messages: [],
    urges: [],
    checkIns: [],
    personalItems: [],
    plans: [],
    lifeLog: [],
    trackers: [],
    exerciseEntries: [],
    voiceNotes: [],
  }
  const incomingBase: BackupData = { ...empty, settings: null, preferences: null }
  const t1 = '2026-10-01T10:00:00.000Z'
  const t2 = '2026-10-02T10:00:00.000Z'

  it('keeps the newer copy of the same record and never duplicates ids', () => {
    const local = { ...empty, urges: [urge('u1', t1, 5), urge('u2', t2, 6)] }
    const incoming = { ...incomingBase, urges: [urge('u1', t1, 9, { updatedAt: t2 }), urge('u2', t1, 1), urge('u3', t1, 3)] }
    const plan = planMerge(local, incoming)
    expect(plan.put.urges.map((u) => [u.id, u.intensity])).toEqual([
      ['u1', 9],
      ['u3', 3],
    ])
    expect(plan.summary.urges).toEqual({ added: 1, updated: 1, unchanged: 1 })
  })

  it('bumps the revision of overwritten messages so open editors notice', () => {
    const local = { ...empty, messages: [{ id: 'm1', title: '', body: 'old', status: 'draft' as const, tags: [], createdAt: t1, updatedAt: t1, rev: 4 }] }
    const incoming = { ...incomingBase, messages: [{ id: 'm1', title: '', body: 'new', status: 'draft' as const, tags: [], createdAt: t1, updatedAt: t2 }] }
    expect(planMerge(local, incoming).put.messages[0]).toMatchObject({ body: 'new', rev: 5 })
  })

  it('resolves check-ins for the same date with different ids', () => {
    const local = { ...empty, checkIns: [{ id: 'c-local', localDate: '2026-10-01', mood: 2, createdAt: t1, updatedAt: t1 }] }
    const newer = { ...incomingBase, checkIns: [{ id: 'c-backup', localDate: '2026-10-01', mood: 5, createdAt: t2, updatedAt: t2 }] }
    const plan = planMerge(local, newer)
    expect(plan.deleteCheckInIds).toEqual(['c-local'])
    expect(plan.put.checkIns.map((c) => c.id)).toEqual(['c-backup'])

    const older = { ...incomingBase, checkIns: [{ id: 'c-backup', localDate: '2026-10-01', mood: 5, createdAt: t1, updatedAt: t1 }] }
    const skip = planMerge({ ...local, checkIns: [{ ...local.checkIns[0], updatedAt: t2 }] }, older)
    expect(skip.deleteCheckInIds).toEqual([])
    expect(skip.put.checkIns).toEqual([])
  })

  it('keeps local preferences and appends tracking history by id', () => {
    const local = { ...empty, preferences: { ...DEFAULT_PREFERENCES, theme: 'dark' as const }, trackingHistory: [{ id: 'h1', previousDate: null, newDate: '2026-10-01', changedAt: t1 }] }
    const incoming = {
      ...incomingBase,
      preferences: { ...DEFAULT_PREFERENCES, theme: 'light' as const },
      trackingHistory: [
        { id: 'h1', previousDate: null, newDate: '2026-10-01', changedAt: t1 },
        { id: 'h2', previousDate: '2026-10-01', newDate: '2026-10-05', changedAt: t2 },
      ],
    }
    const plan = planMerge(local, incoming)
    expect(plan.put.preferences).toBeUndefined()
    expect(plan.put.trackingHistory.map((h) => h.id)).toEqual(['h2'])
  })
})
