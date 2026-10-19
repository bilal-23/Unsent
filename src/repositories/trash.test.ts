import { Dexie } from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../db/database'
import { isEncryptedValue } from '../db/encryption'
import { createRepos, type Repos } from '.'
import { daysUntilPurge } from './trashRepo'

let name: string
let repos: Repos

beforeEach(async () => {
  name = `trash-test-${Math.random().toString(36).slice(2)}`
  repos = createRepos(createDatabase(name))
  await repos.connection.open()
  await repos.lock.init()
})

describe('Recently deleted', () => {
  it('moves a deleted record to the trash and restores it exactly', async () => {
    const message = await repos.messages.create({ title: 'Keep', body: 'Line 1\nLine 2 🌿', tags: ['x'] })
    const trashId = await repos.messages.delete(message.id)
    expect(trashId).toBeTruthy()
    expect(await repos.messages.get(message.id)).toBeUndefined()
    const [entry] = await repos.trash.list()
    expect(entry).toMatchObject({ table: 'messages', recordId: message.id })

    await repos.trash.restore(trashId!)
    expect(await repos.messages.get(message.id)).toEqual(message)
    expect(await repos.trash.count()).toBe(0)
  })

  it('works for every kind of entry', async () => {
    const urge = await repos.urges.create({ intensity: 5 })
    const checkIn = await repos.checkIns.saveForDate('2026-10-18', { mood: 3 })
    const plan = await repos.plans.add('Pottery')
    const moment = await repos.lifeLog.addMoment('Sunset', '2026-10-17', { mimeType: 'image/jpeg', width: 1, height: 1, data: new Uint8Array([4, 5]) })
    const voice = await repos.voiceNotes.add({ title: 'V', blob: new Blob([new Uint8Array([1, 2])], { type: 'audio/webm' }), durationMs: 10 })
    const exercise = await repos.exercises.save({ kind: 'values', fields: { values: 'calm' } })
    const tracker = await repos.trackers.add({ name: 'Profile', startDate: '2026-10-01' })
    const reason = await repos.personalItems.add('reason', 'Peace')

    const ids = [
      await repos.urges.delete(urge.id),
      await repos.checkIns.delete(checkIn.id),
      await repos.plans.delete(plan.id),
      await repos.lifeLog.delete(moment.id),
      await repos.voiceNotes.delete(voice.id),
      await repos.exercises.delete(exercise.id),
      await repos.trackers.delete(tracker.id),
      await repos.personalItems.delete(reason.id),
    ]
    expect(await repos.trash.count()).toBe(8)
    for (const id of ids) await repos.trash.restore(id!)
    expect(await repos.urges.get(urge.id)).toEqual(urge)
    expect(await repos.checkIns.getByDate('2026-10-18')).toEqual(checkIn)
    expect(Array.from((await repos.lifeLog.list())[0].photo!.data)).toEqual([4, 5])
    expect(Array.from((await repos.voiceNotes.get(voice.id))!.data)).toEqual([1, 2])
    expect((await repos.personalItems.list('reason')).map((r) => r.text)).toEqual(['Peace'])
    expect(await repos.trash.count()).toBe(0)
  })

  it('returns null when the record is already gone', async () => {
    expect(await repos.urges.delete('00000000-0000-4000-8000-000000000000')).toBeNull()
  })

  it('refuses to restore a check-in over another one for the same day', async () => {
    const first = await repos.checkIns.saveForDate('2026-10-18', { mood: 2 })
    const trashId = await repos.checkIns.delete(first.id)
    await repos.checkIns.saveForDate('2026-10-18', { mood: 5 })
    await expect(repos.trash.restore(trashId!)).rejects.toMatchObject({ kind: 'conflict' })
    expect(await repos.trash.count()).toBe(1)
  })

  it('removes entries for good after 30 days, and on request', async () => {
    const a = await repos.urges.create({ intensity: 1 })
    const b = await repos.urges.create({ intensity: 2 })
    await repos.urges.delete(a.id)
    const bTrash = await repos.urges.delete(b.id)
    const in31Days = new Date(Date.now() + 31 * 86_400_000)
    expect(daysUntilPurge(new Date().toISOString())).toBe(30)
    await repos.trash.remove(bTrash!)
    expect(await repos.trash.count()).toBe(1)
    await repos.trash.purgeExpired(new Date())
    expect(await repos.trash.count()).toBe(1)
    await repos.trash.purgeExpired(in31Days)
    expect(await repos.trash.count()).toBe(0)
  })

  it('is emptied by "delete all data" and by a replace import, and is never exported', async () => {
    const urge = await repos.urges.create({ intensity: 3 })
    await repos.urges.delete(urge.id)
    const snapshot = await repos.data.snapshot()
    expect(JSON.stringify(Object.keys(snapshot))).not.toContain('trash')
    await repos.data.replaceAll({ ...snapshot, settings: null, preferences: null, messages: [] })
    expect(await repos.trash.count()).toBe(0)
    await repos.urges.delete((await repos.urges.create({ intensity: 4 })).id)
    await repos.data.clearAll()
    expect(await repos.trash.count()).toBe(0)
  })

  it('keeps trashed content encrypted when the app lock is on', async () => {
    await repos.lock.enable('correct horse battery')
    const message = await repos.messages.create({ title: 'Secret title', body: 'secret body', tags: [] })
    const moment = await repos.lifeLog.addMoment('Secret moment', '2026-10-17', { mimeType: 'image/jpeg', width: 1, height: 1, data: new Uint8Array([7, 7]) })
    await repos.messages.delete(message.id)
    await repos.lifeLog.delete(moment.id)

    const raw = new Dexie(name)
    await raw.open()
    const rows = await raw.table('trash').toArray()
    raw.close()
    expect(JSON.stringify(rows)).not.toMatch(/secret/i)
    const messageRow = rows.find((r) => r.table === 'messages')
    expect(isEncryptedValue(messageRow.record.body)).toBe(true)
    expect(messageRow.record.status).toBe('draft')
    expect(isEncryptedValue(rows.find((r) => r.table === 'lifeLog').record.photo.data)).toBe(true)

    // Readable through the app while unlocked, restorable, and purgeable while locked.
    expect((await repos.trash.list()).map((e) => e.table).sort()).toEqual(['lifeLog', 'messages'])
    const [entry] = await repos.trash.list()
    await repos.trash.restore(entry.id)
    repos.lock.lock()
    await expect(repos.trash.purgeExpired(new Date(Date.now() + 40 * 86_400_000))).resolves.toBe(1)
  })

  it('turning the lock off decrypts trashed entries too', async () => {
    await repos.lock.enable('correct horse battery')
    const urge = await repos.urges.create({ intensity: 6, note: 'private note' })
    await repos.urges.delete(urge.id)
    await repos.lock.disable('correct horse battery')
    const raw = new Dexie(name)
    await raw.open()
    const [row] = await raw.table('trash').toArray()
    raw.close()
    expect(row.record.note).toBe('private note')
  })
})

describe('plans order', () => {
  it('adds new plans at the top and moves them within their group', async () => {
    const a = await repos.plans.add('A')
    const b = await repos.plans.add('B')
    const c = await repos.plans.add('C')
    expect((await repos.plans.list()).map((p) => p.text)).toEqual(['C', 'B', 'A'])
    await repos.plans.move(a.id, -1)
    expect((await repos.plans.list()).map((p) => p.text)).toEqual(['C', 'A', 'B'])
    await repos.plans.move(c.id, -1) // already first: no-op
    expect((await repos.plans.list()).map((p) => p.text)).toEqual(['C', 'A', 'B'])

    await repos.plans.setDone(b.id, true)
    // B is done now; moving A down skips over it because done plans are a separate group.
    await repos.plans.move(a.id, 1)
    const open = (await repos.plans.list()).filter((p) => p.status === 'open').map((p) => p.text)
    expect(open).toEqual(['C', 'A'])
    const positions = (await repos.plans.list()).map((p) => p.position)
    expect(new Set(positions).size).toBe(positions.length)
  })
})

describe('editing good things', () => {
  it('changes words, day and photo', async () => {
    const entry = await repos.lifeLog.addMoment('Coffee', '2026-10-17')
    await repos.lifeLog.update(entry.id, { text: '  Coffee with Sam  ', localDate: '2026-10-16', photo: { mimeType: 'image/jpeg', width: 2, height: 2, data: new Uint8Array([1]) } })
    let [stored] = await repos.lifeLog.list()
    expect(stored).toMatchObject({ text: 'Coffee with Sam', localDate: '2026-10-16' })
    expect(stored.photo?.width).toBe(2)
    await repos.lifeLog.update(entry.id, { text: 'Coffee with Sam', localDate: '2026-10-16', photo: undefined })
    ;[stored] = await repos.lifeLog.list()
    expect(stored.photo).toBeUndefined()
  })
})

describe('habits', () => {
  it('ticks a day once, un-ticks it, and reorders', async () => {
    const gym = await repos.habits.add({ name: 'Gym', targetPerWeek: 9 })
    const read = await repos.habits.add({ name: 'Read', targetPerWeek: 7 })
    expect(gym.targetPerWeek).toBe(7) // clamped to a week
    expect(await repos.habits.toggle(gym.id, '2026-10-18')).toBe(true)
    await Promise.all([repos.habits.toggle(read.id, '2026-10-18'), repos.habits.toggle(read.id, '2026-10-17')])
    expect((await repos.habits.listLogs()).length).toBe(3)
    expect(await repos.habits.toggle(gym.id, '2026-10-18')).toBe(false)
    expect((await repos.habits.listLogs()).filter((l) => l.habitId === gym.id)).toHaveLength(0)
    await repos.habits.move(read.id, -1)
    expect((await repos.habits.list()).map((h) => h.name)).toEqual(['Read', 'Gym'])
  })

  it('keeps a deleted habit’s history so restoring brings it back, and cleans up after a permanent delete', async () => {
    const gym = await repos.habits.add({ name: 'Gym', targetPerWeek: 3 })
    await repos.habits.toggle(gym.id, '2026-10-18')
    const trashId = await repos.habits.delete(gym.id)
    expect(await repos.habits.removeOrphanLogs()).toBe(0) // still restorable
    await repos.trash.restore(trashId!)
    expect((await repos.habits.listLogs()).length).toBe(1)

    const again = await repos.habits.delete(gym.id)
    await repos.trash.remove(again!)
    expect(await repos.habits.removeOrphanLogs()).toBe(1)
  })

  it('encrypts habit names at rest when the lock is on', async () => {
    await repos.lock.enable('correct horse battery')
    await repos.habits.add({ name: 'Secret hobby', targetPerWeek: 2 })
    const raw = new Dexie(name)
    await raw.open()
    const [row] = await raw.table('habits').toArray()
    raw.close()
    expect(isEncryptedValue(row.name)).toBe(true)
    expect(row.targetPerWeek).toBe(2)
    expect((await repos.habits.list())[0].name).toBe('Secret hobby')
  })
})
