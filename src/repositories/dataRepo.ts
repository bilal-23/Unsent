import { userTables, type UnsentDatabase } from '../db/database'
import { guard } from '../db/errors'
import type { BackupData, LocalSnapshot, MergePlan } from '../domain/backup'
import { SINGLETON_ID } from '../domain/types'

export function createDataRepo(db: UnsentDatabase) {
  const readSnapshot = async (): Promise<LocalSnapshot> => {
    const [settings, preferences, trackingHistory, messages, urges, checkIns, personalItems, plans, lifeLog, trackers, exerciseEntries, voiceNotes] =
      await Promise.all([
      db.settings.get(SINGLETON_ID),
      db.preferences.get(SINGLETON_ID),
      db.trackingHistory.toArray(),
      db.messages.toArray(),
      db.urges.toArray(),
      db.checkIns.toArray(),
      db.personalItems.toArray(),
      db.plans.toArray(),
      db.lifeLog.toArray(),
      db.trackers.toArray(),
      db.exerciseEntries.toArray(),
      db.voiceNotes.toArray(),
    ])
    return { settings, preferences, trackingHistory, messages, urges, checkIns, personalItems, plans, lifeLog, trackers, exerciseEntries, voiceNotes }
  }

  return {
    /** A consistent read of every table. */
    snapshot: () => guard(() => db.transaction('r', userTables(db), readSnapshot)),

    /**
     * Merges inside a single read-write transaction. `planner` receives the
     * current local data so the plan is computed against exactly what is stored.
     */
    merge: (planner: (local: LocalSnapshot) => MergePlan) =>
      guard(() =>
        db.transaction('rw', userTables(db), async () => {
          const plan = planner(await readSnapshot())
          const { put } = plan
          if (put.settings) await db.settings.put(put.settings)
          if (put.preferences) await db.preferences.put(put.preferences)
          if (plan.deleteCheckInIds.length) await db.checkIns.bulkDelete(plan.deleteCheckInIds)
          await db.trackingHistory.bulkPut(put.trackingHistory)
          await db.messages.bulkPut(put.messages)
          await db.urges.bulkPut(put.urges)
          await db.checkIns.bulkPut(put.checkIns)
          await db.personalItems.bulkPut(put.personalItems)
          await db.plans.bulkPut(put.plans)
          await db.lifeLog.bulkPut(put.lifeLog)
          await db.trackers.bulkPut(put.trackers)
          await db.exerciseEntries.bulkPut(put.exerciseEntries)
          await db.voiceNotes.bulkPut(put.voiceNotes)
          return plan
        }),
      ),

    /** Replaces all local data atomically: on any failure the original data is untouched. */
    replaceAll: (data: BackupData) =>
      guard(() =>
        db.transaction('rw', userTables(db), async () => {
          await Promise.all(userTables(db).map((table) => table.clear()))
          if (data.settings) await db.settings.add(data.settings)
          if (data.preferences) await db.preferences.add(data.preferences)
          await db.trackingHistory.bulkAdd(data.trackingHistory)
          await db.messages.bulkAdd(data.messages.map((m) => ({ ...m, rev: 0 })))
          await db.urges.bulkAdd(data.urges)
          await db.checkIns.bulkAdd(data.checkIns)
          await db.personalItems.bulkAdd(data.personalItems)
          await db.plans.bulkAdd(data.plans)
          await db.lifeLog.bulkAdd(data.lifeLog)
          await db.trackers.bulkAdd(data.trackers)
          await db.exerciseEntries.bulkAdd(data.exerciseEntries)
          await db.voiceNotes.bulkAdd(data.voiceNotes)
        }),
      ),

    /** Deletes every local record, including the app-lock keyring. */
    clearAll: () =>
      guard(() =>
        db.transaction('rw', [...userTables(db), db.keyring], () =>
          Promise.all([...userTables(db), db.keyring].map((table) => table.clear())),
        ),
      ),
  }
}

export type DataRepo = ReturnType<typeof createDataRepo>
