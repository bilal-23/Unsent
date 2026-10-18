import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useRepos } from '../../app/repos'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toaster'
import { recentlyDoneIdeaIds } from '../../domain/goodThings'
import { IDEA_CATEGORY_LABELS, ideaForDay } from '../../domain/ideas'
import type { LifeLogEntry } from '../../domain/types'
import { t } from '../../i18n'
import { readJson, STORAGE_KEYS, writeJson } from '../../lib/storage'

interface IdeaState {
  date: string
  offset: number
  status: 'open' | 'done' | 'hidden'
}

export function TodayIdea({ today, lifeLog, prominent }: { today: string; lifeLog: LifeLogEntry[]; prominent: boolean }) {
  const repos = useRepos()
  const toast = useToast()
  const [state, setState] = useState<IdeaState>(() => {
    const stored = readJson<IdeaState>('localStorage', STORAGE_KEYS.idea)
    return stored?.date === today ? stored : { date: today, offset: 0, status: 'open' }
  })
  const current = state.date === today ? state : { date: today, offset: 0, status: 'open' as const }

  const update = (next: IdeaState) => {
    setState(next)
    writeJson('localStorage', STORAGE_KEYS.idea, next)
  }

  const recent = useMemo(() => recentlyDoneIdeaIds(lifeLog, today), [lifeLog, today])
  const idea = useMemo(() => ideaForDay(today, current.offset, recent), [today, current.offset, recent])
  // Keep showing the idea that was just done, even though it is now "recent".
  const doneToday = lifeLog.find((entry) => entry.kind === 'idea' && entry.localDate === today)

  if (current.status === 'hidden') return null

  if (current.status === 'done' || doneToday) {
    return (
      <section className="card flex items-center gap-3" aria-label={t('Idea for today')}>
        <Icon name="check" className="size-5 text-accent" />
        <p className="min-w-0 flex-1 text-sm">
          {t('Added to your good things.')}{' '}
          <Link className="link" to="/journal/good-things">
            {t('See them')}
          </Link>
        </p>
      </section>
    )
  }

  return (
    <section className={`card ${prominent ? 'border-accent/40' : ''}`} aria-labelledby="idea-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="idea-title" className="section-title">
          {t('An idea for today')}
        </h2>
        <span className="text-xs text-muted">{t(IDEA_CATEGORY_LABELS[idea.category])}</span>
      </div>
      <p className={`mt-2 font-serif text-ink ${prominent ? 'text-xl' : 'text-lg'}`}>{t(idea.text)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={async () => {
            try {
              await repos.lifeLog.logIdea(idea.id, idea.text, today)
              update({ ...current, status: 'done' })
            } catch {
              toast(t('Something went wrong. Please try again.'))
            }
          }}
        >
          <Icon name="check" className="size-4" />
          {t('Did it')}
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => update({ ...current, offset: current.offset + 1 })}>
          <Icon name="shuffle" className="size-4" />
          {t('Swap')}
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => update({ ...current, status: 'hidden' })}>
          {t('Not today')}
        </button>
      </div>
    </section>
  )
}
