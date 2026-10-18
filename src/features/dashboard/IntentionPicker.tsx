import { useState } from 'react'
import { INTENTION_PRESETS, MAX_INTENTION_DAYS } from '../../domain/constants'
import { t, tp } from '../../i18n'

/** Optional, gentle intention ("I'm aiming for 30 days"). Never a pass/fail challenge. */
export function IntentionPicker({ value, onChange }: { value: number | undefined; onChange: (value: number | undefined) => void }) {
  const isCustom = value !== undefined && !(INTENTION_PRESETS as readonly number[]).includes(value)
  const [custom, setCustom] = useState(isCustom ? String(value) : '')
  const [showCustom, setShowCustom] = useState(isCustom)

  return (
    <fieldset>
      <legend className="label">
        {t('An intention')} <span className="font-normal text-muted">({t('optional')})</span>
      </legend>
      <p className="hint mb-2">{t('A gentle aim to keep in mind. If plans change, nothing is lost.')}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`chip ${value === undefined && !showCustom ? 'chip-selected' : ''}`} aria-pressed={value === undefined && !showCustom} onClick={() => { setShowCustom(false); onChange(undefined) }}>
          {t('None')}
        </button>
        {INTENTION_PRESETS.map((days) => (
          <button
            key={days}
            type="button"
            className={`chip ${value === days && !showCustom ? 'chip-selected' : ''}`}
            aria-pressed={value === days && !showCustom}
            onClick={() => {
              setShowCustom(false)
              onChange(days)
            }}
          >
            {tp(days, { one: '{count} day', other: '{count} days' })}
          </button>
        ))}
        <button
          type="button"
          className={`chip ${showCustom ? 'chip-selected' : ''}`}
          aria-pressed={showCustom}
          onClick={() => {
            setShowCustom(true)
            const n = Number(custom)
            onChange(Number.isInteger(n) && n >= 1 ? n : undefined)
          }}
        >
          {t('Custom')}
        </button>
      </div>
      {showCustom && (
        <label className="mt-2 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_INTENTION_DAYS}
            className="field w-28"
            value={custom}
            aria-label={t('Number of days')}
            onChange={(e) => {
              setCustom(e.target.value)
              const n = Math.floor(Number(e.target.value))
              onChange(n >= 1 && n <= MAX_INTENTION_DAYS ? n : undefined)
            }}
            autoFocus
          />
          <span className="text-sm text-muted">{t('days')}</span>
        </label>
      )}
    </fieldset>
  )
}
