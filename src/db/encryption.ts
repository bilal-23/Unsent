import type { DBCore, DBCoreCursor, DBCoreTable, Middleware } from 'dexie'
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js'
import { isBytes } from '../domain/bytes'
import { open, seal } from './crypto'
import { StorageError } from './errors'

/**
 * Field-level encryption at rest for the optional app lock.
 *
 * Sensitive text and media are encrypted; ids, dates, ratings and status stay in
 * plaintext so indexes and sorting keep working. Field paths may be one level
 * deep (`photo.data`). Encrypted values are stored as `{ __enc: 1, v: Uint8Array }`.
 */
export const ENCRYPTED_FIELDS: Record<string, readonly string[]> = {
  settings: ['note', 'journalName'],
  trackingHistory: ['reason'],
  messages: ['title', 'body', 'tags'],
  urges: ['trigger', 'emotion', 'note'],
  checkIns: ['reflection', 'personalWin'],
  personalItems: ['text'],
  plans: ['text'],
  lifeLog: ['text', 'photo.data'],
  trackers: ['name'],
  exerciseEntries: ['fields'],
  voiceNotes: ['title', 'data'],
}

interface EncryptedValue {
  __enc: 1
  v: Uint8Array
}

const TAG_JSON = 0
const TAG_BYTES = 1

export function isEncryptedValue(value: unknown): value is EncryptedValue {
  return typeof value === 'object' && value !== null && (value as EncryptedValue).__enc === 1 && isBytes((value as EncryptedValue).v)
}

function encryptValue(key: Uint8Array, value: unknown): EncryptedValue {
  let payload: Uint8Array
  if (isBytes(value)) {
    payload = new Uint8Array(value.length + 1)
    payload[0] = TAG_BYTES
    payload.set(value, 1)
  } else {
    const json = utf8ToBytes(JSON.stringify(value))
    payload = new Uint8Array(json.length + 1)
    payload[0] = TAG_JSON
    payload.set(json, 1)
  }
  return { __enc: 1, v: seal(key, payload) }
}

function decryptValue(key: Uint8Array, value: EncryptedValue): unknown {
  const payload = open(key, value.v)
  const body = payload.subarray(1)
  return payload[0] === TAG_BYTES ? new Uint8Array(body) : JSON.parse(bytesToUtf8(body))
}

function mapField(record: Record<string, unknown>, path: string, fn: (value: unknown) => unknown): Record<string, unknown> {
  const [head, tail] = path.split('.') as [string, string | undefined]
  if (!(head in record) || record[head] === undefined) return record
  if (!tail) return { ...record, [head]: fn(record[head]) }
  const inner = record[head]
  if (typeof inner !== 'object' || inner === null) return record
  return { ...record, [head]: mapField(inner as Record<string, unknown>, tail, fn) }
}

export function encryptRecord<T>(record: T, fields: readonly string[], key: Uint8Array): T {
  if (typeof record !== 'object' || record === null) return record
  let out = record as Record<string, unknown>
  for (const field of fields) out = mapField(out, field, (value) => (isEncryptedValue(value) ? value : encryptValue(key, value)))
  return out as T
}

/** Decrypts any encrypted fields; plaintext fields pass through (so enabling the lock can read old rows). */
export function decryptRecord<T>(record: T, fields: readonly string[], key: Uint8Array | null): T {
  if (typeof record !== 'object' || record === null) return record
  let out = record as Record<string, unknown>
  for (const field of fields) {
    out = mapField(out, field, (value) => {
      if (!isEncryptedValue(value)) return value
      if (!key) throw new StorageError('locked')
      return decryptValue(key, value)
    })
  }
  return out as T
}

/** In-memory lock state for one database connection. The data key never touches storage unwrapped. */
export class EncryptionController {
  private key: Uint8Array | null = null
  /** True when the database holds (or should hold) encrypted data. */
  enabled = false
  /** Normally equals `enabled`; switched off while decrypting everything to disable the lock. */
  encryptWrites = false

  get unlocked(): boolean {
    return this.key !== null
  }

  get currentKey(): Uint8Array | null {
    return this.key
  }

  unlock(key: Uint8Array): void {
    this.key = key
  }

  lock(): void {
    this.key?.fill(0)
    this.key = null
  }

  /** Key to use for a write, or null for a plaintext write. Refuses to write plaintext while locked. */
  writeKey(): Uint8Array | null {
    if (!this.enabled || !this.encryptWrites) return null
    if (!this.key) throw new StorageError('locked')
    return this.key
  }
}

function wrapCursor(cursor: DBCoreCursor, decrypt: (value: unknown) => unknown): DBCoreCursor {
  return new Proxy(cursor, {
    get(target, prop) {
      if (prop === 'value') return decrypt(target.value)
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

export function encryptionMiddleware(controller: EncryptionController): Middleware<DBCore> {
  return {
    stack: 'dbcore',
    name: 'unsent-encryption',
    // Highest level = outermost: the app sees plaintext; everything below (cache, IndexedDB) sees ciphertext.
    level: 100,
    create(down: DBCore) {
      return {
        ...down,
        table(name: string): DBCoreTable {
          const table = down.table(name)
          const fields = ENCRYPTED_FIELDS[name]
          if (!fields) return table
          const decrypt = (value: unknown) => decryptRecord(value, fields, controller.currentKey)
          return {
            ...table,
            mutate(req) {
              if (req.type !== 'add' && req.type !== 'put') return table.mutate(req)
              const key = controller.writeKey()
              if (!key) return table.mutate(req)
              if (req.type === 'put' && (req.changeSpec || ('updates' in req && req.updates))) {
                throw new Error('Partial updates are not supported on encrypted tables; use put() with full records.')
              }
              return table.mutate({ ...req, values: req.values.map((value) => encryptRecord(value, fields, key)) })
            },
            get: (req) => table.get(req).then(decrypt),
            getMany: (req) => table.getMany(req).then((values) => values.map(decrypt)),
            query: (req) => table.query(req).then((res) => (req.values ? { ...res, result: res.result.map(decrypt) } : res)),
            openCursor: (req) => table.openCursor(req).then((cursor) => (cursor && req.values !== false ? wrapCursor(cursor, decrypt) : cursor)),
          }
        },
      }
    },
  }
}
