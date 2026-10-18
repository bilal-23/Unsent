import type { UnsentDatabase } from '../db/database'
import { guard, StorageError } from '../db/errors'
import { nowIso } from '../domain/dates'
import { newId } from '../domain/ids'
import type { UrgeEntry } from '../domain/types'

export interface UrgeInput {
  intensity: number
  trigger?: string
  emotion?: string
  note?: string
}

const clean = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function createUrgesRepo(db: UnsentDatabase) {
  const update = (id: string, change: (current: UrgeEntry) => Partial<UrgeEntry>) =>
    guard(() =>
      db.transaction('rw', db.urges, async () => {
        const current = await db.urges.get(id)
        if (!current) throw new StorageError('notFound')
        const next: UrgeEntry = { ...current, ...change(current), updatedAt: nowIso() }
        await db.urges.put(next)
        return next
      }),
    )

  return {
    list: () => guard(() => db.urges.orderBy('createdAt').reverse().toArray()),

    get: (id: string) => guard(() => db.urges.get(id)),

    create: (input: UrgeInput) =>
      guard(async () => {
        const now = nowIso()
        const entry: UrgeEntry = {
          id: newId(),
          intensity: input.intensity,
          trigger: clean(input.trigger),
          emotion: clean(input.emotion),
          note: clean(input.note),
          createdAt: now,
          updatedAt: now,
        }
        await db.urges.add(entry)
        return entry
      }),

    update: (id: string, input: UrgeInput) =>
      update(id, () => ({
        intensity: input.intensity,
        trigger: clean(input.trigger),
        emotion: clean(input.emotion),
        note: clean(input.note),
      })),

    setFollowUp: (id: string, followUpIntensity: number | undefined) =>
      update(id, () => ({
        followUpIntensity,
        followUpAt: followUpIntensity === undefined ? undefined : nowIso(),
      })),

    delete: (id: string) => guard(() => db.urges.delete(id)),
  }
}

export type UrgesRepo = ReturnType<typeof createUrgesRepo>
