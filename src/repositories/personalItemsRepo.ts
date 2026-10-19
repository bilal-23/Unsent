import type { UnsentDatabase } from '../db/database'
import { moveToTrash } from './trashRepo'
import { guard, StorageError } from '../db/errors'
import { nowIso } from '../domain/dates'
import { newId } from '../domain/ids'
import type { PersonalItem, PersonalItemKind } from '../domain/types'

const byPosition = (a: PersonalItem, b: PersonalItem) => a.position - b.position || a.createdAt.localeCompare(b.createdAt)

export function createPersonalItemsRepo(db: UnsentDatabase) {
  const listKind = async (kind: PersonalItemKind) => (await db.personalItems.where('kind').equals(kind).toArray()).sort(byPosition)

  return {
    list: (kind: PersonalItemKind) => guard(() => listKind(kind)),

    add: (kind: PersonalItemKind, text: string) =>
      guard(() =>
        db.transaction('rw', db.personalItems, async () => {
          const items = await listKind(kind)
          const now = nowIso()
          const item: PersonalItem = {
            id: newId(),
            kind,
            text: text.trim(),
            position: items.length ? items[items.length - 1].position + 1 : 0,
            createdAt: now,
            updatedAt: now,
          }
          await db.personalItems.add(item)
          return item
        }),
      ),

    update: (id: string, text: string) =>
      guard(() =>
        db.transaction('rw', db.personalItems, async () => {
          const current = await db.personalItems.get(id)
          if (!current) throw new StorageError('notFound')
          await db.personalItems.put({ ...current, text: text.trim(), updatedAt: nowIso() })
        }),
      ),

    /** Swaps an item with its neighbour. */
    move: (id: string, direction: -1 | 1) =>
      guard(() =>
        db.transaction('rw', db.personalItems, async () => {
          const current = await db.personalItems.get(id)
          if (!current) return
          const items = await listKind(current.kind)
          const index = items.findIndex((item) => item.id === id)
          const target = items[index + direction]
          if (!target) return
          const now = nowIso()
          const reordered = items.map((item, position) => ({ ...item, position }))
          reordered[index] = { ...reordered[index], position: index + direction, updatedAt: now }
          reordered[index + direction] = { ...reordered[index + direction], position: index, updatedAt: now }
          await db.personalItems.bulkPut(reordered)
        }),
      ),

    /** Moves to "Recently deleted"; returns the trash entry id for Undo. */
    delete: (id: string) => moveToTrash(db, 'personalItems', id),
  }
}

export type PersonalItemsRepo = ReturnType<typeof createPersonalItemsRepo>
