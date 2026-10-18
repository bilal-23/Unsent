import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useRepos } from '../../app/repos'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { PromptHelper } from '../../components/PromptHelper'
import { RatingScale } from '../../components/RatingScale'
import { useToast } from '../../components/Toaster'
import { STORAGE_ERROR_MESSAGES, StorageError } from '../../db/errors'
import { ENERGY_LABELS, MOOD_LABELS, MOOD_MAX } from '../../domain/constants'
import { daysBetween, formatLocalDate, isValidLocalDate } from '../../domain/dates'
import type { DailyCheckIn } from '../../domain/types'
import { useCheckInForDate, usePreferences } from '../../hooks/useData'
import { useToday } from '../../hooks/useToday'
import { t } from '../../i18n'

/** One check-in per local date: opening a date that already has one edits it. */
export function CheckInForm() {
  const { date: param = 'today' } = useParams()
  const today = useToday()
  const localDate = param === 'today' ? today : param
  const valid = isValidLocalDate(localDate) && daysBetween(localDate, today) >= 0
  const existing = useCheckInForDate(valid ? localDate : '0000-00-00')

  if (!valid) return <p className="text-muted">{t('Check-ins can only be written for today or earlier days.')}</p>
  if (!existing) return <p className="hint">{t('Loading…')}</p>
  return <CheckInFormBody key={localDate} localDate={localDate} today={today} initial={existing.value} />
}

function CheckInFormBody({ localDate, today, initial }: { localDate: string; today: string; initial: DailyCheckIn | undefined }) {
  const repos = useRepos()
  const navigate = useNavigate()
  const toast = useToast()
  const preferences = usePreferences()
  const existing = { value: initial }

  const [mood, setMood] = useState<number | undefined>(initial?.mood)
  const [energy, setEnergy] = useState<number | undefined>(initial?.energy)
  const [reflection, setReflection] = useState(initial?.reflection ?? '')
  const [personalWin, setPersonalWin] = useState(initial?.personalWin ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isEdit = !!initial

  return (
    <div>
      <PageHeader
        title={localDate === today ? (isEdit ? t("Today's check-in") : t('How is today going?')) : formatLocalDate(localDate, { dateStyle: 'full' })}
        back="/journal"
        subtitle={t('Only mood is needed. Everything else is optional.')}
        actions={
          isEdit && (
            <button type="button" className="btn-ghost px-2.5" aria-label={t('Delete check-in')} onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" />
            </button>
          )
        }
      />
      <form
        className="space-y-6"
        onSubmit={async (e) => {
          e.preventDefault()
          if (mood === undefined) return
          setSaving(true)
          setError(null)
          try {
            await repos.checkIns.saveForDate(localDate, { mood, energy, reflection, personalWin })
            toast(t('Check-in saved.'))
            navigate('/journal')
          } catch (err) {
            setError(err instanceof StorageError ? STORAGE_ERROR_MESSAGES[err.kind] : t('Something went wrong. Please try again.'))
          } finally {
            setSaving(false)
          }
        }}
      >
        <RatingScale label={t('Mood')} max={MOOD_MAX} value={mood} onChange={setMood} labels={MOOD_LABELS} name="mood" />
        <RatingScale
          label={`${t('Energy')} (${t('optional')})`}
          max={MOOD_MAX}
          value={energy}
          onChange={setEnergy}
          labels={ENERGY_LABELS}
          name="energy"
        />
        <div>
          <label htmlFor="checkin-reflection" className="label">
            {t('Reflection')} <span className="font-normal text-muted">({t('optional')})</span>
          </label>
          {preferences?.showPrompts && !reflection && (
            <div className="mb-2">
              <PromptHelper context="checkIn" />
            </div>
          )}
          <textarea
            id="checkin-reflection"
            className="field min-h-32 font-serif"
            value={reflection}
            maxLength={10000}
            onChange={(e) => setReflection(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="checkin-win" className="label">
            {t('A win, however small')} <span className="font-normal text-muted">({t('optional')})</span>
          </label>
          <input
            id="checkin-win"
            className="field"
            value={personalWin}
            maxLength={500}
            aria-describedby="checkin-win-hint"
            onChange={(e) => setPersonalWin(e.target.value)}
          />
          <span id="checkin-win-hint" className="hint mt-1 block">
            {t('Wins also appear in your Good things.')}
          </span>
        </div>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={mood === undefined || saving}>
          {mood === undefined ? t('Choose a mood to save') : t('Save check-in')}
        </button>
      </form>
      <ConfirmDialog
        open={confirmDelete}
        title={t('Delete this check-in?')}
        confirmLabel={t('Delete permanently')}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (existing.value) await repos.checkIns.delete(existing.value.id)
          setConfirmDelete(false)
          toast(t('Check-in deleted.'))
          navigate('/journal', { replace: true })
        }}
      >
        <p>{t('Only this check-in will be removed.')}</p>
      </ConfirmDialog>
    </div>
  )
}
