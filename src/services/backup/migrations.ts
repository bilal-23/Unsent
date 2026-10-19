import { CURRENT_BACKUP_VERSION } from './schema'

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * v1 → v2: plans gain a manual `position` (existing plans keep their old order,
 * newest first), and habits arrive (empty collections). Anything malformed is left
 * alone for schema validation to reject.
 */
function v1ToV2(data: unknown): unknown {
  if (!isObject(data) || !Array.isArray(data.plans)) return data
  const plans = data.plans.filter(isObject)
  if (plans.length !== data.plans.length) return data
  const order = [...plans].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return {
    ...data,
    plans: plans.map((plan) => ({ ...plan, position: order.indexOf(plan) })),
    habits: data.habits ?? [],
    habitLogs: data.habitLogs ?? [],
  }
}

/**
 * Backup-format migrations, keyed by the version they upgrade FROM:
 * `MIGRATIONS[1]` turns a version-1 `data` object into version-2 shape.
 * Every supported older version needs an entry; unknown future versions are rejected.
 */
export const MIGRATIONS: Record<number, (data: unknown) => unknown> = {
  1: v1ToV2,
}

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
