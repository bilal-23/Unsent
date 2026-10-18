import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useRepos } from '../../app/repos'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/PageHeader'
import { useToast } from '../../components/Toaster'
import { EXERCISES, isStandaloneKind } from '../../domain/programs'
import { useExerciseEntries } from '../../hooks/useData'
import { t } from '../../i18n'
import { cleanFields, type StandaloneExerciseKind } from '../../domain/programs'
import { FieldsForm } from './FieldsForm'

export function ExerciseForm() {
  const { kind, id = 'new' } = useParams()
  const entries = useExerciseEntries()
  const isNew = id === 'new'
  const existing = isNew ? undefined : entries?.find((e) => e.id === id)

  if (!isStandaloneKind(kind)) return <p className="text-muted">{t('This exercise could not be found.')}</p>
  if (!isNew && !entries) return <p className="hint">{t('Loading…')}</p>
  if (!isNew && !existing) return <p className="text-muted">{t('This entry no longer exists.')}</p>
  return <ExerciseFormBody key={id} kind={kind} id={id} initial={existing?.fields ?? {}} />
}

function ExerciseFormBody({ kind, id, initial }: { kind: StandaloneExerciseKind; id: string; initial: Record<string, string> }) {
  const repos = useRepos()
  const navigate = useNavigate()
  const toast = useToast()
  const isNew = id === 'new'
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const exercise = EXERCISES[kind]

  return (
    <div>
      <PageHeader
        title={t(exercise.title)}
        back="/programs"
        actions={
          !isNew && (
            <button type="button" className="btn-ghost px-2.5" aria-label={t('Delete')} onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" />
            </button>
          )
        }
      />
      <p className="mb-6 text-muted">{t(exercise.intro)}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await repos.exercises.save({ id: isNew ? undefined : id, kind, fields: cleanFields(values) })
            toast(t('Saved.'))
            navigate('/programs')
          } catch {
            toast(t('Something went wrong. Please try again.'))
          }
        }}
      >
        <FieldsForm fields={exercise.fields} values={values} onChange={setValues} />
        <button type="submit" className="btn-primary mt-6 w-full" disabled={!Object.values(values).some((v) => v.trim())}>
          {t('Save')}
        </button>
      </form>
      <ConfirmDialog
        open={confirmDelete}
        title={t('Delete this exercise?')}
        confirmLabel={t('Delete permanently')}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await repos.exercises.delete(id)
          setConfirmDelete(false)
          toast(t('Deleted.'))
          navigate('/programs', { replace: true })
        }}
      >
        <p>{t('It will be permanently removed from this device.')}</p>
      </ConfirmDialog>
    </div>
  )
}
