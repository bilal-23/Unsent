import { useCallback } from 'react'
import { useRepos } from '../app/repos'
import { useToast } from '../components/Toaster'
import { StorageError } from '../db/errors'
import { t } from '../i18n'

/**
 * Deleting moves an entry to "Recently deleted" and offers Undo, instead of asking
 * "Are you sure?" first. Resolves to true once the entry has been moved.
 */
export function useDeleteWithUndo() {
  const repos = useRepos()
  const toast = useToast()

  return useCallback(
    async (remove: () => Promise<string | null>, message: string = t('Moved to Recently deleted.')) => {
      let trashId: string | null
      try {
        trashId = await remove()
      } catch {
        toast(t('Something went wrong. Nothing was deleted.'))
        return false
      }
      if (!trashId) return true
      toast(message, {
        action: {
          label: t('Undo'),
          onAction: () => {
            repos.trash
              .restore(trashId)
              .then(() => toast(t('Restored.')))
              .catch((error: unknown) =>
                toast(
                  error instanceof StorageError && error.kind === 'conflict'
                    ? t('It could not be restored because something else is in its place.')
                    : t('It could not be restored. You can find it in Recently deleted.'),
                ),
              )
          },
        },
      })
      return true
    },
    [repos, toast],
  )
}
