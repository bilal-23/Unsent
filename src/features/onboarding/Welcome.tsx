import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useRepos } from '../../app/repos'
import { Icon } from '../../components/Icon'
import { STORAGE_ERROR_MESSAGES, StorageError } from '../../db/errors'
import { daysBetween, isValidLocalDate } from '../../domain/dates'
import { useToday } from '../../hooks/useToday'
import { t } from '../../i18n'
import { requestPersistentStorage } from '../../services/storagePersistence'
import { ImportFlow } from '../settings/ImportFlow'
import { IntentionPicker } from '../dashboard/IntentionPicker'

type Step = 'intro' | 'name' | 'date' | 'reasons' | 'restore'

const STEPS: Step[] = ['intro', 'name', 'date', 'reasons']

export function Welcome() {
  const repos = useRepos()
  const navigate = useNavigate()
  const today = useToday()
  const [step, setStep] = useState<Step>('intro')
  const [journalName, setJournalName] = useState('')
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('')
  const [intention, setIntention] = useState<number | undefined>(undefined)
  const [reasons, setReasons] = useState<string[]>(['', ''])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const dateError = !isValidLocalDate(date)
    ? t('Choose a date.')
    : daysBetween(date, today) < 0
      ? t('The date of your last contact cannot be in the future.')
      : null

  const finish = async () => {
    if (dateError) {
      setStep('date')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await repos.tracking.setup({
        lastContactDate: date,
        lastContactTime: time || undefined,
        journalName,
        intentionDays: intention,
        reasons,
      })
      void requestPersistentStorage()
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof StorageError ? STORAGE_ERROR_MESSAGES[e.kind] : t('Something went wrong. Please try again.'))
      setSaving(false)
    }
  }

  const stepIndex = STEPS.indexOf(step)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-10">
      {stepIndex > 0 && (
        <div className="mb-8 flex gap-1.5" aria-hidden="true">
          {STEPS.slice(1).map((s, i) => (
            <span key={s} className={`h-1 flex-1 rounded-full ${i < stepIndex ? 'bg-accent' : 'bg-line'}`} />
          ))}
        </div>
      )}

      {step === 'intro' && (
        <section className="flex flex-1 flex-col" aria-labelledby="welcome-title">
          <h1 id="welcome-title" className="font-serif text-4xl text-ink">
            Unsent
          </h1>
          <p className="mt-4 font-serif text-xl leading-relaxed text-ink">
            {t('A private place to write what you want to say, notice your urges, and slowly turn your attention back to your own life.')}
          </p>
          <div className="card mt-8 space-y-2 text-sm text-muted">
            <p className="flex items-center gap-2 font-medium text-ink">
              <Icon name="lock" className="size-4" />
              {t('Everything stays on this device')}
            </p>
            <p>{t('There is no account and nothing is sent anywhere. Unsent can never send a message for you.')}</p>
            <p>{t('Your entries are stored in this browser. They are not encrypted unless you turn on the app lock later, and clearing your browser data deletes them — so make a backup from Settings now and then.')}</p>
          </div>
          <div className="mt-auto flex flex-col gap-3 pt-10">
            <button type="button" className="btn-primary" onClick={() => setStep('name')}>
              {t('Get started')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setStep('restore')}>
              {t('Restore from a backup')}
            </button>
          </div>
        </section>
      )}

      {step === 'restore' && (
        <section aria-labelledby="restore-title">
          <h1 id="restore-title" className="text-2xl font-semibold">
            {t('Restore from a backup')}
          </h1>
          <p className="hint mt-2">{t('Choose an Unsent backup file (.json) exported from this or another device.')}</p>
          <div className="mt-6">
            <ImportFlow compact onDone={() => navigate('/', { replace: true })} />
          </div>
          <button type="button" className="btn-ghost mt-8" onClick={() => setStep('intro')}>
            {t('Back')}
          </button>
        </section>
      )}

      {step === 'name' && (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            setStep('date')
          }}
        >
          <h1 className="text-2xl font-semibold">{t('Name your journal')}</h1>
          <p className="hint mt-2">{t('Optional. It only appears inside the app. No real names needed.')}</p>
          <label className="mt-6 block">
            <span className="label">{t('Journal name')}</span>
            <input
              className="field"
              value={journalName}
              onChange={(e) => setJournalName(e.target.value)}
              placeholder={t('My journal')}
              maxLength={60}
              autoFocus
            />
          </label>
          <div className="mt-auto flex gap-3 pt-10">
            <button type="button" className="btn-ghost" onClick={() => setStep('intro')}>
              {t('Back')}
            </button>
            <button type="submit" className="btn-primary flex-1">
              {journalName.trim() ? t('Continue') : t('Skip')}
            </button>
          </div>
        </form>
      )}

      {step === 'date' && (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            if (!dateError) setStep('reasons')
          }}
        >
          <h1 className="text-2xl font-semibold">{t('When was your last direct contact?')}</h1>
          <p className="hint mt-2">{t('You can change this at any time. Changing it never deletes your entries.')}</p>
          <label className="mt-6 block">
            <span className="label">{t('Date')}</span>
            <input
              type="date"
              className="field"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!!dateError}
              aria-describedby={dateError ? 'date-error' : undefined}
              required
            />
          </label>
          {dateError && (
            <p id="date-error" className="mt-1.5 text-sm text-danger">
              {dateError}
            </p>
          )}
          <label className="mt-4 block">
            <span className="label">
              {t('Time')} <span className="font-normal text-muted">({t('optional')})</span>
            </span>
            <input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <div className="mt-6">
            <IntentionPicker value={intention} onChange={setIntention} />
          </div>
          <div className="mt-auto flex gap-3 pt-10">
            <button type="button" className="btn-ghost" onClick={() => setStep('name')}>
              {t('Back')}
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={!!dateError}>
              {t('Continue')}
            </button>
          </div>
        </form>
      )}

      {step === 'reasons' && (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault()
            void finish()
          }}
        >
          <h1 className="text-2xl font-semibold">{t('Why are you choosing no contact?')}</h1>
          <p className="hint mt-2">
            {t('Optional. Your own reasons, in your own words. Unsent will show them to you when an urge comes up.')}
          </p>
          <div className="mt-6 space-y-3">
            {reasons.map((reason, index) => (
              <label key={index} className="block">
                <span className="sr-only">{t('Reason {n}', { n: index + 1 })}</span>
                <input
                  className="field"
                  value={reason}
                  maxLength={300}
                  placeholder={index === 0 ? t('e.g. I want to feel calm again') : ''}
                  onChange={(e) => setReasons((current) => current.map((r, i) => (i === index ? e.target.value : r)))}
                />
              </label>
            ))}
            {reasons.length < 6 && (
              <button type="button" className="link text-sm" onClick={() => setReasons((current) => [...current, ''])}>
                {t('Add another reason')}
              </button>
            )}
          </div>
          {error && (
            <p className="mt-4 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="mt-auto flex gap-3 pt-10">
            <button type="button" className="btn-ghost" onClick={() => setStep('date')}>
              {t('Back')}
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {reasons.some((r) => r.trim()) ? t('Finish') : t('Skip and finish')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
