import { useState } from 'react'
import { useRepos } from '../../app/repos'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toaster'
import { formatTimestamp } from '../../domain/dates'
import type { Plan } from '../../domain/types'
import { usePlans } from '../../hooks/useData'
import { t } from '../../i18n'

function PlanRow({ plan, onDelete }: { plan: Plan; onDelete: () => void }) {
  const repos = useRepos()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(plan.text)
  const done = plan.status === 'done'
  return (
    <li className="card flex items-center gap-3 py-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? t('Mark "{text}" as not done', { text: plan.text }) : t('Mark "{text}" as done', { text: plan.text })}
        className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${done ? 'border-accent bg-accent text-accent-ink' : 'border-line hover:border-accent'}`}
        onClick={() => void repos.plans.setDone(plan.id, !done)}
      >
        {done && <Icon name="check" className="size-4" />}
      </button>
      {editing ? (
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (text.trim()) await repos.plans.rename(plan.id, text)
            setEditing(false)
          }}
        >
          <input className="field py-1.5" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} autoFocus aria-label={t('Plan')} />
          <button type="submit" className="btn-secondary btn-sm">
            {t('Save')}
          </button>
        </form>
      ) : (
        <button type="button" className="min-w-0 flex-1 text-start" onClick={() => setEditing(true)}>
          <span className={done ? 'text-muted line-through' : 'text-ink'}>{plan.text}</span>
          {done && plan.doneAt && <span className="block text-xs text-muted">{t('Done {date}', { date: formatTimestamp(plan.doneAt, { dateStyle: 'medium' }) })}</span>}
        </button>
      )}
      <button type="button" className="btn-ghost btn-sm px-2" aria-label={t('Delete plan')} onClick={onDelete}>
        <Icon name="trash" className="size-4" />
      </button>
    </li>
  )
}

export function Plans() {
  const repos = useRepos()
  const toast = useToast()
  const plans = usePlans()
  const [text, setText] = useState('')
  const [toDelete, setToDelete] = useState<Plan | null>(null)
  const open = plans?.filter((p) => p.status === 'open') ?? []
  const done = plans?.filter((p) => p.status === 'done') ?? []

  return (
    <div className="space-y-5">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!text.trim()) return
          await repos.plans.add(text)
          setText('')
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t('New plan')}</span>
          <input className="field" value={text} maxLength={300} placeholder={t('Something to try, learn or get back to')} onChange={(e) => setText(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary" disabled={!text.trim()}>
          {t('Add')}
        </button>
      </form>

      {!plans ? (
        <p className="hint">{t('Loading…')}</p>
      ) : plans.length === 0 ? (
        <EmptyState message={t('A class, a trip, a hobby you put down. Plans are yours alone.')} />
      ) : (
        <>
          {open.length > 0 && (
            <ul className="space-y-2">
              {open.map((plan) => (
                <PlanRow key={plan.id} plan={plan} onDelete={() => setToDelete(plan)} />
              ))}
            </ul>
          )}
          {done.length > 0 && (
            <section>
              <h2 className="section-title mb-2">{t('Done')}</h2>
              <ul className="space-y-2">
                {done.map((plan) => (
                  <PlanRow key={plan.id} plan={plan} onDelete={() => setToDelete(plan)} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <ConfirmDialog
        open={!!toDelete}
        title={t('Delete this plan?')}
        confirmLabel={t('Delete')}
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await repos.plans.delete(toDelete.id)
          setToDelete(null)
          toast(t('Plan deleted.'))
        }}
      >
        <p>{t('It will be permanently removed from this device.')}</p>
      </ConfirmDialog>
    </div>
  )
}
