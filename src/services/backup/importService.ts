import { planMerge, type BackupData, type MergeSummary } from '../../domain/backup'
import type { Repos } from '../../repositories'
import { broadcast } from '../tabSync'

/** Computes what a merge would do, for the confirmation screen. Writes nothing. */
export async function previewMerge(repos: Repos, data: BackupData): Promise<MergeSummary> {
  const local = await repos.data.snapshot()
  return planMerge(local, data).summary
}

export async function mergeBackup(repos: Repos, data: BackupData): Promise<MergeSummary> {
  const plan = await repos.data.merge((local) => planMerge(local, data))
  broadcast('data-replaced')
  return plan.summary
}

export async function replaceWithBackup(repos: Repos, data: BackupData): Promise<void> {
  await repos.data.replaceAll(data)
  broadcast('data-replaced')
}
