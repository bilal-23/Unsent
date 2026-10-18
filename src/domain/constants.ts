export const APP_ID = 'unsent'

export const TRIGGER_SUGGESTIONS = [
  'Loneliness',
  'Missing them',
  'Anger or frustration',
  'Wanting closure',
  'Seeing a reminder',
  'Checking social media',
  'A difficult day',
] as const

export const EMOTION_SUGGESTIONS = [
  'Sad',
  'Anxious',
  'Lonely',
  'Angry',
  'Restless',
  'Hopeful',
  'Numb',
  'Calm',
] as const

export const URGE_MIN = 1
export const URGE_MAX = 10
export const MOOD_MAX = 5

export const MOOD_LABELS: Record<number, string> = {
  1: 'Very low',
  2: 'Low',
  3: 'Okay',
  4: 'Good',
  5: 'Very good',
}

export const ENERGY_LABELS: Record<number, string> = {
  1: 'Drained',
  2: 'Low',
  3: 'Steady',
  4: 'Good',
  5: 'High',
}

/** Backups larger than this are refused before being read into memory (voice notes and photos make files large). */
export const MAX_BACKUP_BYTES = 150 * 1024 * 1024

export const INTENTION_PRESETS = [1, 3, 7, 14, 30, 60, 90] as const
export const MAX_INTENTION_DAYS = 3650

export const MAX_TEXT_LENGTH = 200_000
export const MAX_SHORT_TEXT_LENGTH = 2_000
