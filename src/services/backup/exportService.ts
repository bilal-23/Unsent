import type { BackupData, LocalSnapshot } from '../../domain/backup'
import { bytesReplacer } from '../../domain/bytes'
import { APP_ID } from '../../domain/constants'
import { toLocalDate } from '../../domain/dates'
import type { Repos } from '../../repositories'
import { encryptBackupJson } from './encryptedBackup'
import { CURRENT_BACKUP_VERSION, type BackupEnvelope } from './schema'

export function snapshotToBackupData(snapshot: LocalSnapshot): BackupData {
  return {
    settings: snapshot.settings ?? null,
    preferences: snapshot.preferences ?? null,
    trackingHistory: snapshot.trackingHistory,
    // Drop the internal revision counter.
    messages: snapshot.messages.map(({ rev: _rev, ...message }) => message),
    urges: snapshot.urges,
    checkIns: snapshot.checkIns,
    personalItems: snapshot.personalItems,
    plans: snapshot.plans,
    lifeLog: snapshot.lifeLog,
    trackers: snapshot.trackers,
    exerciseEntries: snapshot.exerciseEntries,
    voiceNotes: snapshot.voiceNotes,
  }
}

export function buildEnvelope(snapshot: LocalSnapshot, exportedAt = new Date()): BackupEnvelope {
  return {
    app: APP_ID,
    schemaVersion: CURRENT_BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    data: snapshotToBackupData(snapshot),
  }
}

export function backupFileName(date = new Date(), protectedFile = false): string {
  return `unsent-backup-${toLocalDate(date)}${protectedFile ? '-protected' : ''}.json`
}

/** JSON.stringify drops `undefined` optional fields; binary fields become base64. */
export function serializeEnvelope(envelope: BackupEnvelope): string {
  return JSON.stringify(envelope, bytesReplacer, 2)
}

/** Builds the backup file. With a passphrase, the whole file is encrypted. */
export async function createBackup(repos: Repos, passphrase?: string): Promise<{ fileName: string; json: string }> {
  const snapshot = await repos.data.snapshot()
  const json = serializeEnvelope(buildEnvelope(snapshot))
  if (!passphrase) return { fileName: backupFileName(), json }
  return { fileName: backupFileName(new Date(), true), json: await encryptBackupJson(json, passphrase) }
}

/** Saves text as a file through the browser's normal download flow. Nothing leaves the device. */
export function downloadText(fileName: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
