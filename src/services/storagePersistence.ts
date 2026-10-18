export interface StorageStatus {
  supported: boolean
  persisted: boolean
  usageBytes?: number
  quotaBytes?: number
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
  if (!storage?.persisted) return { supported: false, persisted: false }
  try {
    const [persisted, estimate] = await Promise.all([storage.persisted(), storage.estimate?.()])
    return { supported: true, persisted, usageBytes: estimate?.usage, quotaBytes: estimate?.quota }
  } catch {
    return { supported: true, persisted: false }
  }
}

/** Asks the browser not to evict our data under storage pressure. It may say no. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return 'unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}
