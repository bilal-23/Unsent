import { useMemo } from 'react'
import { Link } from 'react-router'
import { useRepos } from '../../app/repos'
import { Icon } from '../../components/Icon'
import { logsByHabit, weekProgress } from '../../domain/habits'
import { useHabitLogs, useHabits } from '../../hooks/useData'
import { t } from '../../i18n'
import { weekSummaryText } from './habitText'

/** Home card: tick today's habits in one tap. */
export function HabitsToday({ today }: { today: string }) {
  const repos = useRepos()
  const habits = useHabits()?.filter((habit) => !habit.archived)
  const logs = useHabitLogs()
  const done = useMemo(() => logsByHabit(logs ?? []), [logs])
  if (!habits || !logs) return null

  return (
    <section className="card" aria-labelledby="habits-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="habits-title" className="section-title">
          {t('Habits')}
        </h2>
        <Link to="/journal/habits" className="link text-sm">
          {habits.length ? t('All habits') : t('Add a habit')}
        </Link>
      </div>
      {habits.length === 0 ? (
        <p className="hint mt-2">{t('Track things that are yours — the gym, reading, a walk — with a weekly goal.')}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {habits.map((habit) => {
            const dates = done.get(habit.id) ?? new Set<string>()
            const doneToday = dates.has(today)
            const progress = weekProgress(habit, dates, today)
            return (
              <li key={habit.id} className="flex items-center gap-3 py-1">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={doneToday}
                  aria-label={t('{habit} today', { habit: habit.name })}
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${doneToday ? 'border-accent bg-accent text-accent-ink' : 'border-line hover:border-accent'}`}
                  onClick={() => void repos.habits.toggle(habit.id, today)}
                >
                  {doneToday && <Icon name="check" className="size-4" />}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block text-ink">{habit.name}</span>
                  <span className={`block text-xs ${progress.met ? 'text-accent' : 'text-muted'}`}>{weekSummaryText(progress)}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
