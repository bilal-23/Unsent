import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useRepos } from '../../app/repos'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { SupportNote } from '../../components/SupportNote'
import { useToast } from '../../components/Toaster'
import { daysBetween, formatLocalDate, formatTimestamp, localDateOf } from '../../domain/dates'
import type { Preferences } from '../../domain/types'
import { usePreferences, useSettings, useTrashCount } from '../../hooks/useData'
import { isIosBrowserTab, isStandalone, useInstallPrompt } from '../../hooks/useInstall'
import { useToday } from '../../hooks/useToday'
import { t, tp } from '../../i18n'
import { clearAppKeys } from '../../lib/storage'
import { formatBytes, getStorageStatus, requestPersistentStorage, type StorageStatus } from '../../services/storagePersistence'
import { broadcast } from '../../services/tabSync'
import { DateChangeDialog } from '../dashboard/DateChangeDialog'
import { useLock } from '../lock/LockGate'
import { IntentionDialog } from '../dashboard/IntentionDialog'
import { ImportFlow } from './ImportFlow'
import { ListEditor } from './ListsEditor'
import { LockSettings } from './LockSettings'
import { useExport } from './useExport'

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-6 space-y-4" aria-labelledby={`${id ?? title}-heading`}>
      <h2 id={`${id ?? title}-heading`} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="hint block">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)] after:absolute after:start-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-surface after:shadow after:transition-transform peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5"
      />
    </label>
  )
}

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([option, text]) => (
          <button key={String(option)} type="button" className={`chip ${value === option ? 'chip-selected' : ''}`} aria-pressed={value === option} onClick={() => onChange(option)}>
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function BackupSection({ preferences }: { preferences: Preferences }) {
  const backup = useExport()
  const today = useToday()
  const [protect, setProtect] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const passphraseOk = !protect || (passphrase.length >= 8 && passphrase === confirm)
  const lastBackup = preferences.lastBackupAt
  const days = lastBackup ? daysBetween(localDateOf(lastBackup), today) : null

  return (
    <Section id="backup" title={t('Backup and restore')}>
      <p className="text-sm">
        {lastBackup
          ? tp(days ?? 0, { zero: 'Last backup: today', one: 'Last backup: {count} day ago', other: 'Last backup: {count} days ago' })
          : t('Last backup: never')}
        {lastBackup && <span className="text-muted"> ({formatTimestamp(lastBackup, { dateStyle: 'medium' })})</span>}
      </p>
      <p className="hint">
        {t('A backup is a single file with all your entries. Your browser saves it to its usual downloads location — keep it somewhere safe, and use it to move Unsent to a new device.')}
      </p>
      <Toggle
        label={t('Protect the backup with a passphrase')}
        hint={t('Without the passphrase, the file cannot be opened. There is no recovery.')}
        checked={protect}
        onChange={setProtect}
      />
      {protect && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">{t('Backup passphrase')}</span>
            <input type="password" className="field" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="block">
            <span className="label">{t('Repeat passphrase')}</span>
            <input type="password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </label>
          <p className="hint sm:col-span-2">{t('At least 8 characters.')}</p>
        </div>
      )}
      {!protect && <p className="hint">{t('An unprotected backup is readable by anyone who opens the file.')}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={backup.busy || !passphraseOk} onClick={() => void backup.download(protect ? passphrase : undefined)}>
          <Icon name="download" />
          {t('Download backup')}
        </button>
        {backup.canShare && (
          <button type="button" className="btn-secondary" disabled={backup.busy || !passphraseOk} onClick={() => void backup.share(protect ? passphrase : undefined)}>
            <Icon name="share" />
            {t('Share backup…')}
          </button>
        )}
      </div>
      <div className="border-t border-line pt-4">
        <h3 className="font-medium">{t('Restore from a backup')}</h3>
        <p className="hint mb-3">{t('Nothing changes until you review the backup and confirm.')}</p>
        <ImportFlow />
      </div>
    </Section>
  )
}

function StorageSection() {
  const [status, setStatus] = useState<StorageStatus | null>(null)
  const install = useInstallPrompt()
  const refresh = () => {
    void getStorageStatus().then(setStatus)
  }
  useEffect(() => {
    void getStorageStatus().then(setStatus)
  }, [])

  return (
    <Section title={t('Storage on this device')}>
      {status?.supported ? (
        <>
          <p className="text-sm">
            {status.persisted
              ? t('Your browser has agreed to keep Unsent’s data even when space runs low.')
              : t('Your browser may clear Unsent’s data if the device runs low on space.')}
          </p>
          {status.usageBytes !== undefined && <p className="hint">{t('Using about {size}.', { size: formatBytes(status.usageBytes) })}</p>}
          {!status.persisted && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={async () => {
                await requestPersistentStorage()
                refresh()
              }}
            >
              {t('Ask to keep data')}
            </button>
          )}
        </>
      ) : (
        <p className="hint">{t('This browser does not report storage details.')}</p>
      )}
      {!isStandalone() && install.available && (
        <button type="button" className="btn-secondary btn-sm" onClick={() => void install.install()}>
          {t('Install Unsent as an app')}
        </button>
      )}
      {isIosBrowserTab() && <p className="hint">{t('On iPhone and iPad, add Unsent to your Home Screen (Share → Add to Home Screen) so Safari keeps your entries.')}</p>}
    </Section>
  )
}

export function Settings() {
  const repos = useRepos()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const settings = useSettings()?.value
  const preferences = usePreferences()
  const [dateDialog, setDateDialog] = useState<'contact' | 'correct' | null>(null)
  const [intentionOpen, setIntentionOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [journalName, setJournalName] = useState<string | null>(null)
  const { refresh: refreshLock } = useLock()
  const trashCount = useTrashCount()

  useEffect(() => {
    if (!location.hash) return
    document.getElementById(location.hash.slice(1))?.scrollIntoView()
  }, [location.hash, preferences])

  if (!preferences || !settings) return <p className="hint">{t('Loading…')}</p>
  const set = (patch: Partial<Preferences>) => void repos.preferences.update(patch)

  return (
    <div className="space-y-4">
      <PageHeader title={t('Settings')} helpId="settings" />

      <Section title={t('No contact')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t('Last contact')}</p>
            <p className="hint">
              {formatLocalDate(settings.lastContactDate, { dateStyle: 'long' })}
              {settings.lastContactTime && ` · ${settings.lastContactTime}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={() => setDateDialog('correct')}>
              {t('Edit date')}
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setDateDialog('contact')}>
              {t('I had contact')}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{t('Intention')}</p>
            <p className="hint">{settings.intentionDays ? tp(settings.intentionDays, { one: '{count} day', other: '{count} days' }) : t('None')}</p>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setIntentionOpen(true)}>
            {t('Change')}
          </button>
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            await repos.tracking.updateDetails({ journalName: journalName ?? settings.journalName, note: settings.note })
            setJournalName(null)
            toast(t('Saved.'))
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="label">{t('Journal name')}</span>
            <input className="field" value={journalName ?? settings.journalName ?? ''} maxLength={60} placeholder={t('My journal')} onChange={(e) => setJournalName(e.target.value)} />
          </label>
          {journalName !== null && (
            <button type="submit" className="btn-secondary">
              {t('Save')}
            </button>
          )}
        </form>
        <Link to="/trackers" className="link inline-block text-sm">
          {t('Other trackers')}
        </Link>
      </Section>

      <Section id="lists" title={t('Your lists')}>
        <ListEditor kind="reason" />
        <ListEditor kind="coping" />
      </Section>

      <Section title={t('Home and reminders')}>
        <Toggle label={t('Show the day count on Home')} checked={preferences.showDayCount} onChange={(v) => set({ showDayCount: v })} />
        <Toggle
          label={t('Shift Home towards your life over time')}
          hint={t('After a couple of weeks, Home leads with ideas, plans and good things, and the count gets quieter.')}
          checked={preferences.fadeMode}
          onChange={(v) => set({ fadeMode: v })}
        />
        <Toggle label={t('Show an idea for today')} checked={preferences.showIdeas} onChange={(v) => set({ showIdeas: v })} />
        <Toggle label={t('Offer writing prompts')} checked={preferences.showPrompts} onChange={(v) => set({ showPrompts: v })} />
        <Toggle
          label={t('On this day')}
          hint={t('Occasionally show good things from a month or a year ago. Never messages or urges.')}
          checked={preferences.onThisDay}
          onChange={(v) => set({ onThisDay: v })}
        />
        <Toggle
          label={t('Offer to check back after an urge')}
          hint={t('Shown only while Unsent is open. No notifications.')}
          checked={preferences.reflectionReminderEnabled}
          onChange={(v) => set({ reflectionReminderEnabled: v })}
        />
        {preferences.reflectionReminderEnabled && (
          <Choice
            label={t('Check back after')}
            value={preferences.reflectionReminderMinutes}
            options={[5, 10, 20, 30, 60].map((m) => [m, tp(m, { one: '{count} minute', other: '{count} minutes' })])}
            onChange={(v) => set({ reflectionReminderMinutes: v })}
          />
        )}
        <Choice label={t('Pause length')} value={preferences.pauseSeconds} options={[[60, t('60 seconds')], [90, t('90 seconds')]]} onChange={(v) => set({ pauseSeconds: v })} />
        <Link to="/reminders" className="btn-secondary w-full justify-between sm:w-auto">
          <span>{t('Calendar reminders and notifications')}</span>
          <Icon name="back" className="size-4 rotate-180 rtl:rotate-0" />
        </Link>
      </Section>

      <Section title={t('Appearance')}>
        <Choice label={t('Theme')} value={preferences.theme} options={[['system', t('System')], ['light', t('Light')], ['dark', t('Dark')]]} onChange={(v) => set({ theme: v })} />
        <Choice
          label={t('Text size')}
          value={preferences.textSize}
          options={[['sm', t('Small')], ['md', t('Default')], ['lg', t('Large')], ['xl', t('Larger')]]}
          onChange={(v) => set({ textSize: v })}
        />
        <Choice label={t('Writing font')} value={preferences.readingFont} options={[['serif', t('Serif')], ['sans', t('Sans-serif')]]} onChange={(v) => set({ readingFont: v })} />
        <Choice
          label={t('Sort messages by')}
          value={preferences.defaultHistorySort}
          options={[['updated', t('Recently edited')], ['created', t('Recently created')]]}
          onChange={(v) => set({ defaultHistorySort: v })}
        />
      </Section>

      <Section id="privacy" title={t('Privacy and security')}>
        <Toggle
          label={t('Hide content when switching apps')}
          hint={t('Covers the screen when Unsent is in the background. Some browsers take the app-switcher snapshot first, so this is best effort.')}
          checked={preferences.privacyCover}
          onChange={(v) => set({ privacyCover: v })}
        />
        <div className="border-t border-line pt-4">
          <h3 className="mb-2 font-medium">{t('App lock')}</h3>
          <LockSettings preferences={preferences} />
        </div>
        <Link to="/privacy" className="link inline-block text-sm">
          {t('How your data is stored')}
        </Link>
      </Section>

      <BackupSection preferences={preferences} />
      <StorageSection />

      <Section title={t('Delete data')}>
        <p className="hint">{t('Delete individual entries from their own screens, or remove everything here.')}</p>
        <Link to="/deleted" className="btn-secondary w-full justify-between sm:w-auto">
          <span>{t('Recently deleted')}</span>
          {!!trashCount && <span className="text-xs text-muted tabular-nums">{trashCount}</span>}
        </Link>
        <button type="button" className="btn-danger" onClick={() => setConfirmClear(true)}>
          {t('Delete all data on this device')}
        </button>
      </Section>

      <Section title={t('About')}>
        <p className="text-sm">
          Unsent {__APP_VERSION__} · {t('No account. No server. No tracking.')}
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Link to="/help" className="link">
            {t('Help: what each feature does')}
          </Link>
          <Link to="/patterns" className="link">
            {t('See patterns')}
          </Link>
        </div>
        <SupportNote />
      </Section>

      <DateChangeDialog open={dateDialog !== null} mode={dateDialog ?? 'contact'} settings={settings} onClose={() => setDateDialog(null)} />
      <IntentionDialog open={intentionOpen} current={settings.intentionDays} onClose={() => setIntentionOpen(false)} />
      <ConfirmDialog
        open={confirmClear}
        title={t('Delete all data?')}
        confirmLabel={t('Delete everything')}
        danger
        requireText="DELETE"
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          await repos.data.clearAll()
          await repos.lock.init()
          refreshLock()
          clearAppKeys()
          broadcast('data-wiped')
          setConfirmClear(false)
          navigate('/welcome', { replace: true })
        }}
      >
        <p>{t('Every message, urge, check-in, plan and setting stored in Unsent on this device — including Recently deleted — will be permanently deleted. This cannot be undone.')}</p>
        <p>{t('Backup files you have already downloaded are not affected — they stay wherever you saved them.')}</p>
      </ConfirmDialog>
    </div>
  )
}
