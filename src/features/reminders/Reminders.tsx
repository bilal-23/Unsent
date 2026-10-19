import { useState } from 'react'
import { useRepos } from '../../app/repos'
import { PageHeader } from '../../components/PageHeader'
import { useToast } from '../../components/Toaster'
import { useHabits, usePreferences } from '../../hooks/useData'
import { t } from '../../i18n'
import { downloadText } from '../../services/backup/exportService'
import { buildIcs, WEEKDAYS, type Weekday } from '../../services/reminders/ics'
import { notificationSupport, requestNotificationPermission, showNotification, type NotificationSupport } from '../../services/reminders/notifications'

interface Preset {
  key: string
  label: string
  title: string
  time: string
  days: Weekday[]
  path: string
}

const PRESETS: Preset[] = [
  { key: 'checkin', label: 'Evening check-in', title: 'A moment for you', time: '21:00', days: [], path: '#/journal/check-in/today' },
  { key: 'morning', label: 'Morning idea', title: 'Something for today', time: '08:30', days: [], path: '#/' },
  { key: 'write', label: 'Write it down', title: 'A few quiet minutes', time: '22:00', days: ['SU'], path: '#/unsent/new' },
]

const DAY_LABELS: Record<Weekday, string> = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' }

function CalendarReminder() {
  const toast = useToast()
  const habits = useHabits()?.filter((habit) => !habit.archived) ?? []
  const [title, setTitle] = useState(PRESETS[0].title)
  const [time, setTime] = useState(PRESETS[0].time)
  const [days, setDays] = useState<Weekday[]>([])
  const [path, setPath] = useState(PRESETS[0].path)
  const [includeLink, setIncludeLink] = useState(true)
  const everyDay = days.length === 0 || days.length === 7

  const applyPreset = (preset: Preset) => {
    setTitle(t(preset.title))
    setTime(preset.time)
    setDays(preset.days)
    setPath(preset.path)
  }

  return (
    <section className="card space-y-4" aria-labelledby="calendar-title">
      <div>
        <h2 id="calendar-title" className="text-lg font-semibold">
          {t('Calendar reminders')}
        </h2>
        <p className="hint mt-1">
          {t('Add a repeating reminder to your phone’s calendar. The calendar shows the notification — even when Unsent is closed — and no server is involved.')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Suggestions')}>
        {PRESETS.map((preset) => (
          <button key={preset.key} type="button" className="chip" onClick={() => applyPreset(preset)}>
            {t(preset.label)}
          </button>
        ))}
        {habits.map((habit) => (
          <button
            key={habit.id}
            type="button"
            className="chip"
            onClick={() => {
              setTitle(habit.name)
              setPath('#/journal/habits')
            }}
          >
            {habit.name}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="label">{t('Reminder text')}</span>
        <input className="field" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        <span className="hint mt-1 block">{t('Anyone who sees your calendar can read this, so keep it neutral.')}</span>
      </label>

      <label className="block">
        <span className="label">{t('Time')}</span>
        <input type="time" className="field w-auto" value={time} onChange={(e) => setTime(e.target.value)} required />
      </label>

      <fieldset>
        <legend className="label">{t('Repeat')}</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`chip ${everyDay ? 'chip-selected' : ''}`} aria-pressed={everyDay} onClick={() => setDays([])}>
            {t('Every day')}
          </button>
          {WEEKDAYS.map((day) => {
            const selected = !everyDay && days.includes(day)
            return (
              <button
                key={day}
                type="button"
                className={`chip ${selected ? 'chip-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current.filter(() => !everyDay), day]))}
              >
                {t(DAY_LABELS[day])}
              </button>
            )
          })}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-[var(--accent)]" checked={includeLink} onChange={(e) => setIncludeLink(e.target.checked)} />
        <span>
          {t('Include a link that opens Unsent')}
          <span className="hint block">{t('Handy, but the link shows the app’s address in your calendar.')}</span>
        </span>
      </label>

      <button
        type="button"
        className="btn-primary"
        disabled={!title.trim() || !/^\d{2}:\d{2}$/.test(time)}
        onClick={() => {
          const url = includeLink ? new URL(path, window.location.origin + window.location.pathname).href : undefined
          downloadText('unsent-reminder.ics', buildIcs({ title: title.trim(), time, days, url }))
          toast(t('Reminder file created. Open it to add it to your calendar.'))
        }}
      >
        {t('Add to calendar')}
      </button>
      <p className="hint text-xs">
        {t('On iPhone, tap “Add All” when the file opens. To change or stop a reminder later, edit or delete the event in your calendar.')}
      </p>
    </section>
  )
}

function NotificationSettings() {
  const repos = useRepos()
  const toast = useToast()
  const preferences = usePreferences()
  const [support, setSupport] = useState<NotificationSupport>(() => notificationSupport())
  if (!preferences) return null

  return (
    <section className="card space-y-3" aria-labelledby="notifications-title">
      <h2 id="notifications-title" className="text-lg font-semibold">
        {t('Notifications while Unsent is open')}
      </h2>
      <p className="hint">
        {t('After you log an urge, Unsent can tap you on the shoulder when your check-back time comes — even if you have switched to another app. This works while Unsent is still running; on iPhone it is unreliable, and nothing arrives once the app is closed.')}
      </p>
      {support === 'unsupported' ? (
        <p className="text-sm text-muted">{t('This browser does not support notifications.')}</p>
      ) : support === 'denied' ? (
        <p className="text-sm text-muted">{t('Notifications are blocked for Unsent. You can allow them in your browser or system settings.')}</p>
      ) : (
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-[var(--accent)]"
            checked={preferences.notifyCheckBack && support === 'granted'}
            onChange={async (e) => {
              if (!e.target.checked) {
                await repos.preferences.update({ notifyCheckBack: false })
                return
              }
              const result = support === 'granted' ? 'granted' : await requestNotificationPermission()
              setSupport(result)
              await repos.preferences.update({ notifyCheckBack: result === 'granted' })
            }}
          />
          <span>{t('Notify me when the check-back is due')}</span>
        </label>
      )}
      {support === 'granted' && (
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={async () => {
            const shown = await showNotification(t('Unsent'), t('A moment to check in with yourself.'), '#/')
            if (!shown) toast(t('The notification could not be shown.'))
          }}
        >
          {t('Send a test notification')}
        </button>
      )}
      <p className="hint text-xs">{t('Notifications never include anything you have written.')}</p>
    </section>
  )
}

export function Reminders() {
  return (
    <div className="space-y-4">
      <PageHeader title={t('Reminders')} back="/settings" helpId="reminders" subtitle={t('Gentle nudges, on your terms.')} />
      <CalendarReminder />
      <NotificationSettings />
    </div>
  )
}
