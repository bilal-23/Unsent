import { useMemo, useRef, useState } from 'react'
import { useRepos } from '../../app/repos'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { PhotoView } from '../../components/PhotoView'
import { useToast } from '../../components/Toaster'
import { addDays, daysBetween, formatLocalDate } from '../../domain/dates'
import { collectGoodThings, GOOD_THING_LABELS, groupByWeek, type GoodThing } from '../../domain/goodThings'
import type { Photo } from '../../domain/types'
import { useCheckIns, useLifeLog, usePlans } from '../../hooks/useData'
import { useToday } from '../../hooks/useToday'
import { t, tp } from '../../i18n'
import { prepareImage } from '../../lib/photos'

function AddMoment() {
  const repos = useRepos()
  const toast = useToast()
  const today = useToday()
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<Photo | undefined>()
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
        <input
          className="field"
          value={text}
          maxLength={500}
          placeholder={t('Something you did, enjoyed or noticed')}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {photo && (
        <div className="relative inline-block">
          <PhotoView photo={photo} alt={t('Selected photo')} className="max-h-40" />
          <button type="button" className="btn-secondary btn-sm absolute end-1 top-1 px-2" aria-label={t('Remove photo')} onClick={() => setPhoto(undefined)}>
            <Icon name="x" className="size-4" />
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary btn-sm" disabled={!text.trim() || busy}>
          {t('Add')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          id="moment-photo"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try {
              setPhoto(await prepareImage(file))
            } catch {
              toast(t('That image could not be used.'))
            }
          }}
        />
        <label htmlFor="moment-photo" className="btn-ghost btn-sm cursor-pointer">
          <Icon name="image" className="size-4" />
          {photo ? t('Change photo') : t('Add a photo')}
        </label>
      </div>
    </form>
  )
}

export function GoodThings() {
  const repos = useRepos()
  const toast = useToast()
  const today = useToday()
  const lifeLog = useLifeLog()
  const plans = usePlans()
  const checkIns = useCheckIns()
  const [toDelete, setToDelete] = useState<GoodThing | null>(null)

  const photos = useMemo(() => new Map(lifeLog?.filter((e) => e.photo).map((e) => [e.id, e.photo!]) ?? []), [lifeLog])
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
              {week.items.map((item) => {
                const photo = item.source === 'idea' || item.source === 'moment' ? photos.get(item.recordId) : undefined
                return (
                  <li key={item.key} className="card">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-serif text-lg text-ink">{item.source === 'idea' ? t(item.text) : item.text}</p>
                        <p className="mt-1 text-xs text-muted">
                          {t(GOOD_THING_LABELS[item.source])} · {formatLocalDate(item.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      {(item.source === 'idea' || item.source === 'moment') && (
                        <button type="button" className="btn-ghost btn-sm px-2" aria-label={t('Remove')} onClick={() => setToDelete(item)}>
                          <Icon name="trash" className="size-4" />
                        </button>
                      )}
                    </div>
                    {photo && <PhotoView photo={photo} alt="" className="mt-3 max-h-80" />}
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
      <ConfirmDialog
        open={!!toDelete}
        title={t('Remove this good thing?')}
        confirmLabel={t('Remove')}
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await repos.lifeLog.delete(toDelete.recordId)
          setToDelete(null)
          toast(t('Removed.'))
        }}
      >
        <p>{t('It will be permanently removed from this device.')}</p>
      </ConfirmDialog>
    </div>
  )
}
