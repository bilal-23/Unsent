import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { formatTimestamp } from '../../domain/dates'
import { EXERCISES, programDays, PROGRAMS } from '../../domain/programs'
import { useExerciseEntries } from '../../hooks/useData'
import { t, tp } from '../../i18n'

export function Programs() {
  const entries = useExerciseEntries()

  return (
    <div className="space-y-6">
      <PageHeader title={t('Guided programs')} back="/" subtitle={t('Short readings and small exercises, at your own pace. No dates, no streaks.')} />

      {PROGRAMS.map((program) => {
        const days = programDays(program)
        const done = new Set(entries?.filter((e) => e.kind === 'program-day' && e.programId === program.id).map((e) => e.day))
        const next = days.find((d) => !done.has(d.day)) ?? days[0]
        return (
          <section key={program.id} className="card" aria-labelledby={`program-${program.id}`}>
            <h2 id={`program-${program.id}`} className="font-serif text-2xl">
              {t(program.title)}
            </h2>
            <p className="hint mt-1">{t(program.summary)}</p>
            <p className="mt-3 text-sm">{tp(done.size, { zero: 'Not started yet', one: '{count} of {total} days done', other: '{count} of {total} days done' }, { total: days.length })}</p>
            <Link to={`/programs/${program.id}/${next.day}`} className="btn-primary mt-4">
              {done.size === 0 ? t('Begin day 1') : done.size >= days.length ? t('Revisit') : t('Continue with day {n}', { n: next.day })}
            </Link>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted">{t('All days')}</summary>
              <div className="mt-3 space-y-4">
                {program.weeks.map((week, index) => (
                  <div key={week.title}>
                    <p className="section-title">{t('Week {n}: {title}', { n: index + 1, title: t(week.title) })}</p>
                    <ul className="mt-1.5 space-y-1">
                      {week.days.map((day) => (
                        <li key={day.day}>
                          <Link to={`/programs/${program.id}/${day.day}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                            <span className={`flex size-5 items-center justify-center rounded-full border text-[0.65rem] ${done.has(day.day) ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'}`}>
                              {done.has(day.day) ? <Icon name="check" className="size-3" /> : day.day}
                            </span>
                            {t(day.title)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          </section>
        )
      })}

      <section>
        <h2 className="section-title mb-2">{t('Exercises')}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {Object.values(EXERCISES).map((exercise) => {
            const count = entries?.filter((e) => e.kind === exercise.kind).length ?? 0
            return (
              <li key={exercise.kind}>
                <Link to={`/exercises/${exercise.kind}/new`} className="card block h-full hover:bg-surface-2">
                  <p className="font-medium">{t(exercise.title)}</p>
                  <p className="hint mt-1">{t(exercise.summary)}</p>
                  {count > 0 && <p className="mt-2 text-xs text-muted">{tp(count, { one: '{count} saved', other: '{count} saved' })}</p>}
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {entries && entries.some((e) => e.kind !== 'program-day') && (
        <section>
          <h2 className="section-title mb-2">{t('Your saved exercises')}</h2>
          <ul className="space-y-2">
            {entries
              .filter((e) => e.kind !== 'program-day')
              .map((entry) => (
                <li key={entry.id}>
                  <Link to={`/exercises/${entry.kind}/${entry.id}`} className="card flex justify-between gap-3 py-3 hover:bg-surface-2">
                    <span>{t(EXERCISES[entry.kind as keyof typeof EXERCISES]?.title ?? entry.kind)}</span>
                    <span className="text-xs text-muted">{formatTimestamp(entry.updatedAt, { dateStyle: 'medium' })}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}
