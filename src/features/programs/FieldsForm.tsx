import { useId } from 'react'
import type { ExerciseField } from '../../domain/programs'
import { t } from '../../i18n'

export function FieldsForm({
  fields,
  values,
  onChange,
}: {
  fields: ExerciseField[]
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
}) {
  const prefix = useId()
  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <div key={field.id}>
          <label htmlFor={`${prefix}-${field.id}`} className="label">
            {t(field.label)}
          </label>
          {field.hint && (
            <span id={`${prefix}-${field.id}-hint`} className="hint mb-1.5 block">
              {t(field.hint)}
            </span>
          )}
          {field.multiline ? (
            <textarea
              id={`${prefix}-${field.id}`}
              aria-describedby={field.hint ? `${prefix}-${field.id}-hint` : undefined}
              className="field min-h-28 font-serif"
              value={values[field.id] ?? ''}
              maxLength={20000}
              onChange={(e) => onChange({ ...values, [field.id]: e.target.value })}
            />
          ) : (
            <input
              id={`${prefix}-${field.id}`}
              aria-describedby={field.hint ? `${prefix}-${field.id}-hint` : undefined}
              className="field"
              value={values[field.id] ?? ''}
              maxLength={1000}
              onChange={(e) => onChange({ ...values, [field.id]: e.target.value })}
            />
          )}
        </div>
      ))}
    </div>
  )
}
