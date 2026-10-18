import type { UnsentDatabase } from '../db/database'
import { StorageError, toStorageError } from '../db/errors'

export function createConnection(db: UnsentDatabase) {
  return {
    /** Opens (and if needed upgrades) the database. Throws StorageError('unavailable') on failure. */
    open: async () => {
      try {
        await db.open()
      } catch (error) {
        const storageError = toStorageError(error)
        throw storageError.kind === 'unknown' ? new StorageError('unavailable', { cause: error }) : storageError
      }
    },
    close: () => db.close(),
    /** Another tab opened a newer schema: close so it can upgrade, then tell the user to reload. */
    onVersionChange: (handler: () => void) => {
      const listener = () => {
        db.close()
        handler()
        return false
      }
      db.on('versionchange', listener)
      return () => db.on('versionchange').unsubscribe(listener)
    },
    /** This tab wants to upgrade but another tab holds an older connection open. */
    onBlocked: (handler: () => void) => {
      db.on('blocked', handler)
      return () => db.on('blocked').unsubscribe(handler)
    },
  }
}
