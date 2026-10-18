import { useState } from 'react'
import { useRepos } from '../../app/repos'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { t } from '../../i18n'
import { clearAppKeys } from '../../lib/storage'
import { WrongPassphraseError } from '../../repositories/lockRepo'
import { broadcast } from '../../services/tabSync'

export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const repos = useRepos()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [confirmErase, setConfirmErase] = useState(false)

  const unlock = async () => {
    setBusy(true)
    setError(null)
    try {
      await repos.lock.unlock(passphrase)
      setPassphrase('')
      onUnlocked()
    } catch (e) {
      setError(e instanceof WrongPassphraseError ? t('That passphrase did not work. Try again.') : t('Unsent could not be unlocked.'))
    } finally {
      setBusy(false)
    }
  }

  const erase = async () => {
    await repos.data.clearAll()
    clearAppKeys()
    await repos.lock.init()
    broadcast('data-wiped')
    window.location.hash = '#/welcome'
    onUnlocked()
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-6 flex items-center gap-2 text-muted">
        <Icon name="lock" />
        <span className="font-serif text-2xl text-ink">Unsent</span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void unlock()
        }}
      >
        <label className="block">
          <span className="label">{t('Passphrase')}</span>
          <input
            type="password"
            className="field"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="current-password"
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? 'unlock-error' : undefined}
          />
        </label>
        {error && (
          <p id="unlock-error" className="mt-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary mt-4 w-full" disabled={!passphrase || busy}>
          {busy ? t('Unlocking…') : t('Unlock')}
        </button>
      </form>

      <button type="button" className="link mt-8 self-start text-sm" onClick={() => setShowForgot((v) => !v)} aria-expanded={showForgot}>
        {t('Forgot your passphrase?')}
      </button>
      {showForgot && (
        <div className="mt-3 space-y-3 text-sm text-muted">
          <p>
            {t('Your entries are encrypted with your passphrase, and there is no way to recover them without it — not even for the people who made this app.')}
          </p>
          <p>{t('If you have a backup, you can erase this device and restore it.')}</p>
          <button type="button" className="btn-danger btn-sm" onClick={() => setConfirmErase(true)}>
            {t('Erase everything and start over')}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmErase}
        title={t('Erase all data on this device?')}
        confirmLabel={t('Erase everything')}
        danger
        requireText="ERASE"
        onCancel={() => setConfirmErase(false)}
        onConfirm={() => void erase()}
      >
        <p>{t('Every entry stored in Unsent on this device will be permanently deleted. Backup files you saved elsewhere are not affected.')}</p>
      </ConfirmDialog>
    </div>
  )
}
