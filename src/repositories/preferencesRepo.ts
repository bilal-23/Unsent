import type { UnsentDatabase } from '../db/database'
import { guard } from '../db/errors'
import { preferencesWithDefaults as withDefaults, SINGLETON_ID, type Preferences } from '../domain/types'

export function createPreferencesRepo(db: UnsentDatabase) {
  return {
    get: () => guard(async () => withDefaults(await db.preferences.get(SINGLETON_ID))),

    update: (patch: Partial<Omit<Preferences, 'id'>>) =>
      guard(() =>
        db.transaction('rw', db.preferences, async () => {
          const next = withDefaults({ ...(await db.preferences.get(SINGLETON_ID)), ...patch })
          await db.preferences.put(next)
          return next
        }),
      ),
  }
}

export type PreferencesRepo = ReturnType<typeof createPreferencesRepo>
