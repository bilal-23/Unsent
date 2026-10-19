import { z } from '../../lib/zod'
import type { BackupData } from '../../domain/backup'
import { APP_ID, MAX_INTENTION_DAYS } from '../../domain/constants'
import { base64ToBytes } from '../../domain/bytes'
import { isValidLocalDate } from '../../domain/dates'
import { preferencesWithDefaults, SINGLETON_ID } from '../../domain/types'

/** The backup format version written by this build. See docs/backup-format.md. */
export const CURRENT_BACKUP_VERSION = 2

const MAX_LONG_TEXT = 1_000_000
const MAX_SHORT_TEXT = 10_000

const id = z.uuid()
const timestamp = z.iso.datetime({ offset: true })
const localDate = z.string().refine(isValidLocalDate, 'Expected a calendar date in YYYY-MM-DD form')
const shortText = z.string().max(MAX_SHORT_TEXT)
const rating = (max: number) => z.number().int().min(1).max(max)
/** Binary data is stored as base64 in the JSON file. */
const bytes = z.base64().transform((value) => base64ToBytes(value))

export const trackingSettingsSchema = z.strictObject({
  id: z.literal(SINGLETON_ID),
  lastContactDate: localDate,
  lastContactTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  note: shortText.optional(),
  journalName: z.string().max(200).optional(),
  intentionDays: z.number().int().min(1).max(MAX_INTENTION_DAYS).optional(),
  timezone: z.string().max(100),
  createdAt: timestamp,
  updatedAt: timestamp,
})

const preferencesShape = z.strictObject({
  id: z.literal(SINGLETON_ID),
  theme: z.enum(['system', 'light', 'dark']),
  defaultHistorySort: z.enum(['updated', 'created']),
  reflectionReminderEnabled: z.boolean(),
  reflectionReminderMinutes: z.number().int().min(1).max(240),
  showDayCount: z.boolean(),
  pauseSeconds: z.union([z.literal(60), z.literal(90)]),
  privacyCover: z.boolean(),
  showPrompts: z.boolean(),
  showIdeas: z.boolean(),
  fadeMode: z.boolean(),
  graduationDismissedAt: timestamp.optional(),
  lastBackupAt: timestamp.optional(),
  backupReminderSnoozedUntil: localDate.optional(),
  textSize: z.enum(['sm', 'md', 'lg', 'xl']),
  readingFont: z.enum(['serif', 'sans']),
  onThisDay: z.boolean(),
  autoLockMinutes: z.number().int().min(0).max(1440),
  notifyCheckBack: z.boolean(),
})

/** Every preference is optional in a backup; missing ones get today's defaults. */
export const preferencesSchema = preferencesShape
  .partial()
  .required({ id: true })
  .transform((value) => preferencesWithDefaults(value))

export const trackingHistorySchema = z.strictObject({
  id,
  previousDate: localDate.nullable(),
  newDate: localDate,
  changedAt: timestamp,
  reason: shortText.optional(),
})

export const messageSchema = z.strictObject({
  id,
  title: z.string().max(1000),
  body: z.string().max(MAX_LONG_TEXT),
  status: z.enum(['draft', 'archived']),
  tags: z.array(z.string().max(100)).max(100),
  createdAt: timestamp,
  updatedAt: timestamp,
  sealedUntil: localDate.optional(),
  sealedAt: timestamp.optional(),
})

export const urgeSchema = z.strictObject({
  id,
  intensity: rating(10),
  trigger: z.string().max(200).optional(),
  emotion: z.string().max(200).optional(),
  note: shortText.optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
  followUpIntensity: rating(10).optional(),
  followUpAt: timestamp.optional(),
})

export const checkInSchema = z.strictObject({
  id,
  localDate,
  mood: rating(5),
  energy: rating(5).optional(),
  reflection: shortText.optional(),
  personalWin: shortText.optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
})

export const personalItemSchema = z.strictObject({
  id,
  kind: z.enum(['reason', 'coping']),
  text: z.string().min(1).max(1000),
  position: z.number().int().min(0),
  createdAt: timestamp,
  updatedAt: timestamp,
})

export const planSchema = z.strictObject({
  id,
  text: z.string().min(1).max(1000),
  status: z.enum(['open', 'done']),
  doneAt: timestamp.optional(),
  position: z.number().int(),
  createdAt: timestamp,
  updatedAt: timestamp,
})

export const photoSchema = z.strictObject({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  width: z.number().int().positive().max(10_000),
  height: z.number().int().positive().max(10_000),
  data: bytes,
})

export const lifeLogSchema = z.strictObject({
  id,
  kind: z.enum(['idea', 'moment']),
  ideaId: z.string().max(100).optional(),
  text: z.string().min(1).max(MAX_SHORT_TEXT),
  localDate,
  photo: photoSchema.optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
})

export const trackerSchema = z.strictObject({
  id,
  name: z.string().min(1).max(200),
  startDate: localDate,
  intentionDays: z.number().int().min(1).max(MAX_INTENTION_DAYS).optional(),
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
})

export const exerciseEntrySchema = z.strictObject({
  id,
  kind: z.enum(['program-day', 'thought-record', 'values', 'reality-check', 'letting-go']),
  programId: z.string().max(100).optional(),
  day: z.number().int().min(1).max(366).optional(),
  fields: z.record(z.string().max(100), z.string().max(MAX_LONG_TEXT)),
  createdAt: timestamp,
  updatedAt: timestamp,
})

export const voiceNoteSchema = z.strictObject({
  id,
  title: z.string().max(1000),
  mimeType: z.string().regex(/^audio\/[\w.+-]+(;.*)?$/).max(200),
  durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
  data: bytes,
  createdAt: timestamp,
  updatedAt: timestamp,
})

export const habitSchema = z.strictObject({
  id,
  name: z.string().min(1).max(200),
  targetPerWeek: z.number().int().min(1).max(7),
  position: z.number().int(),
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
})

export const habitLogSchema = z.strictObject({
  id,
  habitId: id,
  localDate,
  createdAt: timestamp,
})

export const backupDataSchema = z.strictObject({
  settings: trackingSettingsSchema.nullable(),
  preferences: preferencesSchema.nullable(),
  trackingHistory: z.array(trackingHistorySchema),
  messages: z.array(messageSchema),
  urges: z.array(urgeSchema),
  checkIns: z.array(checkInSchema),
  personalItems: z.array(personalItemSchema),
  plans: z.array(planSchema),
  lifeLog: z.array(lifeLogSchema),
  trackers: z.array(trackerSchema),
  exerciseEntries: z.array(exerciseEntrySchema),
  voiceNotes: z.array(voiceNoteSchema),
  // Default to empty: early version-2 files (before habits) are still valid.
  habits: z.array(habitSchema).default([]),
  habitLogs: z.array(habitLogSchema).default([]),
}) satisfies z.ZodType<BackupData, unknown>

/** Just enough to identify the file and its version, before migrating. */
export const backupHeadSchema = z.object({
  app: z.literal(APP_ID),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.string().optional(),
  data: z.unknown(),
})

export const backupEnvelopeSchema = z.strictObject({
  app: z.literal(APP_ID),
  schemaVersion: z.literal(CURRENT_BACKUP_VERSION),
  exportedAt: timestamp,
  data: backupDataSchema,
})

export interface BackupEnvelope {
  app: typeof APP_ID
  schemaVersion: typeof CURRENT_BACKUP_VERSION
  exportedAt: string
  data: BackupData
}
