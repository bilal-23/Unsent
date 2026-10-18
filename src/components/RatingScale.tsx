import { useId } from 'react'

export interface RatingScaleProps {
  label: string
  min?: number
  max: number
  value: number | undefined
  onChange: (value: number) => void
  /** Optional text for each value, used as accessible labels. */
  labels?: Record<number, string>
  lowHint?: string
  highHint?: string
  name?: string
}

/** A segmented 1–N scale built from real radio inputs (arrow keys work natively). */
export function RatingScale({ label, min = 1, max, value, onChange, labels, lowHint, highHint, name }: RatingScaleProps) {
  const groupId = useId()
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex gap-1.5" role="presentation">
        {values.map((n) => (
          <label key={n} className="min-w-0 flex-1">
            <input
              type="radio"
              className="peer sr-only"
              name={name ?? groupId}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              aria-label={labels?.[n] ? `${n} – ${labels[n]}` : String(n)}
            />
            <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-sm font-medium text-ink transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)] hover:bg-surface-2 peer-checked:hover:bg-accent">
              {n}
            </span>
          </label>
        ))}
      </div>
      {(lowHint || highHint || (value !== undefined && labels?.[value])) && (
        <div className="mt-1.5 flex justify-between text-xs text-muted">
          <span>{lowHint}</span>
          <span aria-live="polite">{value !== undefined ? labels?.[value] : ''}</span>
          <span>{highHint}</span>
        </div>
      )}
    </fieldset>
  )
}
