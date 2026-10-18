import { CURRENT_BACKUP_VERSION } from './schema'

/**
 * Backup-format migrations, keyed by the version they upgrade FROM.
 * `MIGRATIONS[1]` would turn a version-1 `data` object into version-2 shape.
 * Every supported older version needs an entry; unknown future versions are rejected.
 */
export const MIGRATIONS: Record<number, (data: unknown) => unknown> = {}

export class UnsupportedVersionError extends Error {
  readonly version: number
  constructor(version: number) {
    super(`Unsupported backup version ${version}`)
    this.name = 'UnsupportedVersionError'
    this.version = version
  }
}

export function migrateBackupData(
  data: unknown,
  fromVersion: number,
  migrations: Record<number, (data: unknown) => unknown> = MIGRATIONS,
  target: number = CURRENT_BACKUP_VERSION,
): unknown {
  if (fromVersion > target) throw new UnsupportedVersionError(fromVersion)
  let current = data
  for (let version = fromVersion; version < target; version++) {
    const migrate = migrations[version]
    if (!migrate) throw new UnsupportedVersionError(fromVersion)
    current = migrate(current)
  }
  return current
}
