import type { UnsentDatabase } from '../db/database'
import { moveToTrash } from './trashRepo'
import { guard, StorageError } from '../db/errors'
import { nowIso, toLocalDate } from '../domain/dates'
import { newId } from '../domain/ids'
import type { LifeLogEntry, LocalDate, Photo, Plan } from '../domain/types'

const byPosition = (a: Plan, b: Plan) => a.position - b.position || b.createdAt.localeCompare(a.createdAt)

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

  const ordered = async () => (await db.plans.toArray()).sort(byPosition)

  return {
    /** Plans in the user's order. */
    list: () => guard(ordered),

    /** New plans go to the top. */
    add: (text: string) =>
      guard(() =>
        db.transaction('rw', db.plans, async () => {
          const plans = await ordered()
          const now = nowIso()
          const plan: Plan = {
            id: newId(),
            text: text.trim(),
            status: 'open',
            position: plans.length ? plans[0].position - 1 : 0,
            createdAt: now,
            updatedAt: now,
          }
          await db.plans.add(plan)
          return plan
        }),
      ),

    /** Swaps a plan with its neighbour among plans with the same status (open or done). */
    move: (id: string, direction: -1 | 1) =>
      guard(() =>
        db.transaction('rw', db.plans, async () => {
          const current = await db.plans.get(id)
          if (!current) throw new StorageError('notFound')
          const group = (await ordered()).filter((plan) => plan.status === current.status)
          const index = group.findIndex((plan) => plan.id === id)
          const neighbour = group[index + direction]
          if (!neighbour) return
          const now = nowIso()
          // Renumber the whole list so positions stay distinct, then swap the pair.
          const all = await ordered()
          const renumbered = all.map((plan, position) => ({ ...plan, position }))
          const a = renumbered.find((plan) => plan.id === current.id)!
          const b = renumbered.find((plan) => plan.id === neighbour.id)!
          ;[a.position, b.position] = [b.position, a.position]
          a.updatedAt = now
          b.updatedAt = now
          await db.plans.bulkPut(renumbered)
        }),
      ),

    rename: (id: string, text: string) => update(id, () => ({ text: text.trim() })),

    setDone: (id: string, done: boolean) =>
      update(id, () => (done ? { status: 'done', doneAt: nowIso() } : { status: 'open', doneAt: undefined })),

    /** Moves to "Recently deleted"; returns the trash entry id for Undo. */
    delete: (id: string) => moveToTrash(db, 'plans', id),
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

    /** Edits a good thing: its words, its day and its photo (pass `photo: undefined` to remove it). */
    update: (id: string, change: { text: string; localDate: LocalDate; photo: Photo | undefined }) =>
      guard(() =>
        db.transaction('rw', db.lifeLog, async () => {
          const current = await db.lifeLog.get(id)
          if (!current) throw new StorageError('notFound')
          const next: LifeLogEntry = { ...current, text: change.text.trim(), localDate: change.localDate, photo: change.photo, updatedAt: nowIso() }
          await db.lifeLog.put(next)
          return next
        }),
      ),

    setPhoto: (id: string, photo: Photo | undefined) =>
      guard(() =>
        db.transaction('rw', db.lifeLog, async () => {
          const current = await db.lifeLog.get(id)
          if (!current) throw new StorageError('notFound')
          await db.lifeLog.put({ ...current, photo, updatedAt: nowIso() })
        }),
      ),

    /** Moves to "Recently deleted"; returns the trash entry id for Undo. */
    delete: (id: string) => moveToTrash(db, 'lifeLog', id),
  }
}

export type PlansRepo = ReturnType<typeof createPlansRepo>
export type LifeLogRepo = ReturnType<typeof createLifeLogRepo>
