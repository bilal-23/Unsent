import type { z } from '../../lib/zod'
import { countRecords, type BackupData, type Collection } from '../../domain/backup'
import { MAX_BACKUP_BYTES } from '../../domain/constants'
import { asEncryptedEnvelope, type EncryptedEnvelope } from './encryptedBackup'
import { migrateBackupData, UnsupportedVersionError } from './migrations'
import { backupDataSchema, backupHeadSchema, CURRENT_BACKUP_VERSION } from './schema'

export interface ParsedBackup {
  schemaVersion: number
  exportedAt?: string
  data: BackupData
  counts: Record<Collection, number>
  hasSettings: boolean
}

export type ParseResult =
  | { ok: true; backup: ParsedBackup }
  | { ok: false; error: string; details?: string[]; encrypted?: EncryptedEnvelope }

const fail = (error: string, details?: string[]): ParseResult => ({ ok: false, error, details })

/** Describes schema problems by location only — never echoes the user's text. */
function describeIssues(error: z.ZodError): string[] {
  return error.issues.slice(0, 8).map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'file'
    return `${path}: ${issue.code.replace(/_/g, ' ')}`
  })
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

function duplicateProblems(data: BackupData): string[] {
  const problems: string[] = []
  const collections: [string, { id: string }[]][] = [
    ['messages', data.messages],
    ['urges', data.urges],
    ['checkIns', data.checkIns],
    ['trackingHistory', data.trackingHistory],
    ['personalItems', data.personalItems],
    ['plans', data.plans],
    ['lifeLog', data.lifeLog],
    ['trackers', data.trackers],
    ['exerciseEntries', data.exerciseEntries],
    ['voiceNotes', data.voiceNotes],
    ['habits', data.habits],
    ['habitLogs', data.habitLogs],
  ]
  for (const [name, records] of collections) {
    const duplicates = findDuplicates(records.map((r) => r.id))
    if (duplicates.length) problems.push(`${name}: ${duplicates.length} duplicate id(s), e.g. ${duplicates[0]}`)
  }
  const habitDays = findDuplicates(data.habitLogs.map((log) => `${log.habitId} ${log.localDate}`))
  if (habitDays.length) problems.push(`habitLogs: ${habitDays.length} habit day(s) logged twice`)
  const dates = findDuplicates(data.checkIns.map((c) => c.localDate))
  if (dates.length) problems.push(`checkIns: more than one check-in for ${dates.slice(0, 3).join(', ')}`)
  return problems
}

/** Validates backup text without touching storage. */
export function parseBackupText(text: string): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return fail('This file is not valid JSON.')
  }

  const encrypted = asEncryptedEnvelope(json)
  if (encrypted) return { ok: false, error: 'This backup is protected with a passphrase.', encrypted }

  const head = backupHeadSchema.safeParse(json)
  if (!head.success) return fail('This file is not an Unsent backup.')

  const { schemaVersion, exportedAt } = head.data
  if (schemaVersion > CURRENT_BACKUP_VERSION) {
    return fail('This backup was made by a newer version of Unsent. Update the app, then try again.')
  }

  let migrated: unknown
  try {
    migrated = migrateBackupData(head.data.data, schemaVersion)
  } catch (error) {
    if (error instanceof UnsupportedVersionError) return fail(`Backup version ${schemaVersion} is not supported.`)
    return fail('This backup could not be upgraded to the current format.')
  }

  const parsed = backupDataSchema.safeParse(migrated)
  if (!parsed.success) return fail('This backup is damaged or incomplete.', describeIssues(parsed.error))

  const duplicates = duplicateProblems(parsed.data)
  if (duplicates.length) return fail('This backup contains duplicate records.', duplicates)

  return {
    ok: true,
    backup: {
      schemaVersion,
      exportedAt,
      data: parsed.data,
      counts: countRecords(parsed.data),
      hasSettings: parsed.data.settings !== null,
    },
  }
}

export async function parseBackupFile(file: Blob): Promise<ParseResult> {
  if (file.size > MAX_BACKUP_BYTES) return fail('This file is too large to be an Unsent backup (limit 150 MB).')
  let text: string
  try {
    text = await file.text()
  } catch {
    return fail('The file could not be read.')
  }
  return parseBackupText(text)
}
