import { useLiveQuery } from 'dexie-react-hooks'
import { useRepos } from '../app/repos'
import type { LocalDate, PersonalItemKind } from '../domain/types'

/**
 * Live views over local data. They re-render when the data changes in this tab
 * or any other tab. `undefined` means "still loading".
 */

/**
 * Wraps a single-record lookup so "loading" (undefined) differs from "not found"
 * ({ value: undefined }). When `key` changes, useLiveQuery can briefly return the
 * previous key's result; that stale result is hidden (reported as loading).
 */
function useLiveRecord<T>(key: string, query: () => Promise<T | undefined>, deps: unknown[]) {
  const result = useLiveQuery(async () => ({ key, value: await query() }), [key, ...deps])
  return result && result.key === key ? { value: result.value } : undefined
}

export function useSettings() {
  const repos = useRepos()
  return useLiveRecord('settings', () => repos.tracking.get(), [repos])
}

export function useTrackingHistory() {
  const repos = useRepos()
  return useLiveQuery(() => repos.tracking.history(), [repos])
}

export function usePreferences() {
  const repos = useRepos()
  return useLiveQuery(() => repos.preferences.get(), [repos])
}

export function useMessages() {
  const repos = useRepos()
  return useLiveQuery(() => repos.messages.list(), [repos])
}

/**
 * The result carries the id it was loaded for: when `id` changes, the previous
 * result can briefly be returned until the new query settles.
 */
export function useMessage(id: string | null) {
  const repos = useRepos()
  return useLiveQuery(async () => ({ id, value: id ? await repos.messages.get(id) : undefined }), [repos, id])
}

export function useUrges() {
  const repos = useRepos()
  return useLiveQuery(() => repos.urges.list(), [repos])
}

export function useUrge(id: string | undefined) {
  const repos = useRepos()
  return useLiveRecord(id ?? '', async () => (id ? repos.urges.get(id) : undefined), [repos])
}

export function useCheckIns() {
  const repos = useRepos()
  return useLiveQuery(() => repos.checkIns.list(), [repos])
}

export function useCheckInForDate(localDate: LocalDate) {
  const repos = useRepos()
  return useLiveRecord(localDate, () => repos.checkIns.getByDate(localDate), [repos])
}

export function usePersonalItems(kind: PersonalItemKind) {
  const repos = useRepos()
  return useLiveQuery(() => repos.personalItems.list(kind), [repos, kind])
}

export function usePlans() {
  const repos = useRepos()
  return useLiveQuery(() => repos.plans.list(), [repos])
}

export function useLifeLog() {
  const repos = useRepos()
  return useLiveQuery(() => repos.lifeLog.list(), [repos])
}

export function useTrackers() {
  const repos = useRepos()
  return useLiveQuery(() => repos.trackers.list(), [repos])
}

export function useExerciseEntries() {
  const repos = useRepos()
  return useLiveQuery(() => repos.exercises.list(), [repos])
}

export function useVoiceNotes() {
  const repos = useRepos()
  return useLiveQuery(() => repos.voiceNotes.list(), [repos])
}
