import { useState } from 'react'
import { useRepos } from '../../app/repos'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toaster'
import type { Preferences } from '../../domain/types'
import { t } from '../../i18n'
import { clearDraftShadows } from '../../lib/storage'
import { MIN_PASSPHRASE_LENGTH, WrongPassphraseError } from '../../repositories/lockRepo'
import { useLock } from '../lock/LockGate'

type Dialog = null | 'enable' | 'change' | 'disable'

function PassphraseFields({ value, confirm, onValue, onConfirm, label }: { value: string; confirm: string; onValue: (v: string) => void; onConfirm: (v: string) => void; label: string }) {
  return (
    <>
      <label className="block">
        <span className="label">{label}</span>
        <input type="password" className="field" value={value} onChange={(e) => onValue(e.target.value)} autoComplete="new-password" minLength={MIN_PASSPHRASE_LENGTH} />
        <span className="hint mt-1 block">{t('At least {n} characters. A few unrelated words work well.', { n: MIN_PASSPHRASE_LENGTH })}</span>
      </label>
      <label className="block">
        <span className="label">{t('Repeat passphrase')}</span>
        <input type="password" className="field" value={confirm} onChange={(e) => onConfirm(e.target.value)} autoComplete="new-password" />
      </label>
    </>
  )
}

export function LockSettings({ preferences }: { preferences: Preferences }) {
  const repos = useRepos()
  const toast = useToast()
  const { status, refresh, lockNow } = useLock()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const close = () => {
    setDialog(null)
    setCurrent('')
    setNext('')
    setConfirm('')
    setAcknowledged(false)
    setError(null)
  }

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      refresh()
      toast(success)
      close()
    } catch (e) {
      setError(e instanceof WrongPassphraseError ? t('The current passphrase is not correct.') : t('Something went wrong. Nothing was changed.'))
    } finally {
      setBusy(false)
    }
  }

  const newValid = next.length >= MIN_PASSPHRASE_LENGTH && next === confirm

  return (
    <div className="space-y-3">
      {status === 'off' ? (
        <>
          <p className="hint">
            {t('Encrypts your writing on this device with a passphrase. Unsent will ask for it when you open the app or come back after a while.')}
          </p>
          <button type="button" className="btn-secondary" onClick={() => setDialog('enable')}>
            {t('Turn on app lock')}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm">{t('App lock is on. Your writing is encrypted on this device.')}</p>
          <label className="block">
            <span className="label">{t('Lock automatically')}</span>
            <select
              className="field w-auto"
              value={preferences.autoLockMinutes}
              onChange={(e) => void repos.preferences.update({ autoLockMinutes: Number(e.target.value) })}
            >
              <option value={0}>{t('As soon as I leave the app')}</option>
              <option value={1}>{t('After 1 minute away')}</option>
              <option value={5}>{t('After 5 minutes away')}</option>
              <option value={15}>{t('After 15 minutes away')}</option>
              <option value={60}>{t('After 1 hour away')}</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary btn-sm" onClick={() => void lockNow()}>
              {t('Lock now')}
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setDialog('change')}>
              {t('Change passphrase')}
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setDialog('disable')}>
              {t('Turn off app lock')}
            </button>
          </div>
        </>
      )}

      <Modal open={dialog === 'enable'} onClose={close} title={t('Turn on app lock')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (newValid && acknowledged)
              void run(async () => {
                await repos.lock.enable(next)
                clearDraftShadows()
              }, t('App lock is on.'))
          }}
        >
          <PassphraseFields value={next} confirm={confirm} onValue={setNext} onConfirm={setConfirm} label={t('New passphrase')} />
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
            <span>{t('I understand that if I forget this passphrase, my encrypted entries cannot be recovered by anyone.')}</span>
          </label>
          <p className="hint">{t('Dates, ratings and counts stay unencrypted so the app can sort them. Your words, photos and recordings are encrypted.')}</p>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={close}>
              {t('Cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={!newValid || !acknowledged || busy}>
              {busy ? t('Encrypting…') : t('Turn on')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={dialog === 'change'} onClose={close} title={t('Change passphrase')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (newValid && current) void run(() => repos.lock.changePassphrase(current, next), t('Passphrase changed.'))
          }}
        >
          <label className="block">
            <span className="label">{t('Current passphrase')}</span>
            <input type="password" className="field" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </label>
          <PassphraseFields value={next} confirm={confirm} onValue={setNext} onConfirm={setConfirm} label={t('New passphrase')} />
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={close}>
              {t('Cancel')}
            </button>
            <button type="submit" className="btn-primary" disabled={!newValid || !current || busy}>
              {t('Change')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={dialog === 'disable'} onClose={close} title={t('Turn off app lock')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (current) void run(() => repos.lock.disable(current), t('App lock is off.'))
          }}
        >
          <p className="text-sm text-muted">{t('Your entries will be decrypted and stored without encryption on this device.')}</p>
          <label className="block">
            <span className="label">{t('Current passphrase')}</span>
            <input type="password" className="field" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </label>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={close}>
              {t('Cancel')}
            </button>
            <button type="submit" className="btn-danger" disabled={!current || busy}>
              {t('Turn off')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
