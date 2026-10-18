import type { UnsentDatabase } from '../db/database'
import { guard } from '../db/errors'
import { currentTimezone, nowIso } from '../domain/dates'
import { newId } from '../domain/ids'
import { SINGLETON_ID, type PersonalItem, type TrackingHistory, type TrackingSettings } from '../domain/types'

export interface SetupInput {
  lastContactDate: string
  lastContactTime?: string
  journalName?: string
  note?: string
  intentionDays?: number
  reasons?: string[]
}

export interface DateChangeInput {
  newDate: string
  lastContactTime?: string
  reason?: string
  /** Keep the current intention (counted from the new date). Defaults to true. */
  keepIntention?: boolean
}

const clean = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function createTrackingRepo(db: UnsentDatabase) {
  return {
    get: () => guard(() => db.settings.get(SINGLETON_ID)),

    history: () => guard(() => db.trackingHistory.orderBy('changedAt').reverse().toArray()),

    /** First-run setup: settings, the initial history row and any reasons, atomically. */
    setup: (input: SetupInput) =>
      guard(() =>
        db.transaction('rw', db.settings, db.trackingHistory, db.personalItems, async () => {
          const now = nowIso()
          const settings: TrackingSettings = {
            id: SINGLETON_ID,
            lastContactDate: input.lastContactDate,
            lastContactTime: clean(input.lastContactTime),
            journalName: clean(input.journalName),
            note: clean(input.note),
            intentionDays: input.intentionDays,
            timezone: currentTimezone(),
            createdAt: now,
            updatedAt: now,
          }
          await db.settings.put(settings)
          await db.trackingHistory.add({ id: newId(), previousDate: null, newDate: input.lastContactDate, changedAt: now })
          const reasons = (input.reasons ?? []).map(clean).filter((r): r is string => !!r)
          const items: PersonalItem[] = reasons.map((text, position) => ({
            id: newId(),
            kind: 'reason',
            text,
            position,
            createdAt: now,
            updatedAt: now,
          }))
          if (items.length) await db.personalItems.bulkAdd(items)
          return settings
        }),
      ),

    /** Changes the last-contact date and records the change. Never touches journal entries. */
    changeDate: (input: DateChangeInput) =>
      guard(() =>
        db.transaction('rw', db.settings, db.trackingHistory, async () => {
          const now = nowIso()
          const current = await db.settings.get(SINGLETON_ID)
          const next: TrackingSettings = {
            id: SINGLETON_ID,
            createdAt: current?.createdAt ?? now,
            journalName: current?.journalName,
            note: current?.note,
            intentionDays: input.keepIntention === false ? undefined : current?.intentionDays,
            lastContactDate: input.newDate,
            lastContactTime: clean(input.lastContactTime),
            timezone: currentTimezone(),
            updatedAt: now,
          }
          await db.settings.put(next)
          if (current?.lastContactDate !== input.newDate) {
            const entry: TrackingHistory = {
              id: newId(),
              previousDate: current?.lastContactDate ?? null,
              newDate: input.newDate,
              changedAt: now,
              reason: clean(input.reason),
            }
            await db.trackingHistory.add(entry)
          }
          return next
        }),
      ),

    setIntention: (intentionDays: number | undefined) =>
      guard(() =>
        db.transaction('rw', db.settings, async () => {
          const current = await db.settings.get(SINGLETON_ID)
          if (!current) return undefined
          const next = { ...current, intentionDays, updatedAt: nowIso() }
          await db.settings.put(next)
          return next
        }),
      ),

    updateDetails: (patch: { journalName?: string; note?: string }) =>
      guard(() =>
        db.transaction('rw', db.settings, async () => {
          const current = await db.settings.get(SINGLETON_ID)
          if (!current) return undefined
          const next = { ...current, journalName: clean(patch.journalName), note: clean(patch.note), updatedAt: nowIso() }
          await db.settings.put(next)
          return next
        }),
      ),
  }
}

export type TrackingRepo = ReturnType<typeof createTrackingRepo>
