import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTestRepos } from '../../test/factories'
import type { Repos } from '../../repositories'
import { decryptBackupJson, encryptBackupJson, WrongBackupPassphraseError } from './encryptedBackup'
import { buildEnvelope, createBackup, serializeEnvelope } from './exportService'
import { mergeBackup, previewMerge, replaceWithBackup } from './importService'
import { migrateBackupData, UnsupportedVersionError } from './migrations'
import { parseBackupFile, parseBackupText, type ParsedBackup } from './parseBackup'

let repos: Repos

beforeEach(async () => {
  repos = makeTestRepos()
  await repos.connection.open()
  await repos.lock.init()
})

const TRICKY = 'First line\r\nSecond line\n\n\tIndented — “quotes” 🌿💙 大丈夫 עברית 🏳️‍🌈\u0000end'

async function seed(target: Repos) {
  await target.tracking.setup({ lastContactDate: '2026-10-15', journalName: 'Quiet', intentionDays: 30, reasons: ['Peace 🌿'] })
  const message = await target.messages.create({ title: 'To you', body: TRICKY, tags: ['summer', 'ünïcode'] })
  await target.messages.setStatus(message.id, 'archived')
  await target.messages.create({ title: '', body: 'x'.repeat(200_000), tags: [] })
  const urge = await target.urges.create({ intensity: 8, trigger: 'Loneliness', note: TRICKY })
  await target.urges.setFollowUp(urge.id, 3)
  await target.checkIns.saveForDate('2026-10-16', { mood: 4, energy: 2, reflection: TRICKY, personalWin: 'Walked' })
  await target.personalItems.add('coping', 'Call my sister')
  await target.plans.add('Learn guitar')
  await target.lifeLog.addMoment('Sunset', '2026-10-17', { mimeType: 'image/jpeg', width: 4, height: 3, data: new Uint8Array([0, 255, 128, 7]) })
  await target.trackers.add({ name: 'Not checking their profile', startDate: '2026-10-10', intentionDays: 14 })
  await target.exercises.save({ kind: 'thought-record', fields: { thought: TRICKY } })
  await target.exercises.saveProgramDay('rebuilding-28', 1, { now: 'Okay' })
  await target.voiceNotes.add({ title: 'Voice', blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' }), durationMs: 1234 })
  await target.preferences.update({ theme: 'dark', textSize: 'lg' })
  await target.tracking.changeDate({ newDate: '2026-10-17', reason: 'Called' })
}

async function exportText(source: Repos) {
  return serializeEnvelope(buildEnvelope(await source.data.snapshot()))
}

function parsed(text: string): ParsedBackup {
  const result = parseBackupText(text)
  if (!result.ok) throw new Error(`${result.error} ${result.details?.join('; ') ?? ''}`)
  return result.backup
}

const strip = <T extends { rev?: number }>(rows: T[]) => rows.map(({ rev: _rev, ...rest }) => rest)
const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id))

describe('export → import round trip', () => {
  it('restores every record exactly, including Unicode, line breaks, timestamps and binary data', async () => {
    await seed(repos)
    const original = await repos.data.snapshot()
    const text = await exportText(repos)
    const backup = parsed(text)
    expect(backup.counts).toMatchObject({ messages: 2, urges: 1, checkIns: 1, trackingHistory: 2, personalItems: 2, plans: 1, lifeLog: 1, trackers: 1, exerciseEntries: 2, voiceNotes: 1 })

    const target = makeTestRepos()
    await target.connection.open()
    await target.lock.init()
    await replaceWithBackup(target, backup.data)
    const restored = await target.data.snapshot()

    expect(restored.settings).toEqual(original.settings)
    expect(restored.preferences).toEqual(original.preferences)
    expect(byId(strip(restored.messages))).toEqual(byId(strip(original.messages)))
    for (const key of ['urges', 'checkIns', 'trackingHistory', 'personalItems', 'plans', 'lifeLog', 'trackers', 'exerciseEntries', 'voiceNotes'] as const) {
      expect(byId(restored[key] as { id: string }[])).toEqual(byId(original[key] as { id: string }[]))
    }
    expect(restored.messages.find((m) => m.title === 'To you')?.body).toBe(TRICKY)
    expect(Array.from(restored.lifeLog[0].photo!.data)).toEqual([0, 255, 128, 7])
  })

  it('never includes the internal revision counter in the file', async () => {
    await seed(repos)
    expect(await exportText(repos)).not.toContain('"rev"')
  })

  it('a second export of a restored backup is identical apart from the export time', async () => {
    await seed(repos)
    const first = JSON.parse(await exportText(repos))
    const target = makeTestRepos()
    await target.connection.open()
    await target.lock.init()
    await replaceWithBackup(target, parsed(JSON.stringify(first)).data)
    const second = JSON.parse(await exportText(target))
    const sortAll = (data: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? byId(v as { id: string }[]) : v]))
    expect(sortAll(second.data)).toEqual(sortAll(first.data))
  })
})

describe('validation', () => {
  it('rejects malformed files without touching existing data', async () => {
    await seed(repos)
    const before = JSON.stringify(await repos.data.snapshot(), (_k, v) => (v instanceof Uint8Array ? Array.from(v) : v))
    const bad = [
      'not json at all {',
      JSON.stringify({ hello: 'world' }),
      JSON.stringify({ app: 'other-app', schemaVersion: 1, data: {} }),
      JSON.stringify({ app: 'unsent', schemaVersion: 1, exportedAt: 'x', data: { messages: 'nope' } }),
      JSON.stringify({ app: 'unsent', schemaVersion: 99, exportedAt: 'x', data: {} }),
    ]
    for (const text of bad) expect(parseBackupText(text).ok).toBe(false)
    const after = JSON.stringify(await repos.data.snapshot(), (_k, v) => (v instanceof Uint8Array ? Array.from(v) : v))
    expect(after).toBe(before)
  })

  it('explains unsupported future versions', () => {
    const result = parseBackupText(JSON.stringify({ app: 'unsent', schemaVersion: 99, exportedAt: '2026-10-18T00:00:00.000Z', data: {} }))
    expect(result).toMatchObject({ ok: false })
    expect(!result.ok && result.error).toMatch(/newer version/)
  })

  it('rejects duplicate ids and duplicate check-in dates inside one file', async () => {
    await seed(repos)
    const file = JSON.parse(await exportText(repos))
    file.data.urges.push({ ...file.data.urges[0] })
    const dupIds = parseBackupText(JSON.stringify(file))
    expect(dupIds.ok).toBe(false)
    expect(!dupIds.ok && dupIds.details?.join()).toMatch(/urges: 1 duplicate/)

    const file2 = JSON.parse(await exportText(repos))
    file2.data.checkIns.push({ ...file2.data.checkIns[0], id: crypto.randomUUID() })
    const dupDates = parseBackupText(JSON.stringify(file2))
    expect(!dupDates.ok && dupDates.details?.join()).toMatch(/more than one check-in/)
  })

  it('does not echo user text in error details', async () => {
    await seed(repos)
    const file = JSON.parse(await exportText(repos))
    file.data.messages[0].body = 12345
    const result = parseBackupText(JSON.stringify(file))
    expect(result.ok).toBe(false)
    expect(JSON.stringify(result)).not.toContain('Second line')
  })

  it('fills in preferences that older backups do not have', async () => {
    await seed(repos)
    const file = JSON.parse(await exportText(repos))
    delete file.data.preferences.showIdeas
    delete file.data.preferences.textSize
    const backup = parsed(JSON.stringify(file))
    expect(backup.data.preferences).toMatchObject({ showIdeas: true, textSize: 'md', theme: 'dark' })
  })

  it('refuses very large files before reading them', async () => {
    const huge = { size: 151 * 1024 * 1024, text: vi.fn() } as unknown as Blob
    const result = await parseBackupFile(huge)
    expect(result.ok).toBe(false)
    expect((huge as unknown as { text: ReturnType<typeof vi.fn> }).text).not.toHaveBeenCalled()
  })
})

describe('migrations', () => {
  it('imports an early version-2 backup made before habits existed', async () => {
    await seed(repos)
    const file = JSON.parse(await exportText(repos))
    delete file.data.habits
    delete file.data.habitLogs
    const backup = parsed(JSON.stringify(file))
    expect(backup.data.habits).toEqual([])
    expect(backup.data.habitLogs).toEqual([])
  })

  it('imports a version-1 backup: plans get an order, newest first', async () => {
    await seed(repos)
    const file = JSON.parse(await exportText(repos))
    file.schemaVersion = 1
    file.data.plans = [
      { id: crypto.randomUUID(), text: 'Older', status: 'open', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' },
      { id: crypto.randomUUID(), text: 'Newer', status: 'done', doneAt: '2026-10-06T00:00:00.000Z', createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-06T00:00:00.000Z' },
    ]
    const backup = parsed(JSON.stringify(file))
    expect(backup.schemaVersion).toBe(1)
    expect(backup.data.plans.map((p) => [p.text, p.position])).toEqual([
      ['Older', 1],
      ['Newer', 0],
    ])
  })

  it('runs each step from the file version up to the current one', () => {
    const steps = { 1: (d: unknown) => ({ ...(d as object), v2: true }), 2: (d: unknown) => ({ ...(d as object), v3: true }) }
    expect(migrateBackupData({ a: 1 }, 1, steps, 3)).toEqual({ a: 1, v2: true, v3: true })
  })

  it('rejects versions newer than the app or with a missing step', () => {
    expect(() => migrateBackupData({}, 4, {}, 3)).toThrow(UnsupportedVersionError)
    expect(() => migrateBackupData({}, 1, {}, 2)).toThrow(UnsupportedVersionError)
  })
})

describe('merge', () => {
  it('adds new records and never duplicates existing ids', async () => {
    await seed(repos)
    const backup = parsed(await exportText(repos))
    const preview = await previewMerge(repos, backup.data)
    expect(preview.messages).toEqual({ added: 0, updated: 0, unchanged: 2 })

    await mergeBackup(repos, backup.data)
    await mergeBackup(repos, backup.data)
    const snapshot = await repos.data.snapshot()
    expect(snapshot.messages).toHaveLength(2)
    expect(snapshot.urges).toHaveLength(1)
    expect(snapshot.checkIns).toHaveLength(1)
  })

  it('combines two devices', async () => {
    await seed(repos)
    const other = makeTestRepos()
    await other.connection.open()
    await other.lock.init()
    await other.urges.create({ intensity: 2 })
    await other.checkIns.saveForDate('2026-10-01', { mood: 5 })
    await mergeBackup(repos, parsed(await exportText(other)).data)
    const snapshot = await repos.data.snapshot()
    expect(snapshot.urges).toHaveLength(2)
    expect(snapshot.checkIns).toHaveLength(2)
    expect(snapshot.settings?.journalName).toBe('Quiet')
  })
})

describe('replace', () => {
  it('rolls back completely if any write fails', async () => {
    await seed(repos)
    const before = await repos.data.snapshot()
    const other = makeTestRepos()
    await other.connection.open()
    await other.lock.init()
    await other.urges.create({ intensity: 1 })
    const data = parsed(await exportText(other)).data
    // Sabotage: two check-ins for the same date violate the unique index mid-transaction.
    const poisoned = {
      ...data,
      checkIns: [
        { id: crypto.randomUUID(), localDate: '2026-10-01', mood: 1, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' },
        { id: crypto.randomUUID(), localDate: '2026-10-01', mood: 2, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' },
      ],
    }
    await expect(replaceWithBackup(repos, poisoned)).rejects.toBeTruthy()
    const after = await repos.data.snapshot()
    expect(after.messages.map((m) => m.id).sort()).toEqual(before.messages.map((m) => m.id).sort())
    expect(after.urges).toEqual(before.urges)
    expect(after.settings).toEqual(before.settings)
  })
})

describe('passphrase-protected backups', () => {
  it('round-trips and rejects the wrong passphrase', async () => {
    await seed(repos)
    const { json } = await createBackup(repos, 'correct horse battery')
    expect(json).not.toContain('Second line')
    const first = parseBackupText(json)
    expect(first.ok).toBe(false)
    if (first.ok || !first.encrypted) throw new Error('expected an encrypted envelope')
    await expect(decryptBackupJson(first.encrypted, 'wrong passphrase')).rejects.toBeInstanceOf(WrongBackupPassphraseError)
    const inner = await decryptBackupJson(first.encrypted, 'correct horse battery')
    expect(parsed(inner).counts.messages).toBe(2)
  })

  it('detects tampering', async () => {
    const text = await encryptBackupJson('{"a":1}', 'passphrase!')
    const envelope = JSON.parse(text)
    const bytes = atob(envelope.data)
    envelope.data = btoa(bytes.slice(0, -1) + String.fromCharCode(bytes.charCodeAt(bytes.length - 1) ^ 1))
    const result = parseBackupText(JSON.stringify(envelope))
    if (result.ok || !result.encrypted) throw new Error('expected an encrypted envelope')
    await expect(decryptBackupJson(result.encrypted, 'passphrase!')).rejects.toBeInstanceOf(WrongBackupPassphraseError)
  })
})
