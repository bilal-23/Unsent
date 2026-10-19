import type {
  DailyCheckIn,
  ExerciseEntry,
  Habit,
  HabitLog,
  LifeLogEntry,
  PersonalItem,
  Plan,
  Preferences,
  Tracker,
  TrackingHistory,
  TrackingSettings,
  UnsentMessage,
  UrgeEntry,
  VoiceNote,
} from './types'

/** A message as it appears in a backup file: the internal `rev` counter is dropped. */
export type ExportedMessage = Omit<UnsentMessage, 'rev'>

/** The `data` section of a backup file (schemaVersion 1). */
export interface BackupData {
  settings: TrackingSettings | null
  preferences: Preferences | null
  trackingHistory: TrackingHistory[]
  messages: ExportedMessage[]
  urges: UrgeEntry[]
  checkIns: DailyCheckIn[]
  personalItems: PersonalItem[]
  plans: Plan[]
  lifeLog: LifeLogEntry[]
  trackers: Tracker[]
  exerciseEntries: ExerciseEntry[]
  voiceNotes: VoiceNote[]
  habits: Habit[]
  habitLogs: HabitLog[]
}

/** Everything currently stored on this device. */
export interface LocalSnapshot {
  settings: TrackingSettings | undefined
  preferences: Preferences | undefined
  trackingHistory: TrackingHistory[]
  messages: UnsentMessage[]
  urges: UrgeEntry[]
  checkIns: DailyCheckIn[]
  personalItems: PersonalItem[]
  plans: Plan[]
  lifeLog: LifeLogEntry[]
  trackers: Tracker[]
  exerciseEntries: ExerciseEntry[]
  voiceNotes: VoiceNote[]
  habits: Habit[]
  habitLogs: HabitLog[]
}

export const COLLECTIONS = ['messages', 'urges', 'checkIns', 'trackingHistory', 'personalItems', 'plans', 'lifeLog', 'trackers', 'exerciseEntries', 'voiceNotes', 'habits', 'habitLogs'] as const
export type Collection = (typeof COLLECTIONS)[number]

export const COLLECTION_LABELS: Record<Collection, string> = {
  messages: 'Unsent messages',
  urges: 'Urge entries',
  checkIns: 'Daily check-ins',
  trackingHistory: 'Tracking date changes',
  personalItems: 'Reasons and coping ideas',
  plans: 'Plans',
  lifeLog: 'Good things',
  trackers: 'Other trackers',
  exerciseEntries: 'Exercises and program days',
  voiceNotes: 'Voice notes',
  habits: 'Habits',
  habitLogs: 'Habit check-offs',
}

export interface MergeCounts {
  added: number
  updated: number
  unchanged: number
}

export type MergeSummary = Record<Collection | 'settings', MergeCounts>

export interface MergePlan {
  put: {
    settings?: TrackingSettings
    preferences?: Preferences
    trackingHistory: TrackingHistory[]
    messages: UnsentMessage[]
    urges: UrgeEntry[]
    checkIns: DailyCheckIn[]
    personalItems: PersonalItem[]
    plans: Plan[]
    lifeLog: LifeLogEntry[]
    trackers: Tracker[]
    exerciseEntries: ExerciseEntry[]
    voiceNotes: VoiceNote[]
    habits: Habit[]
    habitLogs: HabitLog[]
  }
  deleteCheckInIds: string[]
  summary: MergeSummary
}

export function countRecords(data: BackupData | LocalSnapshot): Record<Collection, number> {
  return {
    messages: data.messages.length,
    urges: data.urges.length,
    checkIns: data.checkIns.length,
    trackingHistory: data.trackingHistory.length,
    personalItems: data.personalItems.length,
    plans: data.plans.length,
    lifeLog: data.lifeLog.length,
    trackers: data.trackers.length,
    exerciseEntries: data.exerciseEntries.length,
    voiceNotes: data.voiceNotes.length,
    habits: data.habits.length,
    habitLogs: data.habitLogs.length,
  }
}

const time = (iso: string) => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}
/** True when `incoming` is strictly newer; ties keep the local copy. */
const isNewer = (incoming: { updatedAt: string }, local: { updatedAt: string }) => time(incoming.updatedAt) > time(local.updatedAt)

const emptyCounts = (): MergeCounts => ({ added: 0, updated: 0, unchanged: 0 })

function mergeById<T extends { id: string; updatedAt: string }>(local: T[], incoming: T[], counts: MergeCounts, out: T[]) {
  const byId = new Map(local.map((r) => [r.id, r]))
  for (const record of incoming) {
    const existing = byId.get(record.id)
    if (!existing) {
      counts.added++
      out.push(record)
    } else if (isNewer(record, existing)) {
      counts.updated++
      out.push(record)
    } else {
      counts.unchanged++
    }
  }
}

/**
 * Merge rules:
 * - Same id: the copy with the newer `updatedAt` wins; ties keep local.
 * - Overwritten messages get `rev` bumped so an open editor sees a conflict.
 * - Tracking history is append-only by id.
 * - Check-ins are unique per local date: on a date collision with a different id,
 *   the newer check-in wins and the other is removed.
 * - Settings: newer wins. Preferences: local wins (only filled in if missing).
 * - Habit check-offs are a union (one per habit per day).
 * Records are never duplicated: every write is keyed by the incoming record's id.
 */
export function planMerge(local: LocalSnapshot, incoming: BackupData): MergePlan {
  const summary: MergeSummary = {
    settings: emptyCounts(),
    messages: emptyCounts(),
    urges: emptyCounts(),
    checkIns: emptyCounts(),
    trackingHistory: emptyCounts(),
    personalItems: emptyCounts(),
    plans: emptyCounts(),
    lifeLog: emptyCounts(),
    trackers: emptyCounts(),
    exerciseEntries: emptyCounts(),
    voiceNotes: emptyCounts(),
    habits: emptyCounts(),
    habitLogs: emptyCounts(),
  }
  const plan: MergePlan = {
    put: { trackingHistory: [], messages: [], urges: [], checkIns: [], personalItems: [], plans: [], lifeLog: [], trackers: [], exerciseEntries: [], voiceNotes: [], habits: [], habitLogs: [] },
    deleteCheckInIds: [],
    summary,
  }

  if (incoming.settings) {
    if (!local.settings) {
      summary.settings.added++
      plan.put.settings = incoming.settings
    } else if (isNewer(incoming.settings, local.settings)) {
      summary.settings.updated++
      plan.put.settings = incoming.settings
    } else {
      summary.settings.unchanged++
    }
  }
  if (incoming.preferences && !local.preferences) plan.put.preferences = incoming.preferences

  const localMessages = new Map(local.messages.map((m) => [m.id, m]))
  for (const message of incoming.messages) {
    const existing = localMessages.get(message.id)
    if (!existing) {
      summary.messages.added++
      plan.put.messages.push({ ...message, rev: 0 })
    } else if (isNewer(message, existing)) {
      summary.messages.updated++
      plan.put.messages.push({ ...message, rev: existing.rev + 1 })
    } else {
      summary.messages.unchanged++
    }
  }

  mergeById(local.urges, incoming.urges, summary.urges, plan.put.urges)
  mergeById(local.personalItems, incoming.personalItems, summary.personalItems, plan.put.personalItems)
  mergeById(local.plans, incoming.plans, summary.plans, plan.put.plans)
  mergeById(local.lifeLog, incoming.lifeLog, summary.lifeLog, plan.put.lifeLog)
  mergeById(local.trackers, incoming.trackers, summary.trackers, plan.put.trackers)
  mergeById(local.exerciseEntries, incoming.exerciseEntries, summary.exerciseEntries, plan.put.exerciseEntries)
  mergeById(local.voiceNotes, incoming.voiceNotes, summary.voiceNotes, plan.put.voiceNotes)
  mergeById(local.habits, incoming.habits, summary.habits, plan.put.habits)

  // Habit check-offs are a union: a day done on either device counts as done.
  const localLogIds = new Set(local.habitLogs.map((log) => log.id))
  const localLogDays = new Set(local.habitLogs.map((log) => `${log.habitId}|${log.localDate}`))
  for (const log of incoming.habitLogs) {
    const day = `${log.habitId}|${log.localDate}`
    if (localLogIds.has(log.id) || localLogDays.has(day)) {
      summary.habitLogs.unchanged++
      continue
    }
    localLogDays.add(day)
    summary.habitLogs.added++
    plan.put.habitLogs.push(log)
  }

  const localHistoryIds = new Set(local.trackingHistory.map((h) => h.id))
  for (const entry of incoming.trackingHistory) {
    if (localHistoryIds.has(entry.id)) {
      summary.trackingHistory.unchanged++
    } else {
      summary.trackingHistory.added++
      plan.put.trackingHistory.push(entry)
    }
  }

  const localById = new Map(local.checkIns.map((c) => [c.id, c]))
  const localByDate = new Map(local.checkIns.map((c) => [c.localDate, c]))
  for (const checkIn of incoming.checkIns) {
    const sameId = localById.get(checkIn.id)
    const sameDate = localByDate.get(checkIn.localDate)
    const dateOwner = sameDate && sameDate.id !== checkIn.id ? sameDate : undefined

    if (sameId && !isNewer(checkIn, sameId)) {
      summary.checkIns.unchanged++
      continue
    }
    if (dateOwner && !isNewer(checkIn, dateOwner)) {
      // A different, newer-or-equal local check-in already covers this date.
      summary.checkIns.unchanged++
      continue
    }
    if (dateOwner) plan.deleteCheckInIds.push(dateOwner.id)
    if (sameId || dateOwner) summary.checkIns.updated++
    else summary.checkIns.added++
    plan.put.checkIns.push(checkIn)
  }

  return plan
}
