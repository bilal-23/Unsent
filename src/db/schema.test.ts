import { Dexie } from 'dexie'
import { describe, expect, it } from 'vitest'
import { createDatabase } from './database'
import { applySchemaVersions, LATEST_SCHEMA_VERSION, SCHEMA_VERSIONS, type SchemaVersion } from './schema'

describe('schema versions', () => {
  it('never changes a shipped version (append new versions instead)', () => {
    expect(SCHEMA_VERSIONS[0]).toMatchInlineSnapshot(`
      {
        "stores": {
          "checkIns": "id, &localDate, createdAt",
          "exerciseEntries": "id, kind, createdAt, [programId+day]",
          "keyring": "id",
          "lifeLog": "id, localDate, createdAt",
          "messages": "id, updatedAt, createdAt, status, *tags",
          "personalItems": "id, kind",
          "plans": "id, status, createdAt",
          "preferences": "id",
          "settings": "id",
          "trackers": "id, createdAt",
          "trackingHistory": "id, changedAt",
          "urges": "id, createdAt",
          "voiceNotes": "id, createdAt",
        },
        "version": 1,
      }
    `)
  })

  it('v2 adds "Recently deleted" and gives existing plans an order (newest first)', async () => {
    const name = `schema-v2-${Math.random()}`
    const v1 = new Dexie(name)
    applySchemaVersions(v1, 1)
    await v1.open()
    await v1.table('plans').bulkAdd([
      { id: 'old', text: 'Old', status: 'open', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' },
      { id: 'new', text: 'New', status: 'open', createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z' },
    ])
    v1.close()

    const db = createDatabase(name)
    await db.open()
    expect(db.verno).toBe(LATEST_SCHEMA_VERSION)
    expect((await db.plans.get('new'))?.position).toBe(0)
    expect((await db.plans.get('old'))?.position).toBe(1)
    expect(await db.trash.count()).toBe(0)
    db.close()
  })

  it('v3 adds habits to a v2 database without touching its data', async () => {
    const name = `schema-v3-${Math.random()}`
    const v2 = new Dexie(name)
    applySchemaVersions(v2, 2)
    await v2.open()
    await v2.table('trash').add({ id: 't1', table: 'urges', recordId: 'u1', record: { id: 'u1' }, deletedAt: '2026-10-18T00:00:00.000Z' })
    v2.close()

    const db = createDatabase(name)
    await db.open()
    expect(db.verno).toBe(3)
    expect(await db.trash.count()).toBe(1)
    await db.habits.add({ id: 'h1', name: 'Read', targetPerWeek: 7, position: 0, archived: false, createdAt: 'x', updatedAt: 'x' })
    await db.habitLogs.add({ id: 'l1', habitId: 'h1', localDate: '2026-10-18', createdAt: 'x' })
    await expect(db.habitLogs.add({ id: 'l2', habitId: 'h1', localDate: '2026-10-18', createdAt: 'x' })).rejects.toThrow()
    db.close()
  })

  it('opens a fresh database at the latest version', async () => {
    const db = createDatabase(`schema-fresh-${Math.random()}`)
    await db.open()
    expect(db.verno).toBe(LATEST_SCHEMA_VERSION)
    db.close()
  })

  /**
   * Migration harness: seed a database at an old version with raw rows, close it,
   * then reopen with the full schema list and check the upgraded rows.
   * Demonstrated with a hypothetical next version so the pattern stays tested.
   */
  it('upgrades existing rows when a new version is appended', async () => {
    const name = `schema-upgrade-${Math.random()}`
    const v1 = new Dexie(name)
    applySchemaVersions(v1, 1)
    await v1.open()
    await v1.table('urges').add({ id: 'u1', intensity: 7, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' })
    v1.close()

    const next = LATEST_SCHEMA_VERSION + 1
    const future: SchemaVersion = {
      version: next,
      stores: { ...SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1].stores, urges: 'id, createdAt, intensity' },
      upgrade: (tx) =>
        tx
          .table('urges')
          .toCollection()
          .modify((row: { note?: string }) => {
            row.note ??= ''
          }),
    }
    const upgraded = new Dexie(name)
    for (const entry of [...SCHEMA_VERSIONS, future]) {
      const version = upgraded.version(entry.version).stores(entry.stores)
      if (entry.upgrade) version.upgrade(entry.upgrade)
    }
    await upgraded.open()
    expect(upgraded.verno).toBe(next)
    expect(await upgraded.table('urges').get('u1')).toMatchObject({ intensity: 7, note: '' })
    expect(await upgraded.table('urges').where('intensity').equals(7).count()).toBe(1)
    upgraded.close()
  })
})
