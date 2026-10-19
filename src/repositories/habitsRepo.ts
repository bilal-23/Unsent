import type { UnsentDatabase } from '../db/database'
import { guard, StorageError } from '../db/errors'
import { nowIso } from '../domain/dates'
import { newId } from '../domain/ids'
import type { Habit, LocalDate } from '../domain/types'
import { moveToTrash } from './trashRepo'

const byPosition = (a: Habit, b: Habit) => a.position - b.position || a.createdAt.localeCompare(b.createdAt)
const clampTarget = (n: number) => Math.min(7, Math.max(1, Math.round(n)))

export function createHabitsRepo(db: UnsentDatabase) {
  const ordered = async () => (await db.habits.toArray()).sort(byPosition)

  return {
    list: () => guard(ordered),

    listLogs: () => guard(() => db.habitLogs.toArray()),

    add: (input: { name: string; targetPerWeek: number }) =>
      guard(() =>
        db.transaction('rw', db.habits, async () => {
          const habits = await ordered()
          const now = nowIso()
          const habit: Habit = {
            id: newId(),
            name: input.name.trim(),
            targetPerWeek: clampTarget(input.targetPerWeek),
            position: habits.length ? habits[habits.length - 1].position + 1 : 0,
            archived: false,
            createdAt: now,
            updatedAt: now,
          }
          await db.habits.add(habit)
          return habit
        }),
      ),

    update: (id: string, change: Partial<Pick<Habit, 'name' | 'targetPerWeek' | 'archived'>>) =>
      guard(() =>
        db.transaction('rw', db.habits, async () => {
          const current = await db.habits.get(id)
          if (!current) throw new StorageError('notFound')
          const next: Habit = {
            ...current,
            ...change,
            name: (change.name ?? current.name).trim(),
            targetPerWeek: clampTarget(change.targetPerWeek ?? current.targetPerWeek),
            updatedAt: nowIso(),
          }
          await db.habits.put(next)
          return next
        }),
      ),

    move: (id: string, direction: -1 | 1) =>
      guard(() =>
        db.transaction('rw', db.habits, async () => {
          const habits = (await ordered()).map((habit, position) => ({ ...habit, position }))
          const index = habits.findIndex((habit) => habit.id === id)
          const neighbour = habits[index + direction]
          if (index === -1 || !neighbour) return
          const now = nowIso()
          ;[habits[index].position, neighbour.position] = [neighbour.position, habits[index].position]
          habits[index].updatedAt = now
          neighbour.updatedAt = now
          await db.habits.bulkPut(habits)
        }),
      ),

    /** Ticks or un-ticks a day. Returns whether the day is now done. */
    toggle: (habitId: string, localDate: LocalDate) =>
      guard(() =>
        db.transaction('rw', db.habits, db.habitLogs, async () => {
          if (!(await db.habits.get(habitId))) throw new StorageError('notFound')
          const existing = await db.habitLogs.where('[habitId+localDate]').equals([habitId, localDate]).first()
          if (existing) {
            await db.habitLogs.delete(existing.id)
            return false
          }
          await db.habitLogs.add({ id: newId(), habitId, localDate, createdAt: nowIso() })
          return true
        }),
      ),

    /** Moves a habit to "Recently deleted". Its check-offs stay, so restoring brings its history back. */
    delete: (id: string) => moveToTrash(db, 'habits', id),

    /** Removes check-offs whose habit no longer exists anywhere (not even in Recently deleted). */
    removeOrphanLogs: () =>
      guard(() =>
        db.transaction('rw', db.habits, db.habitLogs, db.trash, async () => {
          const live = new Set(await db.habits.toCollection().primaryKeys())
          const trashed = new Set((await db.trash.where('table').equals('habits').toArray()).map((entry) => entry.recordId))
          const orphans = (await db.habitLogs.toArray()).filter((log) => !live.has(log.habitId) && !trashed.has(log.habitId)).map((log) => log.id)
          if (orphans.length) await db.habitLogs.bulkDelete(orphans)
          return orphans.length
        }),
      ),
  }
}

export type HabitsRepo = ReturnType<typeof createHabitsRepo>
