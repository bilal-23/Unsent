/** Web Share API with files (iOS/Android share sheet → AirDrop, Files, Drive…). */
export function canShareFiles(): boolean {
  try {
    if (typeof navigator === 'undefined' || !navigator.canShare) return false
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' })
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

/** Returns false if the user cancelled the share sheet. */
export async function shareBackupFile(fileName: string, json: string): Promise<boolean> {
  const file = new File([json], fileName, { type: 'application/json' })
  try {
    await navigator.share({ files: [file], title: 'Unsent backup' })
    return true
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return false
    throw error
  }
}
