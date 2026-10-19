import type { Table } from 'dexie'
import type { UnsentDatabase } from '../db/database'
import { guard, StorageError } from '../db/errors'
import { nowIso } from '../domain/dates'
import { newId } from '../domain/ids'
import { TRASH_RETENTION_DAYS, type TrashableTable, type TrashEntry } from '../domain/types'

const DAY_MS = 86_400_000

function sourceTable(db: UnsentDatabase, table: TrashableTable): Table<{ id: string }, string> {
  return db[table] as unknown as Table<{ id: string }, string>
}

/**
 * Moves a record into "Recently deleted" in one transaction. Returns the trash entry id
 * (for Undo), or null if the record was already gone.
 */
export function moveToTrash(db: UnsentDatabase, table: TrashableTable, recordId: string): Promise<string | null> {
  const source = sourceTable(db, table)
  return guard(() =>
    db.transaction('rw', source, db.trash, async () => {
      const record = await source.get(recordId)
      if (!record) return null
      const entry = { id: newId(), table, recordId, record, deletedAt: nowIso() } as TrashEntry
      await db.trash.add(entry)
      await source.delete(recordId)
      return entry.id
    }),
  )
}

export function createTrashRepo(db: UnsentDatabase) {
  return {
    list: () => guard(() => db.trash.orderBy('deletedAt').reverse().toArray()),

    count: () => guard(() => db.trash.count()),

    /**
     * Puts a deleted record back. Throws StorageError('conflict') if something now
     * occupies its place (the same id, or another check-in for the same day).
     */
    restore: (trashId: string) =>
      guard(() =>
        db.transaction('rw', [db.trash, db.messages, db.urges, db.checkIns, db.plans, db.lifeLog, db.voiceNotes, db.exerciseEntries, db.trackers, db.personalItems, db.habits], async () => {
          const entry = await db.trash.get(trashId)
          if (!entry) throw new StorageError('notFound')
          const target = sourceTable(db, entry.table)
          const existing = await target.get(entry.recordId)
          if (existing) throw new StorageError('conflict', { current: existing })
          if (entry.table === 'checkIns') {
            const sameDay = await db.checkIns.where('localDate').equals(entry.record.localDate).first()
            if (sameDay) throw new StorageError('conflict', { current: sameDay })
          }
          await target.add(entry.record)
          await db.trash.delete(trashId)
          return entry
        }),
      ),

    /** Deletes one entry for good. */
    remove: (trashId: string) => guard(() => db.trash.delete(trashId)),

    empty: () => guard(() => db.trash.clear()),

    /** Permanently removes entries older than the retention period. Works while locked (no decryption needed). */
    purgeExpired: (now: Date = new Date()) =>
      guard(() =>
        db.trash
          .where('deletedAt')
          .below(new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MS).toISOString())
          .delete(),
      ),
  }
}

export type TrashRepo = ReturnType<typeof createTrashRepo>

/** Whole days left before an entry is removed for good (never negative). */
export function daysUntilPurge(deletedAt: string, now: Date = new Date()): number {
  const left = TRASH_RETENTION_DAYS - (now.getTime() - Date.parse(deletedAt)) / DAY_MS
  return Math.max(0, Math.ceil(left))
}
