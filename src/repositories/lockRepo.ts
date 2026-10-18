import { userTables, type UnsentDatabase } from '../db/database'
import { deriveKey, KDF_ITERATIONS, KEY_BYTES, open, randomBytes, seal } from '../db/crypto'
import { ENCRYPTED_FIELDS } from '../db/encryption'
import { guard, StorageError } from '../db/errors'
import { nowIso } from '../domain/dates'
import { SINGLETON_ID, type Keyring } from '../domain/types'

export type LockStatus = 'off' | 'locked' | 'unlocked'

export class WrongPassphraseError extends Error {
  constructor() {
    super('Wrong passphrase')
    this.name = 'WrongPassphraseError'
  }
}

export const MIN_PASSPHRASE_LENGTH = 8

/**
 * Optional app lock with encryption at rest.
 * A random data key encrypts records; the passphrase only wraps that key, so
 * changing the passphrase is instant. There is no recovery: a forgotten
 * passphrase means the encrypted entries cannot be read.
 */
export function createLockRepo(db: UnsentDatabase) {
  const controller = db.encryption

  const unwrap = async (keyring: Keyring, passphrase: string) => {
    const kek = await deriveKey(passphrase, keyring.salt, keyring.iterations)
    try {
      return open(kek, keyring.wrappedKey)
    } catch {
      throw new WrongPassphraseError()
    } finally {
      kek.fill(0)
    }
  }

  const buildKeyring = async (passphrase: string, dataKey: Uint8Array, createdAt = nowIso()): Promise<Keyring> => {
    const salt = randomBytes(16)
    const kek = await deriveKey(passphrase, salt, KDF_ITERATIONS)
    const sealed = seal(kek, dataKey)
    kek.fill(0)
    return {
      id: SINGLETON_ID,
      version: 1,
      kdf: 'PBKDF2-SHA256',
      iterations: KDF_ITERATIONS,
      salt,
      nonce: sealed.subarray(0, 24),
      wrappedKey: sealed,
      createdAt,
    }
  }

  /** Re-writes every encrypted-capable table through the middleware (encrypting or decrypting). */
  const rewriteAll = async () => {
    const tables = userTables(db).filter((table) => ENCRYPTED_FIELDS[table.name])
    for (const table of tables) {
      const rows = await table.toArray()
      if (rows.length) await (table as typeof db.messages).bulkPut(rows as never[])
    }
  }

  return {
    /** Reads the keyring after the database opens. */
    init: () =>
      guard(async () => {
        const keyring = await db.keyring.get(SINGLETON_ID)
        controller.enabled = !!keyring
        controller.encryptWrites = !!keyring
      }),

    status: (): LockStatus => (!controller.enabled ? 'off' : controller.unlocked ? 'unlocked' : 'locked'),

    unlock: async (passphrase: string) => {
      const keyring = await guard(() => db.keyring.get(SINGLETON_ID))
      if (!keyring) return
      controller.unlock(await unwrap(keyring, passphrase))
    },

    lock: () => controller.lock(),

    /** Turns the lock on and encrypts every existing record in one transaction. */
    enable: async (passphrase: string) => {
      if (passphrase.length < MIN_PASSPHRASE_LENGTH) throw new Error('Passphrase too short')
      const dataKey = randomBytes(KEY_BYTES)
      const keyring = await buildKeyring(passphrase, dataKey)
      controller.unlock(dataKey)
      controller.enabled = true
      controller.encryptWrites = true
      try {
        await guard(() =>
          db.transaction('rw', [...userTables(db), db.keyring], async () => {
            await rewriteAll()
            await db.keyring.put(keyring)
          }),
        )
      } catch (error) {
        controller.lock()
        controller.enabled = false
        controller.encryptWrites = false
        throw error
      }
    },

    /** Turns the lock off: decrypts every record, then removes the keyring. */
    disable: async (passphrase: string) => {
      const keyring = await guard(() => db.keyring.get(SINGLETON_ID))
      if (!keyring) return
      controller.unlock(await unwrap(keyring, passphrase))
      controller.encryptWrites = false
      try {
        await guard(() =>
          db.transaction('rw', [...userTables(db), db.keyring], async () => {
            await rewriteAll()
            await db.keyring.delete(SINGLETON_ID)
          }),
        )
        controller.enabled = false
        controller.lock()
      } catch (error) {
        controller.encryptWrites = true
        throw error
      }
    },

    changePassphrase: async (current: string, next: string) => {
      if (next.length < MIN_PASSPHRASE_LENGTH) throw new Error('Passphrase too short')
      const keyring = await guard(() => db.keyring.get(SINGLETON_ID))
      if (!keyring) throw new StorageError('notFound')
      const dataKey = await unwrap(keyring, current)
      const updated = await buildKeyring(next, dataKey, keyring.createdAt)
      await guard(() => db.keyring.put(updated))
    },

    /** Encryption must not be undermined by plaintext copies (e.g. autosave shadow drafts). */
    isEnabled: () => controller.enabled,
  }
}

export type LockRepo = ReturnType<typeof createLockRepo>
