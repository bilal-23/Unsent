/**
 * Domain entities. Field names follow PRD §8 with these additions:
 * - TrackingSettings: lastContactTime, note, journalName (PRD §5.2 optional fields),
 *   intentionDays (an optional, gentle no-contact intention — never a pass/fail challenge)
 * - UrgeEntry.updatedAt: needed so backup merges can pick the newer copy
 * - UnsentMessage.rev: internal optimistic-concurrency counter, never exported
 * - UnsentMessage.sealedUntil / sealedAt: "sealed letters"
 * - PersonalItem: "why I chose this" reasons and the personal coping list
 * - Plan / LifeLogEntry: the user's own plans and "good things" (focus on building a full life)
 * - Tracker: optional extra trackers beside no contact (same no-failure framing)
 * - ExerciseEntry: guided-program days and standalone exercises
 * - VoiceNote: spoken unsent messages; Photo: optional picture on a good thing
 *
 * Conventions: ids are crypto.randomUUID(); timestamps (`…At`) are ISO-8601 UTC;
 * calendar dates are local `YYYY-MM-DD` strings and are never parsed via `new Date(str)`.
 */

/** Local calendar date, `YYYY-MM-DD`. */
export type LocalDate = string
/** ISO-8601 UTC timestamp. */
export type IsoTimestamp = string

export const SINGLETON_ID = 'singleton'

export interface TrackingSettings {
  id: typeof SINGLETON_ID
  lastContactDate: LocalDate
  /** Optional `HH:mm`, shown for reference only; day counts use dates. */
  lastContactTime?: string
  note?: string
  journalName?: string
  /** Optional intention, e.g. 30 → "Day 12 of 30". Counted from lastContactDate. */
  intentionDays?: number
  timezone: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface TrackingHistory {
  id: string
  previousDate: LocalDate | null
  newDate: LocalDate
  changedAt: IsoTimestamp
  reason?: string
}

export type MessageStatus = 'draft' | 'archived'

export interface UnsentMessage {
  id: string
  title: string
  body: string
  status: MessageStatus
  tags: string[]
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
  sealedUntil?: LocalDate
  sealedAt?: IsoTimestamp
  /** Internal revision counter for cross-tab conflict detection. Not exported. */
  rev: number
}

export interface UrgeEntry {
  id: string
  intensity: number
  trigger?: string
  emotion?: string
  note?: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
  followUpIntensity?: number
  followUpAt?: IsoTimestamp
}

export interface DailyCheckIn {
  id: string
  localDate: LocalDate
  mood: number
  energy?: number
  reflection?: string
  personalWin?: string
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type PersonalItemKind = 'reason' | 'coping'

export interface PersonalItem {
  id: string
  kind: PersonalItemKind
  text: string
  position: number
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type PlanStatus = 'open' | 'done'

export interface Plan {
  id: string
  text: string
  status: PlanStatus
  doneAt?: IsoTimestamp
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface Photo {
  mimeType: string
  width: number
  height: number
  data: Uint8Array
}

export type LifeLogKind = 'idea' | 'moment'

/** A good thing the user did or noticed: a completed idea or a freeform moment. */
export interface LifeLogEntry {
  id: string
  kind: LifeLogKind
  /** Library id when kind is 'idea'. */
  ideaId?: string
  text: string
  localDate: LocalDate
  photo?: Photo
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface Tracker {
  id: string
  name: string
  startDate: LocalDate
  intentionDays?: number
  archived: boolean
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export type ExerciseKind = 'program-day' | 'thought-record' | 'values' | 'reality-check' | 'letting-go'

export interface ExerciseEntry {
  id: string
  kind: ExerciseKind
  programId?: string
  day?: number
  /** Free-form answers keyed by field id. */
  fields: Record<string, string>
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface VoiceNote {
  id: string
  title: string
  mimeType: string
  durationMs: number
  data: Uint8Array
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

/** App-lock key material. Not user data: never exported. */
export interface Keyring {
  id: typeof SINGLETON_ID
  version: 1
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: Uint8Array
  nonce: Uint8Array
  wrappedKey: Uint8Array
  createdAt: IsoTimestamp
}

export type ThemePreference = 'system' | 'light' | 'dark'
export type TextSize = 'sm' | 'md' | 'lg' | 'xl'
export type ReadingFont = 'serif' | 'sans'
export type HistorySort = 'updated' | 'created'

export interface Preferences {
  id: typeof SINGLETON_ID
  theme: ThemePreference
  defaultHistorySort: HistorySort
  /** PRD "optionalReflectionSettings": the in-session check-back after logging an urge. */
  reflectionReminderEnabled: boolean
  reflectionReminderMinutes: number
  showDayCount: boolean
  pauseSeconds: 60 | 90
  privacyCover: boolean
  showPrompts: boolean
  showIdeas: boolean
  /** Home gradually shifts focus from the counter to the user's own life. */
  fadeMode: boolean
  graduationDismissedAt?: IsoTimestamp
  /** Set whenever a backup file is created; drives the gentle backup reminder. */
  lastBackupAt?: IsoTimestamp
  backupReminderSnoozedUntil?: LocalDate
  textSize: TextSize
  readingFont: ReadingFont
  /** Opt-in look-backs at good things from a month / a year ago. */
  onThisDay: boolean
  /** App lock: lock after the app has been in the background this long. */
  autoLockMinutes: number
}

export const DEFAULT_PREFERENCES: Preferences = {
  id: SINGLETON_ID,
  theme: 'system',
  defaultHistorySort: 'updated',
  reflectionReminderEnabled: true,
  reflectionReminderMinutes: 20,
  showDayCount: true,
  pauseSeconds: 90,
  privacyCover: true,
  showPrompts: true,
  showIdeas: true,
  fadeMode: true,
  textSize: 'md',
  readingFont: 'serif',
  onThisDay: false,
  autoLockMinutes: 5,
}

/** Fills in any preference missing from storage or an older backup. */
export function preferencesWithDefaults(stored: Partial<Preferences> | null | undefined): Preferences {
  return { ...DEFAULT_PREFERENCES, ...stored, id: SINGLETON_ID }
}
