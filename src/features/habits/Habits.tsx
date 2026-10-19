import { useEffect, useMemo, useState } from 'react'
import { useRepos } from '../../app/repos'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toaster'
import { logsByHabit, weekHistory, weekProgress } from '../../domain/habits'
import type { Habit } from '../../domain/types'
import { useHabitLogs, useHabits } from '../../hooks/useData'
import { useDeleteWithUndo } from '../../hooks/useDeleteWithUndo'
import { useToday } from '../../hooks/useToday'
import { t, tp } from '../../i18n'
import { weekSummaryText } from './habitText'
import { HabitHistory, HabitWeek } from './HabitWeek'

const SUGGESTIONS = ['Go to the gym', 'Read', 'Walk outside', 'Cook at home', 'Meditate', 'Practise an instrument', 'Call a friend', 'Journal']
const TARGETS: [number, string][] = [
  [7, 'Every day'],
  [5, '5× a week'],
  [3, '3× a week'],
  [2, '2× a week'],
  [1, 'Once a week'],
]

function TargetPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <fieldset>
      <legend className="label">{t('Weekly goal')}</legend>
      <div className="flex flex-wrap gap-2">
        {TARGETS.map(([n, label]) => (
          <button key={n} type="button" className={`chip ${value === n ? 'chip-selected' : ''}`} aria-pressed={value === n} onClick={() => onChange(n)}>
            {t(label)}
          </button>
        ))}
        <label className="chip gap-2">
          <span>{t('Other')}</span>
          <select className="bg-transparent" value={value} aria-label={t('Days per week')} onChange={(e) => onChange(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {tp(n, { one: '{count}× a week', other: '{count}× a week' })}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  )
}

function HabitForm({ habit, onDone }: { habit?: Habit; onDone: () => void }) {
  const repos = useRepos()
  const toast = useToast()
  const [name, setName] = useState(habit?.name ?? '')
  const [target, setTarget] = useState(habit?.targetPerWeek ?? 3)
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        try {
          if (habit) await repos.habits.update(habit.id, { name, targetPerWeek: target })
          else await repos.habits.add({ name, targetPerWeek: target })
          toast(habit ? t('Saved.') : t('Habit added.'))
          onDone()
        } catch {
          toast(t('Something went wrong. Please try again.'))
        }
      }}
    >
      <label className="block">
        <span className="label">{t('Habit')}</span>
        <input className="field" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Go to the gym')} autoFocus />
      </label>
      {!habit && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} type="button" className="chip" onClick={() => setName(t(suggestion))}>
              {t(suggestion)}
            </button>
          ))}
        </div>
      )}
      <TargetPicker value={target} onChange={setTarget} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onDone}>
          {t('Cancel')}
        </button>
        <button type="submit" className="btn-primary" disabled={!name.trim()}>
          {habit ? t('Save') : t('Add habit')}
        </button>
      </div>
    </form>
  )
}

function HabitCard({ habit, done, today, isFirst, isLast, onEdit }: { habit: Habit; done: ReadonlySet<string>; today: string; isFirst: boolean; isLast: boolean; onEdit: () => void }) {
  const repos = useRepos()
  const deleteWithUndo = useDeleteWithUndo()
  const progress = weekProgress(habit, done, today)
  const history = weekHistory(habit, done, today)
  return (
    <li className={`card space-y-3 ${habit.archived ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{habit.name}</p>
          <p className={`text-sm ${progress.met ? 'text-accent' : 'text-muted'}`}>{weekSummaryText(progress)}</p>
        </div>
        <div className="flex shrink-0">
          <button type="button" className="btn-ghost btn-sm px-1.5" aria-label={t('Move "{text}" up', { text: habit.name })} disabled={isFirst} onClick={() => void repos.habits.move(habit.id, -1)}>
            <Icon name="up" className="size-4" />
          </button>
          <button type="button" className="btn-ghost btn-sm px-1.5" aria-label={t('Move "{text}" down', { text: habit.name })} disabled={isLast} onClick={() => void repos.habits.move(habit.id, 1)}>
            <Icon name="down" className="size-4" />
          </button>
        </div>
      </div>
      <HabitWeek habit={habit} progress={progress} />
      <HabitHistory weeks={history} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <button type="button" className="link" onClick={onEdit}>
          {t('Edit')}
        </button>
        <button type="button" className="link" onClick={() => void repos.habits.update(habit.id, { archived: !habit.archived })}>
          {habit.archived ? t('Show on Home') : t('Hide from Home')}
        </button>
        <button type="button" className="link" onClick={() => void deleteWithUndo(() => repos.habits.delete(habit.id), t('Habit moved to Recently deleted.'))}>
          {t('Delete')}
        </button>
      </div>
    </li>
  )
}

/** Habits with a weekly goal — tick days off, see the week, never a streak. */
export function Habits() {
  const repos = useRepos()
  const today = useToday()
  const habits = useHabits()
  const logs = useHabitLogs()
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const done = useMemo(() => logsByHabit(logs ?? []), [logs])

  // Housekeeping: check-offs of habits that were removed for good.
  useEffect(() => {
    void repos.habits.removeOrphanLogs().catch(() => {})
  }, [repos])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="hint">{t('Things that are yours. Tick off the days you do them; each week starts fresh.')}</p>
        <button type="button" className="btn-primary shrink-0" onClick={() => setEditing('new')}>
          <Icon name="plus" />
          {t('Add')}
        </button>
      </div>
      {!habits || !logs ? (
        <p className="hint">{t('Loading…')}</p>
      ) : habits.length === 0 ? (
        <EmptyState message={t('Gym, reading, a walk, an instrument — add something you want to make room for.')} />
      ) : (
        <ul className="space-y-3">
          {habits.map((habit, index) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              done={done.get(habit.id) ?? new Set()}
              today={today}
              isFirst={index === 0}
              isLast={index === habits.length - 1}
              onEdit={() => setEditing(habit)}
            />
          ))}
        </ul>
      )}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? t('New habit') : t('Edit habit')}>
        {editing !== null && <HabitForm habit={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  )
}
