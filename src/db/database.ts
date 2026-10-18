import { Dexie, type EntityTable } from 'dexie'
import type {
  DailyCheckIn,
  ExerciseEntry,
  Keyring,
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
} from '../domain/types'
import { EncryptionController, encryptionMiddleware } from './encryption'
import { applySchemaVersions } from './schema'

export const DEFAULT_DB_NAME = 'unsent'

export type UnsentDatabase = Dexie & {
  encryption: EncryptionController
  settings: EntityTable<TrackingSettings, 'id'>
  preferences: EntityTable<Preferences, 'id'>
  trackingHistory: EntityTable<TrackingHistory, 'id'>
  messages: EntityTable<UnsentMessage, 'id'>
  urges: EntityTable<UrgeEntry, 'id'>
  checkIns: EntityTable<DailyCheckIn, 'id'>
  personalItems: EntityTable<PersonalItem, 'id'>
  plans: EntityTable<Plan, 'id'>
  lifeLog: EntityTable<LifeLogEntry, 'id'>
  trackers: EntityTable<Tracker, 'id'>
  exerciseEntries: EntityTable<ExerciseEntry, 'id'>
  voiceNotes: EntityTable<VoiceNote, 'id'>
  keyring: EntityTable<Keyring, 'id'>
}

export function createDatabase(name: string = DEFAULT_DB_NAME): UnsentDatabase {
  const db = new Dexie(name) as UnsentDatabase
  applySchemaVersions(db)
  db.encryption = new EncryptionController()
  db.use(encryptionMiddleware(db.encryption))
  return db
}

/** Every table that holds user data; used by export and replace-import. (The keyring is not user data.) */
export function userTables(db: UnsentDatabase) {
  return [
    db.settings,
    db.preferences,
    db.trackingHistory,
    db.messages,
    db.urges,
    db.checkIns,
    db.personalItems,
    db.plans,
    db.lifeLog,
    db.trackers,
    db.exerciseEntries,
    db.voiceNotes,
  ]
}
