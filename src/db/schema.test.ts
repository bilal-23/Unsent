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

  it('opens a fresh database at the latest version', async () => {
    const db = createDatabase(`schema-fresh-${Math.random()}`)
    await db.open()
    expect(db.verno).toBe(LATEST_SCHEMA_VERSION)
    db.close()
  })

  /**
   * Migration harness: seed a database at an old version with raw rows, close it,
   * then reopen with the full schema list and check the upgraded rows.
   * Demonstrated with a hypothetical v2 so the pattern is tested before it is needed.
   */
  it('upgrades existing rows when a new version is appended', async () => {
    const name = `schema-upgrade-${Math.random()}`
    const v1 = new Dexie(name)
    applySchemaVersions(v1, 1)
    await v1.open()
    await v1.table('urges').add({ id: 'u1', intensity: 7, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' })
    v1.close()

    const v2: SchemaVersion = {
      version: 2,
      stores: { ...SCHEMA_VERSIONS[0].stores, urges: 'id, createdAt, intensity' },
      upgrade: (tx) =>
        tx
          .table('urges')
          .toCollection()
          .modify((row: { note?: string }) => {
            row.note ??= ''
          }),
    }
    const upgraded = new Dexie(name)
    for (const entry of [...SCHEMA_VERSIONS, v2]) {
      const version = upgraded.version(entry.version).stores(entry.stores)
      if (entry.upgrade) version.upgrade(entry.upgrade)
    }
    await upgraded.open()
    expect(upgraded.verno).toBe(2)
    expect(await upgraded.table('urges').get('u1')).toMatchObject({ intensity: 7, note: '' })
    expect(await upgraded.table('urges').where('intensity').equals(7).count()).toBe(1)
    upgraded.close()
  })
})
