import { beforeEach, describe, expect, it } from 'vitest'
import { StorageError } from '../db/errors'
import { makeTestRepos } from '../test/factories'
import type { Repos } from '.'

let repos: Repos

beforeEach(async () => {
  repos = makeTestRepos()
  await repos.connection.open()
  await repos.lock.init()
})

const setup = () => repos.tracking.setup({ lastContactDate: '2026-10-15', journalName: '  ', reasons: ['Peace', '', ' Self-respect '] })

describe('tracking', () => {
  it('records the initial date, history and reasons', async () => {
    const settings = await setup()
    expect(settings.lastContactDate).toBe('2026-10-15')
    expect(settings.journalName).toBeUndefined()
    expect(await repos.tracking.history()).toHaveLength(1)
    expect((await repos.personalItems.list('reason')).map((r) => r.text)).toEqual(['Peace', 'Self-respect'])
  })

  it('changing the date keeps every other record (PRD 5.2)', async () => {
    await setup()
    await repos.messages.create({ title: 'a', body: 'b', tags: [] })
    await repos.urges.create({ intensity: 5 })
    await repos.checkIns.saveForDate('2026-10-16', { mood: 3 })
    await repos.tracking.setIntention(30)

    await repos.tracking.changeDate({ newDate: '2026-10-18', reason: 'Called' })

    expect((await repos.tracking.get())?.lastContactDate).toBe('2026-10-18')
    expect((await repos.tracking.get())?.intentionDays).toBe(30)
    expect(await repos.messages.list()).toHaveLength(1)
    expect(await repos.urges.list()).toHaveLength(1)
    expect(await repos.checkIns.list()).toHaveLength(1)
    const history = await repos.tracking.history()
    expect(history).toHaveLength(2)
    expect(history[0]).toMatchObject({ previousDate: '2026-10-15', newDate: '2026-10-18', reason: 'Called' })
  })

  it('can drop the intention when the date changes', async () => {
    await setup()
    await repos.tracking.setIntention(30)
    await repos.tracking.changeDate({ newDate: '2026-10-18', keepIntention: false })
    expect((await repos.tracking.get())?.intentionDays).toBeUndefined()
  })
})

describe('messages', () => {
  it('creates, edits, archives, restores and deletes', async () => {
    const created = await repos.messages.create({ title: 'T', body: 'Line 1\nLine 2 — 🌿 大丈夫', tags: ['a', ' A ', 'b'] })
    expect(created.tags).toEqual(['a', 'b'])
    const saved = await repos.messages.save(created.id, { title: 'T2', body: created.body, tags: [] }, created.rev)
    expect(saved.rev).toBe(created.rev + 1)
    expect(saved.updatedAt >= created.updatedAt).toBe(true)
    expect((await repos.messages.get(created.id))?.body).toBe('Line 1\nLine 2 — 🌿 大丈夫')

    const archived = await repos.messages.setStatus(created.id, 'archived')
    expect(archived.status).toBe('archived')
    expect((await repos.messages.setStatus(created.id, 'draft')).status).toBe('draft')

    await repos.messages.delete(created.id)
    expect(await repos.messages.get(created.id)).toBeUndefined()
  })

  it('refuses to overwrite a newer revision (multi-tab conflict)', async () => {
    const created = await repos.messages.create({ title: '', body: 'mine', tags: [] })
    await repos.messages.save(created.id, { title: '', body: 'other tab', tags: [] }, created.rev)
    const attempt = repos.messages.save(created.id, { title: '', body: 'stale tab', tags: [] }, created.rev)
    await expect(attempt).rejects.toMatchObject({ kind: 'conflict' })
    await attempt.catch((error: StorageError<{ body: string }>) => expect(error.current?.body).toBe('other tab'))
    expect((await repos.messages.get(created.id))?.body).toBe('other tab')
  })

  it('reports a deleted record as notFound when saving', async () => {
    const created = await repos.messages.create({ title: '', body: 'x', tags: [] })
    await repos.messages.delete(created.id)
    await expect(repos.messages.save(created.id, { title: '', body: 'y', tags: [] }, created.rev)).rejects.toMatchObject({ kind: 'notFound' })
  })

  it('removes only messages that are completely empty', async () => {
    const empty = await repos.messages.create({ title: ' ', body: '\n', tags: [] })
    const kept = await repos.messages.create({ title: '', body: 'words', tags: [] })
    expect(await repos.messages.deleteIfEmpty(empty.id)).toBe(true)
    expect(await repos.messages.deleteIfEmpty(kept.id)).toBe(false)
  })

  it('seals and unseals', async () => {
    const created = await repos.messages.create({ title: '', body: 'later', tags: [] })
    expect((await repos.messages.seal(created.id, '2026-11-18')).sealedUntil).toBe('2026-11-18')
    const opened = await repos.messages.unseal(created.id)
    expect(opened.sealedUntil).toBeUndefined()
    expect(opened.sealedAt).toBeDefined()
  })
})

describe('urges', () => {
  it('saves with only an intensity and attaches the follow-up to the right entry', async () => {
    const first = await repos.urges.create({ intensity: 8 })
    const second = await repos.urges.create({ intensity: 3, trigger: ' ', note: 'x' })
    expect(second.trigger).toBeUndefined()
    await repos.urges.setFollowUp(first.id, 4)
    expect(await repos.urges.get(first.id)).toMatchObject({ intensity: 8, followUpIntensity: 4 })
    expect((await repos.urges.get(second.id))?.followUpIntensity).toBeUndefined()
    await repos.urges.delete(first.id)
    expect(await repos.urges.list()).toHaveLength(1)
  })
})

describe('check-ins', () => {
  it('keeps one check-in per local date', async () => {
    const first = await repos.checkIns.saveForDate('2026-10-18', { mood: 2 })
    const second = await repos.checkIns.saveForDate('2026-10-18', { mood: 4, personalWin: 'Walk' })
    expect(second.id).toBe(first.id)
    expect(await repos.checkIns.list()).toHaveLength(1)
    expect((await repos.checkIns.getByDate('2026-10-18'))?.mood).toBe(4)
  })

  it('handles two tabs saving the same date at once', async () => {
    await Promise.all([repos.checkIns.saveForDate('2026-10-17', { mood: 1 }), repos.checkIns.saveForDate('2026-10-17', { mood: 5 })])
    expect(await repos.checkIns.list()).toHaveLength(1)
  })
})

describe('lists, plans and good things', () => {
  it('reorders personal items', async () => {
    const a = await repos.personalItems.add('coping', 'Walk')
    await repos.personalItems.add('coping', 'Call a friend')
    await repos.personalItems.move(a.id, 1)
    expect((await repos.personalItems.list('coping')).map((i) => i.text)).toEqual(['Call a friend', 'Walk'])
  })

  it('marks plans done and undone', async () => {
    const plan = await repos.plans.add('Pottery class')
    expect((await repos.plans.setDone(plan.id, true)).doneAt).toBeDefined()
    expect((await repos.plans.setDone(plan.id, false)).doneAt).toBeUndefined()
  })

  it('stores a moment with a photo', async () => {
    const photo = { mimeType: 'image/jpeg', width: 2, height: 1, data: new Uint8Array([1, 2, 3]) }
    const entry = await repos.lifeLog.addMoment('Sunset', '2026-10-18', photo)
    const [stored] = await repos.lifeLog.list()
    expect(stored.id).toBe(entry.id)
    expect(Array.from(stored.photo!.data)).toEqual([1, 2, 3])
  })
})

describe('clear all', () => {
  it('removes every record', async () => {
    await setup()
    await repos.messages.create({ title: '', body: 'x', tags: [] })
    await repos.data.clearAll()
    const snapshot = await repos.data.snapshot()
    expect(snapshot.settings).toBeUndefined()
    expect(snapshot.messages).toHaveLength(0)
    expect(snapshot.personalItems).toHaveLength(0)
  })
})
