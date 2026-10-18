import { useId, useState } from 'react'
import { t } from '../i18n'

export interface ChipPickerProps {
  label: string
  options: readonly string[]
  value: string | undefined
  onChange: (value: string | undefined) => void
  allowCustom?: boolean
  customLabel?: string
}

/** Single-choice chips with an optional free-text "Other". Tapping the selected chip clears it. */
export function ChipPicker({ label, options, value, onChange, allowCustom = true, customLabel = t('Other…') }: ChipPickerProps) {
  const id = useId()
  const isCustom = value !== undefined && !options.includes(value)
  const [showCustom, setShowCustom] = useState(isCustom)

  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option
          return (
            <button
              key={option}
              type="button"
              className={`chip ${selected ? 'chip-selected' : ''}`}
              aria-pressed={selected}
              onClick={() => {
                setShowCustom(false)
                onChange(selected ? undefined : option)
              }}
            >
              {t(option)}
            </button>
          )
        })}
        {allowCustom && (
          <button
            type="button"
            className={`chip ${showCustom ? 'chip-selected' : ''}`}
            aria-pressed={showCustom}
            aria-controls={showCustom ? `${id}-custom` : undefined}
            onClick={() => {
              const next = !showCustom
              setShowCustom(next)
              if (!next && isCustom) onChange(undefined)
              if (next && !isCustom) onChange(undefined)
            }}
          >
            {customLabel}
          </button>
        )}
      </div>
      {allowCustom && showCustom && (
        <input
          id={`${id}-custom`}
          className="field mt-2"
          aria-label={t('{label} (your own words)', { label })}
          value={isCustom ? value : ''}
          maxLength={200}
          onChange={(e) => onChange(e.target.value || undefined)}
          autoFocus
        />
      )}
    </fieldset>
  )
}
