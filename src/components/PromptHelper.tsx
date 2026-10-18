import { useState } from 'react'
import { nextPromptIndex, PROMPTS, type PromptContext } from '../domain/prompts'
import { t } from '../i18n'

/** "Need a prompt?" — shows a prompt above a field. It never writes into the field. */
export function PromptHelper({ context }: { context: PromptContext }) {
  const [index, setIndex] = useState<number | null>(null)

  if (index === null) {
    return (
      <button type="button" className="link text-sm" onClick={() => setIndex(nextPromptIndex(context, null))}>
        {t('Need a prompt?')}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-xl bg-accent-soft px-3 py-2.5 text-sm" aria-live="polite">
      <p className="min-w-0 flex-1 font-serif text-base text-ink">{t(PROMPTS[context][index])}</p>
      <div className="flex gap-3">
        <button type="button" className="link" onClick={() => setIndex(nextPromptIndex(context, index))}>
          {t('Another')}
        </button>
        <button type="button" className="link" onClick={() => setIndex(null)}>
          {t('Dismiss')}
        </button>
      </div>
    </div>
  )
}
