import { useState } from 'react'
import { Link } from 'react-router'
import { useRepos } from '../../app/repos'
import { needsBackupReminder } from '../../domain/backupReminder'
import { addDays, nowIso } from '../../domain/dates'
import type { FadeStage } from '../../domain/fade'
import type { Preferences, TrackingSettings, UnsentMessage } from '../../domain/types'
import { isIosBrowserTab } from '../../hooks/useInstall'
import { t } from '../../i18n'
import { readJson, STORAGE_KEYS, writeJson } from '../../lib/storage'
import { useExport } from '../settings/useExport'

export function HomeNotices({
  today,
  readyLetters,
  preferences,
  settings,
  hasAnyData,
  stage,
}: {
  today: string
  readyLetters: UnsentMessage[]
  preferences: Preferences
  settings: TrackingSettings
  hasAnyData: boolean
  stage: FadeStage
}) {
  const repos = useRepos()
  const backup = useExport()
  const [installTipDismissed, setInstallTipDismissed] = useState(() => readJson<boolean>('localStorage', STORAGE_KEYS.installTipDismissed) === true)

  const showBackup = needsBackupReminder(preferences, settings, today, hasAnyData)
  const showInstallTip = !installTipDismissed && isIosBrowserTab()
  const showGraduation = stage === 'living' && !preferences.graduationDismissedAt

  return (
    <>
      {readyLetters.map((message) => (
        <section key={message.id} className="card flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm">{t('A letter you sealed is ready to read.')}</p>
          <Link to={`/unsent/${message.id}`} className="btn-secondary btn-sm">
            {t('Open it')}
          </Link>
        </section>
      ))}

      {showBackup && (
        <section className="card" aria-labelledby="backup-reminder">
          <p id="backup-reminder" className="text-sm">
            {preferences.lastBackupAt
              ? t('It has been a while since your last backup. Your entries live only on this device.')
              : t('You have not made a backup yet. Your entries live only on this device.')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-primary btn-sm" disabled={backup.busy} onClick={() => void backup.download()}>
              {t('Back up now')}
            </button>
            {backup.canShare && (
              <button type="button" className="btn-secondary btn-sm" disabled={backup.busy} onClick={() => void backup.share()}>
                {t('Share backup…')}
              </button>
            )}
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => void repos.preferences.update({ backupReminderSnoozedUntil: addDays(today, 7) })}
            >
              {t('Not now')}
            </button>
          </div>
        </section>
      )}

      {showInstallTip && (
        <section className="card text-sm">
          <p>
            {t('Tip: add Unsent to your Home Screen so Safari keeps your entries. Tap the Share button, then "Add to Home Screen".')}
          </p>
          <button
            type="button"
            className="link mt-2"
            onClick={() => {
              writeJson('localStorage', STORAGE_KEYS.installTipDismissed, true)
              setInstallTipDismissed(true)
            }}
          >
            {t('Got it')}
          </button>
        </section>
      )}

      {showGraduation && (
        <section className="card text-sm">
          <p className="font-serif text-lg text-ink">{t('You may not need Unsent every day anymore.')}</p>
          <p className="mt-1 text-muted">
            {t('That is a good sign. Make a backup, and come back whenever you feel like it — everything will be here.')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm" disabled={backup.busy} onClick={() => void backup.download()}>
              {t('Back up now')}
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => void repos.preferences.update({ graduationDismissedAt: nowIso() })}>
              {t('Dismiss')}
            </button>
          </div>
        </section>
      )}
    </>
  )
}
