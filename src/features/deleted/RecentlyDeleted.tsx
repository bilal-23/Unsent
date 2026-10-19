import { useState } from 'react'
import { useRepos } from '../../app/repos'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { PageHeader } from '../../components/PageHeader'
import { useToast } from '../../components/Toaster'
import { StorageError } from '../../db/errors'
import { MOOD_LABELS } from '../../domain/constants'
import { formatLocalDate, formatTimestamp } from '../../domain/dates'
import { EXERCISES, getProgram } from '../../domain/programs'
import { TRASH_RETENTION_DAYS, type TrashableTable, type TrashEntry } from '../../domain/types'
import { useTrash } from '../../hooks/useData'
import { t, tp } from '../../i18n'
import { daysUntilPurge } from '../../repositories/trashRepo'

const KIND_LABELS: Record<TrashableTable, string> = {
  messages: 'Unsent message',
  urges: 'Urge',
  checkIns: 'Check-in',
  plans: 'Plan',
  lifeLog: 'Good thing',
  voiceNotes: 'Voice note',
  exerciseEntries: 'Exercise',
  trackers: 'Tracker',
  personalItems: 'List item',
  habits: 'Habit',
}

const firstLine = (text: string) => text.trim().split('\n').find((line) => line.trim())?.slice(0, 120) ?? ''

/** A short, safe description of a deleted entry. Sealed letters stay sealed here too. */
function describe(entry: TrashEntry): string {
  switch (entry.table) {
    case 'messages': {
      const m = entry.record
      if (m.sealedUntil) return t('A sealed letter')
      return m.title.trim() || firstLine(m.body) || t('Untitled')
    }
    case 'urges':
      return [t('Intensity {n}/10', { n: entry.record.intensity }), entry.record.trigger && t(entry.record.trigger)].filter(Boolean).join(' · ')
    case 'checkIns':
      return `${formatLocalDate(entry.record.localDate)} · ${t(MOOD_LABELS[entry.record.mood])}`
    case 'plans':
    case 'lifeLog':
    case 'personalItems':
      return entry.record.text
    case 'voiceNotes':
      return entry.record.title.trim() || t('Untitled voice note')
    case 'exerciseEntries': {
      const e = entry.record
      if (e.kind === 'program-day') return t('{program} · Day {n}', { program: t(getProgram(e.programId)?.title ?? 'Program'), n: e.day ?? '?' })
      return t(EXERCISES[e.kind].title)
    }
    case 'trackers':
    case 'habits':
      return entry.record.name
  }
}

export function RecentlyDeleted() {
  const repos = useRepos()
  const toast = useToast()
  const entries = useTrash()
  const [toDelete, setToDelete] = useState<TrashEntry | null>(null)
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  const restore = async (entry: TrashEntry) => {
    try {
      await repos.trash.restore(entry.id)
      toast(t('Restored.'))
    } catch (error) {
      toast(
        error instanceof StorageError && error.kind === 'conflict'
          ? entry.table === 'checkIns'
            ? t('There is already a check-in for that day. Delete it first to restore this one.')
            : t('It could not be restored because something else is in its place.')
          : t('Something went wrong. Please try again.'),
      )
    }
  }

  return (
    <div>
      <PageHeader
        title={t('Recently deleted')}
        helpId="deleted"
        back="/settings"
        subtitle={tp(TRASH_RETENTION_DAYS, {
          one: 'Deleted entries stay here for {count} day, then are removed for good.',
          other: 'Deleted entries stay here for {count} days, then are removed for good.',
        })}
        actions={
          entries && entries.length > 0 && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => setConfirmEmpty(true)}>
              {t('Empty')}
            </button>
          )
        }
      />
      <p className="hint mb-4">{t('Recently deleted entries are not included in backups.')}</p>

      {!entries ? (
        <p className="hint">{t('Loading…')}</p>
      ) : entries.length === 0 ? (
        <EmptyState message={t('Nothing here. Anything you delete can be restored from here for a while.')} />
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const days = daysUntilPurge(entry.deletedAt)
            return (
              <li key={entry.id} className="card">
                <p className="text-xs text-muted">{t(KIND_LABELS[entry.table])}</p>
                <p className="mt-0.5 line-clamp-2 font-serif text-lg text-ink">{describe(entry)}</p>
                <p className="mt-1 text-xs text-muted">
                  {t('Deleted {date}', { date: formatTimestamp(entry.deletedAt) })} ·{' '}
                  {tp(days, { zero: 'removed today', one: '{count} day left', other: '{count} days left' })}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn-primary btn-sm" onClick={() => void restore(entry)}>
                    {t('Restore')}
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setToDelete(entry)}>
                    {t('Delete now')}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={t('Delete this for good?')}
        confirmLabel={t('Delete permanently')}
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await repos.trash.remove(toDelete.id)
          if (toDelete?.table === 'habits') await repos.habits.removeOrphanLogs()
          setToDelete(null)
          toast(t('Deleted permanently.'))
        }}
      >
        <p>{t('It will be removed from this device and cannot be restored.')}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmEmpty}
        title={t('Empty Recently deleted?')}
        confirmLabel={t('Delete all permanently')}
        danger
        onCancel={() => setConfirmEmpty(false)}
        onConfirm={async () => {
          await repos.trash.empty()
          await repos.habits.removeOrphanLogs()
          setConfirmEmpty(false)
          toast(t('Recently deleted is empty.'))
        }}
      >
        <p>{t('Everything here will be removed from this device and cannot be restored.')}</p>
      </ConfirmDialog>
    </div>
  )
}
