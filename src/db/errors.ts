import { Dexie } from 'dexie'

export type StorageErrorKind = 'quota' | 'unavailable' | 'closed' | 'conflict' | 'notFound' | 'locked' | 'unknown'

/** The only error type repositories throw. `current` carries the stored record on conflicts. */
export class StorageError<T = unknown> extends Error {
  readonly kind: StorageErrorKind
  readonly current?: T

  constructor(kind: StorageErrorKind, options: { cause?: unknown; current?: T } = {}) {
    super(STORAGE_ERROR_MESSAGES[kind], { cause: options.cause })
    this.name = 'StorageError'
    this.kind = kind
    this.current = options.current
  }
}

export const STORAGE_ERROR_MESSAGES: Record<StorageErrorKind, string> = {
  quota: 'Your device is out of storage space for this app.',
  unavailable: 'Browser storage is not available.',
  closed: 'The local database was closed. Reload the page to continue.',
  conflict: 'This entry was changed somewhere else.',
  notFound: 'This entry no longer exists.',
  locked: 'Unsent is locked. Unlock it to continue.',
  unknown: 'Something went wrong while saving.',
}

function errorName(value: unknown): string | undefined {
  return typeof value === 'object' && value !== null && 'name' in value ? String((value as { name: unknown }).name) : undefined
}

export function toStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) return error
  const name = errorName(error)
  const inner = typeof error === 'object' && error !== null && 'inner' in error ? errorName((error as { inner: unknown }).inner) : undefined

  if (name === Dexie.errnames.QuotaExceeded || name === 'QuotaExceededError' || inner === 'QuotaExceededError') {
    return new StorageError('quota', { cause: error })
  }
  if (name === Dexie.errnames.DatabaseClosed) return new StorageError('closed', { cause: error })
  if (
    name === Dexie.errnames.OpenFailed ||
    name === Dexie.errnames.MissingAPI ||
    name === Dexie.errnames.InvalidState ||
    name === Dexie.errnames.Upgrade ||
    name === 'SecurityError'
  ) {
    return new StorageError('unavailable', { cause: error })
  }
  return new StorageError('unknown', { cause: error })
}

/** Runs a storage operation, normalising any failure into a StorageError. */
export async function guard<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toStorageError(error)
  }
}
