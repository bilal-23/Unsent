import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useRepos } from '../../app/repos'
import { PageHeader } from '../../components/PageHeader'
import { useToast } from '../../components/Toaster'
import { EXERCISES, getProgram, getProgramDay, programDays, type ProgramDayDefinition, type ProgramDefinition } from '../../domain/programs'
import type { ExerciseEntry } from '../../domain/types'
import { useExerciseEntries } from '../../hooks/useData'
import { t } from '../../i18n'
import { cleanFields } from '../../domain/programs'
import { FieldsForm } from './FieldsForm'

export function ProgramDay() {
  const { programId, day: dayParam } = useParams()
  const program = getProgram(programId)
  const dayNumber = Number(dayParam)
  const day = program ? getProgramDay(program, dayNumber) : undefined
  const entries = useExerciseEntries()
  const existing = entries?.find((e) => e.kind === 'program-day' && e.programId === programId && e.day === dayNumber)

  if (!program || !day) return <p className="text-muted">{t('This day could not be found.')}</p>
  if (!entries) return <p className="hint">{t('Loading…')}</p>
  return <ProgramDayBody key={`${program.id}-${day.day}`} program={program} day={day} existing={existing} />
}

function ProgramDayBody({ program, day, existing }: { program: ProgramDefinition; day: ProgramDayDefinition; existing: ExerciseEntry | undefined }) {
  const repos = useRepos()
  const navigate = useNavigate()
  const toast = useToast()
  const dayNumber = day.day
  const [values, setValues] = useState<Record<string, string>>(existing?.fields ?? {})

  const total = programDays(program).length
  const week = program.weeks.findIndex((w) => w.days.some((d) => d.day === dayNumber)) + 1
  const exercise = day.exercise ? EXERCISES[day.exercise] : undefined

  return (
    <div>
      <PageHeader title={t(day.title)} back="/programs" subtitle={t('{program} · Week {week} · Day {day} of {total}', { program: t(program.title), week, day: day.day, total })} />
      <p className="font-serif text-lg leading-relaxed text-ink">{t(day.reading)}</p>

      {exercise && (
        <div className="card mt-5 flex flex-wrap items-center gap-3 bg-surface-2">
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">{t(exercise.title)}</span> — {t(exercise.summary)}
          </p>
          <Link to={`/exercises/${exercise.kind}/new`} className="btn-secondary btn-sm">
            {t('Open exercise')}
          </Link>
        </div>
      )}

      <form
        className="mt-6"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await repos.exercises.saveProgramDay(program.id, day.day, cleanFields(values))
            toast(t('Day {n} saved.', { n: day.day }))
            navigate(day.day < total ? `/programs/${program.id}/${day.day + 1}` : '/programs')
          } catch {
            toast(t('Something went wrong. Please try again.'))
          }
        }}
      >
        <FieldsForm fields={day.fields} values={values} onChange={setValues} />
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="submit" className="btn-primary flex-1">
            {existing ? t('Save changes') : t('Mark day as done')}
          </button>
          {day.day > 1 && (
            <Link to={`/programs/${program.id}/${day.day - 1}`} className="btn-ghost">
              {t('Previous day')}
            </Link>
          )}
        </div>
        <p className="hint mt-3 text-xs">{t('Writing is optional — you can mark a day done without answering.')}</p>
      </form>
    </div>
  )
}
