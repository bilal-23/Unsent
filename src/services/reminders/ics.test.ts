import { describe, expect, it } from 'vitest'
import { buildIcs, escapeText, firstOccurrence, foldLine } from './ics'

const unfold = (ics: string) => ics.replace(/\r\n /g, '')

describe('calendar reminders (.ics)', () => {
  const now = new Date(2026, 9, 18, 10, 0) // Sunday 18 Oct 2026, local

  it('repeats daily at a floating local time with an alarm', () => {
    const ics = buildIcs({ title: 'A moment for you', time: '21:00', days: [], uid: 'x' }, now)
    expect(ics).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0')
    expect(ics).toContain('DTSTART:20261018T210000\r\n')
    expect(ics).not.toMatch(/DTSTART[^\r]*Z/)
    expect(ics).toContain('RRULE:FREQ=DAILY')
    expect(ics).toContain('BEGIN:VALARM\r\nACTION:DISPLAY')
    expect(ics).toContain('TRIGGER:PT0M')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('repeats on chosen weekdays, starting on the first matching day', () => {
    const ics = buildIcs({ title: 'Gym', time: '07:15', days: ['FR', 'MO', 'WE'], uid: 'x' }, now)
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR')
    expect(ics).toContain('DTSTART:20261019T071500') // next Monday
    expect(firstOccurrence(now, ['SU'])).toEqual(new Date(2026, 9, 18))
  })

  it('escapes text and keeps the optional link', () => {
    const ics = unfold(buildIcs({ title: 'Read; rest, repeat', time: '20:00', days: [], url: 'https://example.app/#/journal', uid: 'x' }, now))
    expect(ics).toContain('SUMMARY:Read\\; rest\\, repeat')
    expect(ics).toContain('URL:https://example.app/#/journal')
    expect(escapeText('a\\b\nc')).toBe('a\\\\b\\nc')
  })

  it('folds long lines at 75 octets without splitting characters', () => {
    const line = `SUMMARY:${'🌿'.repeat(40)}`
    const folded = foldLine(line)
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    expect(folded.replace(/\r\n /g, '')).toBe(line)
  })

  it('rejects invalid times', () => {
    expect(() => buildIcs({ title: 'x', time: '25:00', days: [] }, now)).toThrow()
  })
})
