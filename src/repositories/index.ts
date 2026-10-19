import { createDatabase, type UnsentDatabase } from '../db/database'
import { createCheckInsRepo } from './checkInsRepo'
import { createConnection } from './connection'
import { createDataRepo } from './dataRepo'
import { createHabitsRepo } from './habitsRepo'
import { createLifeLogRepo, createPlansRepo } from './lifeRepo'
import { createLockRepo } from './lockRepo'
import { createMessagesRepo } from './messagesRepo'
import { createPersonalItemsRepo } from './personalItemsRepo'
import { createPreferencesRepo } from './preferencesRepo'
import { createTrackingRepo } from './trackingRepo'
import { createTrashRepo } from './trashRepo'
import { createUrgesRepo } from './urgesRepo'
import { createExercisesRepo, createTrackersRepo, createVoiceNotesRepo } from './v2Repos'

export function createRepos(db: UnsentDatabase = createDatabase()) {
  return {
    connection: createConnection(db),
    tracking: createTrackingRepo(db),
    messages: createMessagesRepo(db),
    urges: createUrgesRepo(db),
    checkIns: createCheckInsRepo(db),
    personalItems: createPersonalItemsRepo(db),
    preferences: createPreferencesRepo(db),
    plans: createPlansRepo(db),
    lifeLog: createLifeLogRepo(db),
    trackers: createTrackersRepo(db),
    exercises: createExercisesRepo(db),
    voiceNotes: createVoiceNotesRepo(db),
    lock: createLockRepo(db),
    trash: createTrashRepo(db),
    habits: createHabitsRepo(db),
    data: createDataRepo(db),
  }
}

export type Repos = ReturnType<typeof createRepos>
