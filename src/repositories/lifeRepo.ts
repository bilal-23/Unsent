import type { UnsentDatabase } from '../db/database'
import { guard, StorageError } from '../db/errors'
import { nowIso, toLocalDate } from '../domain/dates'
import { newId } from '../domain/ids'
import type { LifeLogEntry, LocalDate, Photo, Plan } from '../domain/types'

export function createPlansRepo(db: UnsentDatabase) {
  const update = (id: string, change: (current: Plan) => Partial<Plan>) =>
    guard(() =>
      db.transaction('rw', db.plans, async () => {
        const current = await db.plans.get(id)
        if (!current) throw new StorageError('notFound')
        const next: Plan = { ...current, ...change(current), updatedAt: nowIso() }
        await db.plans.put(next)
        return next
      }),
    )

  return {
    list: () => guard(() => db.plans.orderBy('createdAt').reverse().toArray()),

    add: (text: string) =>
      guard(async () => {
        const now = nowIso()
        const plan: Plan = { id: newId(), text: text.trim(), status: 'open', createdAt: now, updatedAt: now }
        await db.plans.add(plan)
        return plan
      }),

    rename: (id: string, text: string) => update(id, () => ({ text: text.trim() })),

    setDone: (id: string, done: boolean) =>
      update(id, () => (done ? { status: 'done', doneAt: nowIso() } : { status: 'open', doneAt: undefined })),

    delete: (id: string) => guard(() => db.plans.delete(id)),
  }
}

export function createLifeLogRepo(db: UnsentDatabase) {
  return {
    list: () => guard(() => db.lifeLog.orderBy('createdAt').reverse().toArray()),

    /** Records a completed idea from the built-in library. */
    logIdea: (ideaId: string, text: string, localDate: LocalDate = toLocalDate()) =>
      guard(async () => {
        const now = nowIso()
        const entry: LifeLogEntry = { id: newId(), kind: 'idea', ideaId, text, localDate, createdAt: now, updatedAt: now }
        await db.lifeLog.add(entry)
        return entry
      }),

    /** A freeform good thing the user wants to remember. */
    addMoment: (text: string, localDate: LocalDate = toLocalDate(), photo?: Photo) =>
      guard(async () => {
        const now = nowIso()
        const entry: LifeLogEntry = { id: newId(), kind: 'moment', text: text.trim(), localDate, photo, createdAt: now, updatedAt: now }
        await db.lifeLog.add(entry)
        return entry
      }),

    setPhoto: (id: string, photo: Photo | undefined) =>
      guard(() =>
        db.transaction('rw', db.lifeLog, async () => {
          const current = await db.lifeLog.get(id)
          if (!current) throw new StorageError('notFound')
          await db.lifeLog.put({ ...current, photo, updatedAt: nowIso() })
        }),
      ),

    delete: (id: string) => guard(() => db.lifeLog.delete(id)),
  }
}

export type PlansRepo = ReturnType<typeof createPlansRepo>
export type LifeLogRepo = ReturnType<typeof createLifeLogRepo>
