import type { Dexie, Transaction } from 'dexie'

export interface SchemaVersion {
  version: number
  stores: Record<string, string | null>
  upgrade?: (tx: Transaction) => PromiseLike<unknown> | void
}

/**
 * Append-only list of IndexedDB schema versions.
 *
 * NEVER edit an entry once it has shipped. To change the schema, append a new
 * version with the full `stores` map and an `upgrade` function that migrates
 * existing rows, then add a test in schema.test.ts that seeds the previous version.
 */
export const SCHEMA_VERSIONS: readonly SchemaVersion[] = [
  {
    version: 1,
    stores: {
      settings: 'id',
      preferences: 'id',
      trackingHistory: 'id, changedAt',
      messages: 'id, updatedAt, createdAt, status, *tags',
      urges: 'id, createdAt',
      checkIns: 'id, &localDate, createdAt',
      personalItems: 'id, kind',
      plans: 'id, status, createdAt',
      lifeLog: 'id, localDate, createdAt',
      trackers: 'id, createdAt',
      exerciseEntries: 'id, kind, createdAt, [programId+day]',
      voiceNotes: 'id, createdAt',
      keyring: 'id',
    },
  },
]

export const LATEST_SCHEMA_VERSION = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1].version

/** Registers schema versions up to and including `upTo` on a Dexie instance. */
export function applySchemaVersions(db: Dexie, upTo: number = LATEST_SCHEMA_VERSION): void {
  for (const entry of SCHEMA_VERSIONS) {
    if (entry.version > upTo) break
    const version = db.version(entry.version).stores(entry.stores)
    if (entry.upgrade) version.upgrade(entry.upgrade)
  }
}
