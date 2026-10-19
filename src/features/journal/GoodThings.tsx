import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useRepos } from '../../app/repos'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { PhotoView } from '../../components/PhotoView'
import { useToast } from '../../components/Toaster'
import { addDays, daysBetween, formatLocalDate, isValidLocalDate } from '../../domain/dates'
import { collectGoodThings, GOOD_THING_LABELS, groupByWeek, type GoodThing } from '../../domain/goodThings'
import { getIdea } from '../../domain/ideas'
import type { LifeLogEntry, Photo } from '../../domain/types'
import { useCheckIns, useLifeLog, usePlans } from '../../hooks/useData'
import { useDeleteWithUndo } from '../../hooks/useDeleteWithUndo'
import { useToday } from '../../hooks/useToday'
import { t, tp } from '../../i18n'
import { prepareImage } from '../../lib/photos'

/** Add / change / remove a photo. The image is downscaled and re-encoded on the device. */
function PhotoPicker({ photo, onChange }: { photo: Photo | undefined; onChange: (photo: Photo | undefined) => void }) {
  const toast = useToast()
  const inputId = useId()
  return (
    <div className="space-y-2">
      {photo && (
        <div className="relative inline-block">
          <PhotoView photo={photo} alt={t('Selected photo')} className="max-h-40" />
          <button type="button" className="btn-secondary btn-sm absolute end-1 top-1 px-2" aria-label={t('Remove photo')} onClick={() => onChange(undefined)}>
            <Icon name="x" className="size-4" />
          </button>
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        id={inputId}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            onChange(await prepareImage(file))
          } catch {
            toast(t('That image could not be used.'))
          }
        }}
      />
      <label htmlFor={inputId} className="btn-ghost btn-sm cursor-pointer">
        <Icon name="image" className="size-4" />
        {photo ? t('Change photo') : t('Add a photo')}
      </label>
    </div>
  )
}

function AddMoment() {
  const repos = useRepos()
  const toast = useToast()
  const today = useToday()
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<Photo | undefined>()
  const [busy, setBusy] = useState(false)

  return (
    <form
      className="card space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!text.trim()) return
        setBusy(true)
        try {
          await repos.lifeLog.addMoment(text, today, photo)
          setText('')
          setPhoto(undefined)
          toast(t('Added to your good things.'))
        } catch {
          toast(t('Something went wrong. Please try again.'))
        } finally {
          setBusy(false)
        }
      }}
    >
      <label className="block">
        <span className="label">{t('Add a good thing')}</span>
        <input className="field" value={text} maxLength={500} placeholder={t('Something you did, enjoyed or noticed')} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <button type="submit" className="btn-primary btn-sm" disabled={!text.trim() || busy}>
          {t('Add')}
        </button>
        <PhotoPicker photo={photo} onChange={setPhoto} />
      </div>
    </form>
  )
}

/** Inline editor for a good thing: words, day and photo. */
function EditGoodThing({ entry, onDone }: { entry: LifeLogEntry; onDone: () => void }) {
  const repos = useRepos()
  const toast = useToast()
  const today = useToday()
  const formId = useId()
  // An idea from the library is shown translated; edits are stored as the user's own words.
  const [text, setText] = useState(() => (entry.kind === 'idea' && getIdea(entry.ideaId)?.text === entry.text ? t(entry.text) : entry.text))
  const [date, setDate] = useState(entry.localDate)
  const [photo, setPhoto] = useState<Photo | undefined>(entry.photo)
  const [busy, setBusy] = useState(false)
  const dateOk = isValidLocalDate(date) && daysBetween(date, today) >= 0

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!text.trim() || !dateOk) return
        setBusy(true)
        try {
          await repos.lifeLog.update(entry.id, { text, localDate: date, photo })
          toast(t('Saved.'))
          onDone()
        } catch {
          toast(t('Something went wrong. Please try again.'))
        } finally {
          setBusy(false)
        }
      }}
    >
      <label className="block" htmlFor={`${formId}-text`}>
        <span className="label">{t('Good thing')}</span>
      </label>
      <input id={`${formId}-text`} className="field" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} autoFocus />
      <label className="block">
        <span className="label">{t('Day')}</span>
        <input type="date" className="field w-auto" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </label>
      <PhotoPicker photo={photo} onChange={setPhoto} />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary btn-sm" disabled={!text.trim() || !dateOk || busy}>
          {t('Save')}
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={onDone}>
          {t('Cancel')}
        </button>
      </div>
    </form>
  )
}

function GoodThingItem({ item, entry }: { item: GoodThing; entry: LifeLogEntry | undefined }) {
  const repos = useRepos()
  const deleteWithUndo = useDeleteWithUndo()
  const [editing, setEditing] = useState(false)

  if (editing && entry) {
    return (
      <li className="card">
        <EditGoodThing entry={entry} onDone={() => setEditing(false)} />
      </li>
    )
  }

  const display = item.source === 'idea' && getIdea(entry?.ideaId)?.text === item.text ? t(item.text) : item.text
  return (
    <li className="card">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg text-ink">{display}</p>
          <p className="mt-1 text-xs text-muted">
            {t(GOOD_THING_LABELS[item.source])} · {formatLocalDate(item.date, { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </div>
        {entry ? (
          <>
            <button type="button" className="btn-ghost btn-sm px-2" aria-label={t('Edit')} onClick={() => setEditing(true)}>
              <Icon name="pen" className="size-4" />
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm px-2"
              aria-label={t('Remove')}
              onClick={() => void deleteWithUndo(() => repos.lifeLog.delete(entry.id), t('Moved to Recently deleted.'))}
            >
              <Icon name="trash" className="size-4" />
            </button>
          </>
        ) : (
          // Wins and finished plans are edited where they live.
          <Link
            to={item.source === 'plan' ? '/journal/plans' : `/journal/check-in/${item.date}`}
            className="btn-ghost btn-sm px-2"
            aria-label={item.source === 'plan' ? t('Edit in Plans') : t('Edit in the check-in')}
          >
            <Icon name="pen" className="size-4" />
          </Link>
        )}
      </div>
      {entry?.photo && <PhotoView photo={entry.photo} alt="" className="mt-3 max-h-80" cacheKey={`${entry.id}:${entry.updatedAt}`} />}
    </li>
  )
}

export function GoodThings() {
  const today = useToday()
  const lifeLog = useLifeLog()
  const plans = usePlans()
  const checkIns = useCheckIns()

  const entries = useMemo(() => new Map(lifeLog?.map((e) => [e.id, e]) ?? []), [lifeLog])
  const items = useMemo(() => (lifeLog && plans && checkIns ? collectGoodThings(lifeLog, plans, checkIns) : null), [lifeLog, plans, checkIns])
  const weeks = useMemo(() => (items ? groupByWeek(items) : []), [items])
  const thisWeekCount = items?.filter((item) => daysBetween(addDays(today, -6), item.date) >= 0).length ?? 0

  return (
    <div className="space-y-5">
      <AddMoment />
      {items && items.length > 0 && (
        <p className="font-serif text-lg text-ink">
          {tp(thisWeekCount, {
            zero: 'This week, for you: nothing logged yet — that is fine.',
            one: 'This week, for you: {count} good thing.',
            other: 'This week, for you: {count} good things.',
          })}
        </p>
      )}
      {!items ? (
        <p className="hint">{t('Loading…')}</p>
      ) : items.length === 0 ? (
        <EmptyState message={t('Your entries will appear here as you use the app.')} />
      ) : (
        weeks.map((week) => (
          <section key={week.weekStart} aria-label={t('Week of {date}', { date: formatLocalDate(week.weekStart) })}>
            <h2 className="section-title mb-2">{t('Week of {date}', { date: formatLocalDate(week.weekStart, { month: 'long', day: 'numeric' }) })}</h2>
            <ul className="space-y-2">
              {week.items.map((item) => (
                <GoodThingItem key={item.key} item={item} entry={item.source === 'idea' || item.source === 'moment' ? entries.get(item.recordId) : undefined} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
