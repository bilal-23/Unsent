import { useState } from 'react'
import { useRepos } from '../../app/repos'
import { useToast } from '../../components/Toaster'
import { nowIso } from '../../domain/dates'
import { t } from '../../i18n'
import { createBackup, downloadText } from '../../services/backup/exportService'
import { shareBackupFile, canShareFiles } from '../../services/backup/shareBackup'

export function useExport() {
  const repos = useRepos()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const run = async (mode: 'download' | 'share', passphrase?: string) => {
    setBusy(true)
    try {
      const { fileName, json } = await createBackup(repos, passphrase)
      if (mode === 'share') {
        const shared = await shareBackupFile(fileName, json)
        if (!shared) return
      } else {
        downloadText(fileName, json)
      }
      await repos.preferences.update({ lastBackupAt: nowIso(), backupReminderSnoozedUntil: undefined })
      toast(mode === 'share' ? t('Backup shared.') : t('Backup saved to your downloads.'))
    } catch {
      toast(t('The backup could not be created.'))
    } finally {
      setBusy(false)
    }
  }

  return {
    busy,
    download: (passphrase?: string) => run('download', passphrase),
    share: (passphrase?: string) => run('share', passphrase),
    canShare: canShareFiles(),
  }
}
