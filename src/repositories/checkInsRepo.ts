import { Dexie } from 'dexie'
import type { UnsentDatabase } from '../db/database'
import { guard } from '../db/errors'
import { nowIso } from '../domain/dates'
import { newId } from '../domain/ids'
import type { DailyCheckIn, LocalDate } from '../domain/types'

export interface CheckInInput {
  mood: number
  energy?: number
  reflection?: string
  personalWin?: string
}

const clean = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function createCheckInsRepo(db: UnsentDatabase) {
  const upsert = (localDate: LocalDate, input: CheckInInput) =>
    db.transaction('rw', db.checkIns, async () => {
      const now = nowIso()
      const existing = await db.checkIns.where('localDate').equals(localDate).first()
      const fields = {
        mood: input.mood,
        energy: input.energy,
        reflection: clean(input.reflection),
        personalWin: clean(input.personalWin),
      }
      const next: DailyCheckIn = existing
        ? { ...existing, ...fields, updatedAt: now }
        : { id: newId(), localDate, ...fields, createdAt: now, updatedAt: now }
      await db.checkIns.put(next)
      return next
    })

  return {
    list: () => guard(() => db.checkIns.orderBy('localDate').reverse().toArray()),

    getByDate: (localDate: LocalDate) => guard(() => db.checkIns.where('localDate').equals(localDate).first()),

    /**
     * One check-in per local date: edits the existing one if present. The unique
     * index also guards against two tabs racing; on that collision we retry as an edit.
     */
    saveForDate: (localDate: LocalDate, input: CheckInInput) =>
      guard(async () => {
        try {
          return await upsert(localDate, input)
        } catch (error) {
          if ((error as { name?: string })?.name === Dexie.errnames.Constraint) return upsert(localDate, input)
          throw error
        }
      }),

    delete: (id: string) => guard(() => db.checkIns.delete(id)),
  }
}

export type CheckInsRepo = ReturnType<typeof createCheckInsRepo>
