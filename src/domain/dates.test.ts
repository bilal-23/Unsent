import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addDays,
  daysBetween,
  intentionStatus,
  isValidLocalDate,
  localDateOf,
  msUntilNextLocalMidnight,
  noContactStatus,
  startOfWeek,
  toLocalDate,
} from './dates'

afterEach(() => vi.useRealTimers())

describe('timezone used by these tests', () => {
  it('runs in a zone with daylight saving time', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/New_York')
  })
})

describe('daysBetween', () => {
  it('counts calendar days (PRD example: Oct 15 → Oct 18 = 3)', () => {
    expect(daysBetween('2026-10-15', '2026-10-18')).toBe(3)
  })

  it('is zero on the same day', () => {
    expect(daysBetween('2026-10-18', '2026-10-18')).toBe(0)
  })

  it('is negative for a future date', () => {
    expect(daysBetween('2026-10-20', '2026-10-18')).toBe(-2)
  })

  it('ignores the spring-forward DST transition (Mar 8, 2026)', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
  })

  it('ignores the fall-back DST transition (Nov 1, 2026)', () => {
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })

  it('handles leap years and long spans', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365)
  })
})

describe('isValidLocalDate', () => {
  it('accepts real dates', () => {
    expect(isValidLocalDate('2026-10-18')).toBe(true)
    expect(isValidLocalDate('2028-02-29')).toBe(true)
  })

  it('rejects impossible or malformed dates', () => {
    for (const bad of ['2026-02-30', '2027-02-29', '2026-13-01', '2026-1-1', '18/10/2026', '', '1899-12-31', null, 20261018]) {
      expect(isValidLocalDate(bad)).toBe(false)
    }
  })
})

describe('toLocalDate / localDateOf', () => {
  it('uses the local calendar date, not UTC', () => {
    // 23:30 in New York on Oct 18 is already Oct 19 in UTC.
    const lateEvening = new Date(2026, 9, 18, 23, 30)
    expect(lateEvening.toISOString().slice(0, 10)).toBe('2026-10-19')
    expect(toLocalDate(lateEvening)).toBe('2026-10-18')
    expect(localDateOf(lateEvening.toISOString())).toBe('2026-10-18')
  })
})

describe('addDays and startOfWeek', () => {
  it('moves across month, year and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('finds the Monday of the week', () => {
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12') // Sunday → previous Monday
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12')
    expect(startOfWeek('2026-10-14')).toBe('2026-10-12')
  })
})

describe('noContactStatus', () => {
  it('reports days for a past date', () => {
    expect(noContactStatus('2026-10-15', '2026-10-18')).toEqual({ kind: 'ok', date: '2026-10-15', days: 3 })
  })

  it('reports zero days for today', () => {
    expect(noContactStatus('2026-10-18', '2026-10-18')).toMatchObject({ kind: 'ok', days: 0 })
  })

  it('never yields a negative count for a future date', () => {
    expect(noContactStatus('2026-10-19', '2026-10-18')).toEqual({ kind: 'future', date: '2026-10-19' })
  })

  it('treats missing or invalid dates as unset', () => {
    expect(noContactStatus(undefined, '2026-10-18')).toEqual({ kind: 'unset' })
    expect(noContactStatus('not-a-date', '2026-10-18')).toEqual({ kind: 'unset' })
  })
})

describe('intentionStatus', () => {
  const ok = (days: number) => noContactStatus(addDays('2026-10-18', -days), '2026-10-18')

  it('has no failure state — only none, in progress or reached', () => {
    expect(intentionStatus(undefined, ok(3))).toEqual({ kind: 'none' })
    expect(intentionStatus(30, ok(3))).toEqual({ kind: 'inProgress', day: 3, of: 30 })
    expect(intentionStatus(30, ok(30))).toEqual({ kind: 'reached', of: 30 })
    expect(intentionStatus(7, ok(45))).toEqual({ kind: 'reached', of: 7 })
  })

  it('starts again quietly after the date changes', () => {
    expect(intentionStatus(30, ok(0))).toEqual({ kind: 'inProgress', day: 0, of: 30 })
  })
})

describe('midnight rollover', () => {
  it('schedules the next check for local midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 18, 23, 59, 0))
    expect(msUntilNextLocalMidnight()).toBe(60_000)
    vi.setSystemTime(new Date(2026, 9, 19, 0, 0, 30))
    expect(toLocalDate()).toBe('2026-10-19')
  })

  it('handles the 25-hour fall-back day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 1, 0, 0, 0))
    expect(msUntilNextLocalMidnight()).toBe(25 * 60 * 60 * 1000)
  })
})
