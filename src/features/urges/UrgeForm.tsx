import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useRepos } from '../../app/repos'
import { ChipPicker } from '../../components/ChipPicker'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { PromptHelper } from '../../components/PromptHelper'
import { RatingScale } from '../../components/RatingScale'
import { useToast } from '../../components/Toaster'
import { STORAGE_ERROR_MESSAGES, StorageError } from '../../db/errors'
import { EMOTION_SUGGESTIONS, TRIGGER_SUGGESTIONS, URGE_MAX } from '../../domain/constants'
import { formatTimestamp } from '../../domain/dates'
import type { UrgeEntry } from '../../domain/types'
import { usePreferences, useUrge } from '../../hooks/useData'
import { useDeleteWithUndo } from '../../hooks/useDeleteWithUndo'
import { clearReflectionTimer } from '../../hooks/useReflectionTimer'
import { t } from '../../i18n'
import { AfterUrgePanel } from './AfterUrgePanel'

export function UrgeForm() {
  const { id = 'new' } = useParams()
  const isNew = id === 'new'
  const record = useUrge(isNew ? undefined : id)
  if (!isNew && !record) return <p className="hint">{t('Loading…')}</p>
  if (!isNew && !record?.value) return <p className="text-muted">{t('This entry no longer exists.')}</p>
  return <UrgeFormBody key={id} id={id} initial={record?.value} />
}

function UrgeFormBody({ id, initial }: { id: string; initial: UrgeEntry | undefined }) {
  const isNew = id === 'new'
  const [searchParams] = useSearchParams()
  const focusFollowUp = searchParams.get('followup') === '1'
  const repos = useRepos()
  const navigate = useNavigate()
  const toast = useToast()
  const preferences = usePreferences()
  const deleteWithUndo = useDeleteWithUndo()
  const record = initial ? { value: initial } : undefined

  const [intensity, setIntensity] = useState<number | undefined>(initial?.intensity)
  const [trigger, setTrigger] = useState<string | undefined>(initial?.trigger)
  const [emotion, setEmotion] = useState<string | undefined>(initial?.emotion)
  const [note, setNote] = useState(initial?.note ?? '')
  const [followUp, setFollowUp] = useState<number | undefined>(initial?.followUpIntensity)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (savedId && preferences) {
    return <AfterUrgePanel urgeId={savedId} preferences={preferences} onDone={() => navigate('/urges')} />
  }

  const save = async () => {
    if (intensity === undefined) return
    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        const created = await repos.urges.create({ intensity, trigger, emotion, note })
        setSavedId(created.id)
      } else {
        await repos.urges.update(id, { intensity, trigger, emotion, note })
        if (followUp !== record?.value?.followUpIntensity) await repos.urges.setFollowUp(id, followUp)
        if (followUp !== undefined) clearReflectionTimer()
        toast(t('Saved.'))
        navigate('/urges')
      }
    } catch (e) {
      setError(e instanceof StorageError ? STORAGE_ERROR_MESSAGES[e.kind] : t('Something went wrong. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isNew ? t('Log an urge') : t('Urge')}
        back="/urges"
        subtitle={!isNew && record?.value ? formatTimestamp(record.value.createdAt) : t('Only the intensity is needed.')}
        actions={
          !isNew && (
            <button type="button" className="btn-ghost px-2.5" aria-label={t('Delete')} onClick={async () => {
                if (await deleteWithUndo(() => repos.urges.delete(id), t('Entry moved to Recently deleted.'))) navigate('/urges', { replace: true })
              }}
            >
              <Icon name="trash" />
            </button>
          )
        }
      />

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        {!isNew && (
          <div className={`card ${focusFollowUp ? 'border-accent' : ''}`}>
            <RatingScale
              label={t('How strong is it now?')}
              max={URGE_MAX}
              value={followUp}
              onChange={setFollowUp}
              lowHint={t('Barely there')}
              highHint={t('Very strong')}
              name="follow-up"
            />
            {record?.value?.followUpAt && <p className="hint mt-2 text-xs">{t('Last updated {date}', { date: formatTimestamp(record.value.followUpAt) })}</p>}
          </div>
        )}

        <RatingScale
          label={isNew ? t('How strong is the urge?') : t('How strong was it?')}
          max={URGE_MAX}
          value={intensity}
          onChange={setIntensity}
          lowHint={t('Mild')}
          highHint={t('Overwhelming')}
          name="intensity"
        />

        <ChipPicker label={t('What set it off?')} options={TRIGGER_SUGGESTIONS} value={trigger} onChange={setTrigger} />
        <ChipPicker label={t('What are you feeling?')} options={EMOTION_SUGGESTIONS} value={emotion} onChange={setEmotion} />

        <div>
          <label htmlFor="urge-note" className="label">
            {t('Anything else')} <span className="font-normal text-muted">({t('optional')})</span>
          </label>
          {preferences?.showPrompts && !note && (
            <div className="mb-2">
              <PromptHelper context="urge" />
            </div>
          )}
          <textarea id="urge-note" className="field min-h-24 font-serif" value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="sticky bottom-20 z-10 md:bottom-4">
          <button type="submit" className="btn-primary w-full shadow-lg" disabled={intensity === undefined || saving}>
            {intensity === undefined ? t('Choose an intensity to save') : t('Save')}
          </button>
        </div>
      </form>

    </div>
  )
}
