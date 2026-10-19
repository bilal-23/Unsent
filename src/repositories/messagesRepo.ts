import type { UnsentDatabase } from '../db/database'
import { moveToTrash } from './trashRepo'
import { guard, StorageError } from '../db/errors'
import { nowIso } from '../domain/dates'
import { newId } from '../domain/ids'
import type { LocalDate, MessageStatus, UnsentMessage } from '../domain/types'

export interface MessageDraft {
  title: string
  body: string
  tags: string[]
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of tags) {
    const tag = raw.trim()
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    result.push(tag)
  }
  return result
}

export function createMessagesRepo(db: UnsentDatabase) {
  /** Applies a change to a stored message, bumping `rev` so other tabs notice. */
  const mutate = (id: string, change: (current: UnsentMessage) => Partial<UnsentMessage>) =>
    guard(() =>
      db.transaction('rw', db.messages, async () => {
        const current = await db.messages.get(id)
        if (!current) throw new StorageError('notFound')
        const next: UnsentMessage = { ...current, ...change(current), rev: current.rev + 1, updatedAt: nowIso() }
        await db.messages.put(next)
        return next
      }),
    )

  return {
    list: () => guard(() => db.messages.orderBy('updatedAt').reverse().toArray()),

    get: (id: string) => guard(() => db.messages.get(id)),

    create: (draft: MessageDraft) =>
      guard(async () => {
        const now = nowIso()
        const message: UnsentMessage = {
          id: newId(),
          title: draft.title,
          body: draft.body,
          tags: normalizeTags(draft.tags),
          status: 'draft',
          createdAt: now,
          updatedAt: now,
          rev: 0,
        }
        await db.messages.add(message)
        return message
      }),

    /**
     * Saves editor content only if nobody else changed the record since `baseRev`.
     * Throws StorageError('conflict') carrying the stored record otherwise.
     */
    save: (id: string, draft: MessageDraft, baseRev: number) =>
      guard(() =>
        db.transaction('rw', db.messages, async () => {
          const current = await db.messages.get(id)
          if (!current) throw new StorageError('notFound')
          if (current.rev !== baseRev) throw new StorageError('conflict', { current })
          const next: UnsentMessage = {
            ...current,
            title: draft.title,
            body: draft.body,
            tags: normalizeTags(draft.tags),
            rev: current.rev + 1,
            updatedAt: nowIso(),
          }
          await db.messages.put(next)
          return next
        }),
      ),

    setStatus: (id: string, status: MessageStatus) => mutate(id, () => ({ status })),

    seal: (id: string, until: LocalDate) => mutate(id, () => ({ sealedUntil: until, sealedAt: nowIso() })),

    /** Opens a sealed letter (early or on its date). The seal date is cleared. */
    unseal: (id: string) => mutate(id, () => ({ sealedUntil: undefined })),

    /** Moves to "Recently deleted"; returns the trash entry id for Undo. */
    delete: (id: string) => moveToTrash(db, 'messages', id),

    /** Removes a message only when it has no title and no body (abandoned new draft). */
    deleteIfEmpty: (id: string) =>
      guard(() =>
        db.transaction('rw', db.messages, async () => {
          const current = await db.messages.get(id)
          if (current && !current.title.trim() && !current.body.trim()) {
            await db.messages.delete(id)
            return true
          }
          return false
        }),
      ),
  }
}

export type MessagesRepo = ReturnType<typeof createMessagesRepo>
