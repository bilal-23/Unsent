import { useState } from 'react'
import { useRepos } from '../../app/repos'
import { Icon } from '../../components/Icon'
import type { PersonalItemKind } from '../../domain/types'
import { usePersonalItems } from '../../hooks/useData'
import { t } from '../../i18n'

const COPY: Record<PersonalItemKind, { title: string; hint: string; placeholder: string }> = {
  reason: {
    title: 'Why I chose this',
    hint: 'Shown when you log an urge or start a message.',
    placeholder: 'e.g. I deserve someone who shows up consistently',
  },
  coping: {
    title: 'Things that help me',
    hint: 'Shown after you log an urge.',
    placeholder: 'e.g. Go for a walk, call my sister, take a shower',
  },
}

export function ListEditor({ kind }: { kind: PersonalItemKind }) {
  const repos = useRepos()
  const items = usePersonalItems(kind)
  const [text, setText] = useState('')
  const copy = COPY[kind]

  return (
    <div>
      <h3 className="font-medium">{t(copy.title)}</h3>
      <p className="hint">{t(copy.hint)}</p>
      <ul className="mt-3 space-y-1.5">
        {items?.map((item, index) => (
          <li key={item.id} className="flex items-center gap-1 rounded-xl border border-line px-3 py-1.5">
            <span className="min-w-0 flex-1 text-sm">{item.text}</span>
            <button type="button" className="btn-ghost btn-sm px-1.5" aria-label={t('Move up')} disabled={index === 0} onClick={() => void repos.personalItems.move(item.id, -1)}>
              <Icon name="up" className="size-4" />
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm px-1.5"
              aria-label={t('Move down')}
              disabled={index === items.length - 1}
              onClick={() => void repos.personalItems.move(item.id, 1)}
            >
              <Icon name="down" className="size-4" />
            </button>
            <button type="button" className="btn-ghost btn-sm px-1.5" aria-label={t('Remove "{text}"', { text: item.text })} onClick={() => void repos.personalItems.delete(item.id)}>
              <Icon name="x" className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!text.trim()) return
          await repos.personalItems.add(kind, text)
          setText('')
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t('Add to "{title}"', { title: t(copy.title) })}</span>
          <input className="field" value={text} maxLength={300} placeholder={t(copy.placeholder)} onChange={(e) => setText(e.target.value)} />
        </label>
        <button type="submit" className="btn-secondary" disabled={!text.trim()}>
          {t('Add')}
        </button>
      </form>
    </div>
  )
}
