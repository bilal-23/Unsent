import { useRepos } from '../../app/repos'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toaster'
import { formatLocalDate } from '../../domain/dates'
import type { WeekProgress } from '../../domain/habits'
import type { Habit } from '../../domain/types'
import { t } from '../../i18n'

/** Seven tappable days (Monday first). Future days can't be ticked. */
export function HabitWeek({ habit, progress }: { habit: Habit; progress: WeekProgress }) {
  const repos = useRepos()
  const toast = useToast()
  return (
    <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={t('{habit}, this week', { habit: habit.name })}>
      {progress.days.map((day) => (
        <button
          key={day.date}
          type="button"
          disabled={day.isFuture}
          aria-pressed={day.done}
          aria-label={`${formatLocalDate(day.date, { weekday: 'long', month: 'short', day: 'numeric' })}${day.done ? `, ${t('done')}` : ''}`}
          className={`flex aspect-square min-h-10 flex-col items-center justify-center rounded-xl border text-xs transition-colors disabled:opacity-40 ${
            day.done ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface hover:bg-surface-2'
          } ${day.isToday && !day.done ? 'border-accent' : ''}`}
          onClick={async () => {
            try {
              await repos.habits.toggle(habit.id, day.date)
            } catch {
              toast(t('Something went wrong. Please try again.'))
            }
          }}
        >
          <span aria-hidden="true" className="font-medium">
            {formatLocalDate(day.date, { weekday: 'narrow' })}
          </span>
          {day.done ? <Icon name="check" className="size-3.5" /> : <span aria-hidden="true">{Number(day.date.slice(8))}</span>}
        </button>
      ))}
    </div>
  )
}

/** Eight small bars: done ÷ goal per week, oldest first. Quiet, no judgement. */
export function HabitHistory({ weeks }: { weeks: WeekProgress[] }) {
  return (
    <div className="flex items-end gap-1" aria-label={t('Last {n} weeks', { n: weeks.length })} role="img">
      {weeks.map((week) => (
        <div key={week.weekStart} className="flex flex-1 flex-col items-center gap-1" title={`${formatLocalDate(week.weekStart)}: ${week.done}/${week.target}`}>
          <div className="flex h-8 w-full items-end overflow-hidden rounded bg-surface-2">
            <div className={`w-full rounded ${week.met ? 'bg-accent' : 'bg-accent/50'}`} style={{ height: `${Math.min(100, (week.done / week.target) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
