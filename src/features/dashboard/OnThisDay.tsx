import { useMemo } from 'react'
import { collectGoodThings } from '../../domain/goodThings'
import { isValidLocalDate } from '../../domain/dates'
import type { DailyCheckIn, LifeLogEntry, Plan } from '../../domain/types'
import { t } from '../../i18n'

function sameDayAgo(today: string, months: number): string | null {
  const [y, m, d] = today.split('-').map(Number)
  const total = y * 12 + (m - 1) - months
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  const candidate = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return isValidLocalDate(candidate) ? candidate : null
}

/** Opt-in look-back at good things only — never unsent messages or urges. */
export function OnThisDay({ today, lifeLog, plans, checkIns }: { today: string; lifeLog: LifeLogEntry[]; plans: Plan[]; checkIns: DailyCheckIn[] }) {
  const groups = useMemo(() => {
    const all = collectGoodThings(lifeLog, plans, checkIns)
    return [
      { label: t('A month ago'), date: sameDayAgo(today, 1) },
      { label: t('A year ago'), date: sameDayAgo(today, 12) },
    ]
      .map((group) => ({ ...group, items: group.date ? all.filter((item) => item.date === group.date) : [] }))
      .filter((group) => group.items.length)
  }, [today, lifeLog, plans, checkIns])

  if (!groups.length) return null
  return (
    <section className="card" aria-labelledby="on-this-day">
      <h2 id="on-this-day" className="section-title">
        {t('On this day')}
      </h2>
      {groups.map((group) => (
        <div key={group.label} className="mt-2">
          <p className="text-xs text-muted">{group.label}</p>
          <ul className="mt-1 space-y-1 font-serif text-ink">
            {group.items.map((item) => (
              <li key={item.key}>· {item.text}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
