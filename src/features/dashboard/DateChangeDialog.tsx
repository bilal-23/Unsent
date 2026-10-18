import { useState } from 'react'
import { useRepos } from '../../app/repos'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toaster'
import { STORAGE_ERROR_MESSAGES, StorageError } from '../../db/errors'
import { daysBetween, isValidLocalDate } from '../../domain/dates'
import type { TrackingSettings } from '../../domain/types'
import { useToday } from '../../hooks/useToday'
import { t, tp } from '../../i18n'

/**
 * Two flavours of the same action:
 * - 'contact': "I had contact" — starts again from a new date, entries kept
 * - 'correct': fix the date that was entered
 */
export function DateChangeDialog({
  open,
  mode,
  settings,
  onClose,
}: {
  open: boolean
  mode: 'contact' | 'correct'
  settings: TrackingSettings | undefined
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={mode === 'contact' ? t('I had contact') : t('Edit last-contact date')}>
      <DateChangeForm mode={mode} settings={settings} onClose={onClose} />
    </Modal>
  )
}

/** Mounted fresh each time the dialog opens, so it starts from the current values. */
function DateChangeForm({ mode, settings, onClose }: { mode: 'contact' | 'correct'; settings: TrackingSettings | undefined; onClose: () => void }) {
  const repos = useRepos()
  const toast = useToast()
  const today = useToday()
  const [date, setDate] = useState(() => (mode === 'contact' ? today : (settings?.lastContactDate ?? today)))
  const [time, setTime] = useState(() => (mode === 'contact' ? '' : (settings?.lastContactTime ?? '')))
  const [reason, setReason] = useState('')
  const [keepIntention, setKeepIntention] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const dateError = !isValidLocalDate(date)
    ? t('Choose a date.')
    : daysBetween(date, today) < 0
      ? t('The date cannot be in the future.')
      : null

  const save = async () => {
    if (dateError) return
    setSaving(true)
    try {
      await repos.tracking.changeDate({
        newDate: date,
        lastContactTime: time || undefined,
        reason: reason || (mode === 'correct' ? t('Corrected date') : undefined),
        keepIntention,
      })
      toast(t('Date updated. All your entries are still here.'))
      onClose()
    } catch (e) {
      setError(e instanceof StorageError ? STORAGE_ERROR_MESSAGES[e.kind] : t('Something went wrong. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        {mode === 'contact' && (
          <p className="text-sm text-muted">
            {t('That is okay. Progress is not erased by one conversation. Set the date of the contact and Unsent will count from there — every message, urge and check-in stays exactly where it is.')}
          </p>
        )}
        <label className="block">
          <span className="label">{t('Date of last contact')}</span>
          <input
            type="date"
            className="field"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={!!dateError}
            required
          />
          {dateError && <span className="mt-1 block text-sm text-danger">{dateError}</span>}
        </label>
        <label className="block">
          <span className="label">
            {t('Time')} <span className="font-normal text-muted">({t('optional')})</span>
          </span>
          <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        {mode === 'contact' && (
          <label className="block">
            <span className="label">
              {t('A note for yourself')} <span className="font-normal text-muted">({t('optional')})</span>
            </span>
            <input className="field" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          </label>
        )}
        {settings?.intentionDays && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={keepIntention} onChange={(e) => setKeepIntention(e.target.checked)} />
            <span>
              {tp(settings.intentionDays, {
                one: 'Keep my {count}-day intention, counting from the new date',
                other: 'Keep my {count}-day intention, counting from the new date',
              })}
            </span>
          </label>
        )}
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={!!dateError || saving}>
            {t('Save date')}
          </button>
        </div>
    </form>
  )
}
