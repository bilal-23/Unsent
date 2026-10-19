import type { UnsentDatabase } from '../db/database'
import { moveToTrash } from './trashRepo'
import { guard, StorageError } from '../db/errors'
import { nowIso } from '../domain/dates'
import { newId } from '../domain/ids'
import type { ExerciseEntry, ExerciseKind, LocalDate, Tracker, VoiceNote } from '../domain/types'

export function createTrackersRepo(db: UnsentDatabase) {
  const update = (id: string, change: Partial<Tracker>) =>
    guard(() =>
      db.transaction('rw', db.trackers, async () => {
        const current = await db.trackers.get(id)
        if (!current) throw new StorageError('notFound')
        const next: Tracker = { ...current, ...change, updatedAt: nowIso() }
        await db.trackers.put(next)
        return next
      }),
    )

  return {
    list: () => guard(() => db.trackers.orderBy('createdAt').toArray()),

    add: (input: { name: string; startDate: LocalDate; intentionDays?: number }) =>
      guard(async () => {
        const now = nowIso()
        const tracker: Tracker = {
          id: newId(),
          name: input.name.trim(),
          startDate: input.startDate,
          intentionDays: input.intentionDays,
          archived: false,
          createdAt: now,
          updatedAt: now,
        }
        await db.trackers.add(tracker)
        return tracker
      }),

    update: (id: string, change: Partial<Pick<Tracker, 'name' | 'startDate' | 'intentionDays' | 'archived'>>) => update(id, change),

    /** Moves to "Recently deleted"; returns the trash entry id for Undo. */
    delete: (id: string) => moveToTrash(db, 'trackers', id),
  }
}

export function createExercisesRepo(db: UnsentDatabase) {
  return {
    list: () => guard(() => db.exerciseEntries.orderBy('createdAt').reverse().toArray()),

    listProgram: (programId: string) =>
      guard(async () => (await db.exerciseEntries.where('kind').equals('program-day').toArray()).filter((e) => e.programId === programId)),

    get: (id: string) => guard(() => db.exerciseEntries.get(id)),

    /** Saves a standalone exercise (new when `id` is undefined). */
    save: (input: { id?: string; kind: ExerciseKind; fields: Record<string, string> }) =>
      guard(() =>
        db.transaction('rw', db.exerciseEntries, async () => {
          const now = nowIso()
          const existing = input.id ? await db.exerciseEntries.get(input.id) : undefined
          const entry: ExerciseEntry = existing
            ? { ...existing, fields: input.fields, updatedAt: now }
            : { id: input.id ?? newId(), kind: input.kind, fields: input.fields, createdAt: now, updatedAt: now }
          await db.exerciseEntries.put(entry)
          return entry
        }),
      ),

    /** One entry per program day: completing a day again edits it. */
    saveProgramDay: (programId: string, day: number, fields: Record<string, string>) =>
      guard(() =>
        db.transaction('rw', db.exerciseEntries, async () => {
          const now = nowIso()
          const existing = await db.exerciseEntries.where('[programId+day]').equals([programId, day]).first()
          const entry: ExerciseEntry = existing
            ? { ...existing, fields, updatedAt: now }
            : { id: newId(), kind: 'program-day', programId, day, fields, createdAt: now, updatedAt: now }
          await db.exerciseEntries.put(entry)
          return entry
        }),
      ),

    /** Moves to "Recently deleted"; returns the trash entry id for Undo. */
    delete: (id: string) => moveToTrash(db, 'exerciseEntries', id),
  }
}

export function createVoiceNotesRepo(db: UnsentDatabase) {
  return {
    list: () => guard(() => db.voiceNotes.orderBy('createdAt').reverse().toArray()),

    get: (id: string) => guard(() => db.voiceNotes.get(id)),

    /** Reads the recording outside the transaction (Blob reads are not IndexedDB work). */
    add: async (input: { title: string; blob: Blob; durationMs: number }) => {
      const data = new Uint8Array(await input.blob.arrayBuffer())
      return guard(async () => {
        const now = nowIso()
        const note: VoiceNote = {
          id: newId(),
          title: input.title.trim(),
          mimeType: input.blob.type || 'audio/webm',
          durationMs: Math.round(input.durationMs),
          data,
          createdAt: now,
          updatedAt: now,
        }
        await db.voiceNotes.add(note)
        return note
      })
    },

    rename: (id: string, title: string) =>
      guard(() =>
        db.transaction('rw', db.voiceNotes, async () => {
          const current = await db.voiceNotes.get(id)
          if (!current) throw new StorageError('notFound')
          await db.voiceNotes.put({ ...current, title: title.trim(), updatedAt: nowIso() })
        }),
      ),

    /** Moves to "Recently deleted"; returns the trash entry id for Undo. */
    delete: (id: string) => moveToTrash(db, 'voiceNotes', id),
  }
}

export type TrackersRepo = ReturnType<typeof createTrackersRepo>
export type ExercisesRepo = ReturnType<typeof createExercisesRepo>
export type VoiceNotesRepo = ReturnType<typeof createVoiceNotesRepo>
