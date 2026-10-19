import { useState } from 'react'
import { useRepos } from '../../app/repos'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { Modal } from '../../components/Modal'
import { PageHeader } from '../../components/PageHeader'
import { useToast } from '../../components/Toaster'
import { daysBetween, formatLocalDate, intentionStatus, isValidLocalDate, noContactStatus } from '../../domain/dates'
import type { Tracker } from '../../domain/types'
import { useTrackers } from '../../hooks/useData'
import { useDeleteWithUndo } from '../../hooks/useDeleteWithUndo'
import { useToday } from '../../hooks/useToday'
import { t, tp } from '../../i18n'
import { IntentionPicker } from '../dashboard/IntentionPicker'

const SUGGESTIONS = ['Not checking their profile', 'Not rereading old messages', 'Less doomscrolling', 'Phone out of the bedroom']

function TrackerDialog({ open, tracker, onClose }: { open: boolean; tracker: Tracker | null; onClose: () => void }) {
  const repos = useRepos()
  const toast = useToast()
  const today = useToday()
  const [name, setName] = useState(tracker?.name ?? '')
  const [startDate, setStartDate] = useState(tracker?.startDate ?? today)
  const [intention, setIntention] = useState(tracker?.intentionDays)
  const dateOk = isValidLocalDate(startDate) && daysBetween(startDate, today) >= 0

  return (
    <Modal open={open} onClose={onClose} title={tracker ? t('Edit tracker') : t('New tracker')}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim() || !dateOk) return
          if (tracker) await repos.trackers.update(tracker.id, { name, startDate, intentionDays: intention })
          else await repos.trackers.add({ name, startDate, intentionDays: intention })
          toast(t('Saved.'))
          onClose()
        }}
      >
        <label className="block">
          <span className="label">{t('What are you tracking?')}</span>
          <input className="field" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        {!tracker && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" className="chip" onClick={() => setName(t(suggestion))}>
                {t(suggestion)}
              </button>
            ))}
          </div>
        )}
        <label className="block">
          <span className="label">{t('Counting from')}</span>
          <input type="date" className="field" value={startDate} max={today} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <IntentionPicker value={intention} onChange={setIntention} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={!name.trim() || !dateOk}>
            {t('Save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Extra trackers beside no contact. Restarting is just a new date — never a failure. */
export function Trackers() {
  const repos = useRepos()
  const toast = useToast()
  const today = useToday()
  const trackers = useTrackers()
  const [editing, setEditing] = useState<Tracker | 'new' | null>(null)
  const [restart, setRestart] = useState<Tracker | null>(null)
  const deleteWithUndo = useDeleteWithUndo()

  return (
    <div>
      <PageHeader
        title={t('Other trackers')}
        helpId="trackers"
        back="/settings"
        subtitle={t('Optional. For other habits you are changing alongside no contact.')}
        actions={
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            {t('Add')}
          </button>
        }
      />
      {!trackers ? (
        <p className="hint">{t('Loading…')}</p>
      ) : trackers.length === 0 ? (
        <EmptyState message={t('Add a tracker for anything else you are working on — like not checking their profile.')} />
      ) : (
        <ul className="space-y-2">
          {trackers.map((tracker) => {
            const status = noContactStatus(tracker.startDate, today)
            const intention = intentionStatus(tracker.intentionDays, status)
            return (
              <li key={tracker.id} className={`card ${tracker.archived ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{tracker.name}</p>
                  <p className="text-sm text-muted">
                    {status.kind === 'ok' ? tp(status.days, { zero: 'Starting today', one: '{count} day', other: '{count} days' }) : ''}
                    {intention.kind === 'inProgress' && ` · ${t('aiming for {of}', { of: intention.of })}`}
                    {intention.kind === 'reached' && ` · ${t('intention reached')}`}
                  </p>
                </div>
                <p className="hint text-xs">{t('Since {date}', { date: formatLocalDate(tracker.startDate) })}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <button type="button" className="link" onClick={() => setEditing(tracker)}>
                    {t('Edit')}
                  </button>
                  <button type="button" className="link" onClick={() => setRestart(tracker)}>
                    {t('Start again from today')}
                  </button>
                  <button type="button" className="link" onClick={() => void repos.trackers.update(tracker.id, { archived: !tracker.archived })}>
                    {tracker.archived ? t('Show on Home') : t('Hide from Home')}
                  </button>
                  <button
                    type="button"
                    className="link"
                    onClick={() => void deleteWithUndo(() => repos.trackers.delete(tracker.id), t('Tracker moved to Recently deleted.'))}
                  >
                    {t('Delete')}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {editing && <TrackerDialog key={editing === 'new' ? 'new' : editing.id} open tracker={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!restart}
        title={t('Start again from today?')}
        confirmLabel={t('Start again')}
        onCancel={() => setRestart(null)}
        onConfirm={async () => {
          if (restart) await repos.trackers.update(restart.id, { startDate: today })
          setRestart(null)
          toast(t('Counting from today.'))
        }}
      >
        <p>{t('That is okay. Starting again is part of changing a habit.')}</p>
      </ConfirmDialog>
    </div>
  )
}
