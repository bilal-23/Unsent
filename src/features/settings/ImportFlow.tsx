import { useRef, useState } from 'react'
import { useRepos } from '../../app/repos'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toaster'
import { STORAGE_ERROR_MESSAGES, StorageError } from '../../db/errors'
import { COLLECTION_LABELS, COLLECTIONS, type MergeSummary } from '../../domain/backup'
import { formatTimestamp } from '../../domain/dates'
import { t } from '../../i18n'
import { mergeBackup, previewMerge, replaceWithBackup } from '../../services/backup/importService'
import { decryptBackupJson, WrongBackupPassphraseError, type EncryptedEnvelope } from '../../services/backup/encryptedBackup'
import { parseBackupFile, parseBackupText, type ParsedBackup, type ParseResult } from '../../services/backup/parseBackup'

type Stage =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'invalid'; error: string; details?: string[] }
  | { kind: 'passphrase'; envelope: EncryptedEnvelope; error?: string }
  | { kind: 'review'; backup: ParsedBackup; preview: MergeSummary; localIsEmpty: boolean }
  | { kind: 'working' }
  | { kind: 'done'; message: string }

const errorMessage = (error: unknown) =>
  error instanceof StorageError ? STORAGE_ERROR_MESSAGES[error.kind] : t('The import could not be completed. Your existing data was not changed.')

/**
 * Import pipeline UI: pick a file → validate (nothing written) → review counts →
 * merge or replace (replace needs typed confirmation) → result.
 */
export function ImportFlow({ onDone, compact = false }: { onDone?: () => void; compact?: boolean }) {
  const repos = useRepos()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [passphrase, setPassphrase] = useState('')

  const reset = () => {
    setStage({ kind: 'idle' })
    if (inputRef.current) inputRef.current.value = ''
  }

  const review = async (result: ParseResult) => {
    if (!result.ok && result.encrypted) {
      setStage({ kind: 'passphrase', envelope: result.encrypted })
      return
    }
    if (!result.ok) {
      setStage({ kind: 'invalid', error: result.error, details: result.details })
      return
    }
    try {
      const snapshot = await repos.data.snapshot()
      const localIsEmpty =
        !snapshot.settings && COLLECTIONS.every((collection) => (snapshot[collection] as unknown[]).length === 0)
      const preview = await previewMerge(repos, result.backup.data)
      setStage({ kind: 'review', backup: result.backup, preview, localIsEmpty })
    } catch (error) {
      setStage({ kind: 'invalid', error: errorMessage(error) })
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setStage({ kind: 'reading' })
    await review(await parseBackupFile(file))
  }

  const unlockBackup = async (envelope: EncryptedEnvelope) => {
    setStage({ kind: 'reading' })
    try {
      const json = await decryptBackupJson(envelope, passphrase)
      setPassphrase('')
      await review(parseBackupText(json))
    } catch (error) {
      setStage({
        kind: 'passphrase',
        envelope,
        error: error instanceof WrongBackupPassphraseError ? t('That passphrase did not open this backup.') : t('The backup could not be opened.'),
      })
    }
  }

  const finish = (message: string) => {
    setStage({ kind: 'done', message })
    toast(message)
    onDone?.()
  }

  const doMerge = async (backup: ParsedBackup) => {
    setStage({ kind: 'working' })
    try {
      const summary = await mergeBackup(repos, backup.data)
      const added = COLLECTIONS.reduce((sum, c) => sum + summary[c].added, 0)
      const updated = COLLECTIONS.reduce((sum, c) => sum + summary[c].updated, 0)
      finish(t('Backup merged: {added} added, {updated} updated.', { added, updated }))
    } catch (error) {
      setStage({ kind: 'invalid', error: errorMessage(error) })
    }
  }

  const doReplace = async (backup: ParsedBackup) => {
    setConfirmReplace(false)
    setStage({ kind: 'working' })
    try {
      await replaceWithBackup(repos, backup.data)
      finish(t('Backup restored.'))
    } catch (error) {
      setStage({ kind: 'invalid', error: errorMessage(error) })
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        id="backup-file"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />

      {(stage.kind === 'idle' || stage.kind === 'done') && (
        <label htmlFor="backup-file" className={compact ? 'btn-secondary w-full cursor-pointer' : 'btn-secondary cursor-pointer'}>
          <Icon name="upload" />
          {t('Choose a backup file')}
        </label>
      )}

      {stage.kind === 'reading' && <p className="hint">{t('Checking the file…')}</p>}
      {stage.kind === 'working' && <p className="hint">{t('Importing…')}</p>}

      {stage.kind === 'invalid' && (
        <div className="rounded-xl border border-danger/40 p-3 text-sm" role="alert">
          <p className="font-medium text-danger">{stage.error}</p>
          {stage.details && (
            <ul className="mt-2 list-disc ps-5 text-muted">
              {stage.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-muted">{t('Nothing was changed.')}</p>
          <button type="button" className="btn-secondary btn-sm mt-3" onClick={reset}>
            {t('Choose another file')}
          </button>
        </div>
      )}

      {stage.kind === 'passphrase' && (
        <form
          className="rounded-xl border border-line p-4"
          onSubmit={(e) => {
            e.preventDefault()
            void unlockBackup(stage.envelope)
          }}
        >
          <p className="text-sm">{t('This backup is protected with a passphrase.')}</p>
          <label className="mt-3 block">
            <span className="label">{t('Backup passphrase')}</span>
            <input type="password" className="field" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="off" autoFocus />
          </label>
          {stage.error && (
            <p className="mt-2 text-sm text-danger" role="alert">
              {stage.error}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button type="submit" className="btn-primary" disabled={!passphrase}>
              {t('Open backup')}
            </button>
            <button type="button" className="btn-ghost" onClick={reset}>
              {t('Cancel')}
            </button>
          </div>
        </form>
      )}

      {stage.kind === 'review' && (
        <div className="rounded-xl border border-line p-4">
          <p className="font-medium">{t('This backup contains:')}</p>
          {stage.backup.exportedAt && (
            <p className="hint">{t('Created {date}', { date: formatTimestamp(stage.backup.exportedAt) })}</p>
          )}
          <ul className="mt-3 space-y-1 text-sm">
            {COLLECTIONS.map((collection) => (
              <li key={collection} className="flex justify-between gap-4">
                <span className="text-muted">{t(COLLECTION_LABELS[collection])}</span>
                <span className="tabular-nums">{stage.backup.counts[collection]}</span>
              </li>
            ))}
            <li className="flex justify-between gap-4">
              <span className="text-muted">{t('No-contact settings')}</span>
              <span>{stage.backup.hasSettings ? t('Yes') : t('No')}</span>
            </li>
          </ul>

          {stage.localIsEmpty ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => void doReplace(stage.backup)}>
                {t('Restore this backup')}
              </button>
              <button type="button" className="btn-ghost" onClick={reset}>
                {t('Cancel')}
              </button>
            </div>
          ) : (
            <>
              <p className="hint mt-4">
                {t('Merge keeps everything on this device and adds what is new. Where the same entry exists in both, the more recently edited version is kept.')}
              </p>
              <p className="hint mt-1">
                {t('Merge would add {added} and update {updated} entries.', {
                  added: COLLECTIONS.reduce((sum, c) => sum + stage.preview[c].added, 0),
                  updated: COLLECTIONS.reduce((sum, c) => sum + stage.preview[c].updated, 0),
                })}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => void doMerge(stage.backup)}>
                  {t('Merge with this device')}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setConfirmReplace(true)}>
                  {t('Replace everything')}
                </button>
                <button type="button" className="btn-ghost" onClick={reset}>
                  {t('Cancel')}
                </button>
              </div>
            </>
          )}

          <ConfirmDialog
            open={confirmReplace}
            title={t('Replace all data on this device?')}
            confirmLabel={t('Replace everything')}
            danger
            requireText="REPLACE"
            onCancel={() => setConfirmReplace(false)}
            onConfirm={() => void doReplace(stage.backup)}
          >
            <p>{t('Everything currently stored in Unsent on this device will be permanently deleted and replaced with the contents of the backup.')}</p>
            <p>{t('This cannot be undone. Consider exporting a backup of this device first.')}</p>
          </ConfirmDialog>
        </div>
      )}

      {stage.kind === 'done' && (
        <p className="text-sm text-muted" role="status">
          {stage.message}
        </p>
      )}
    </div>
  )
}
