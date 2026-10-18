import type { MoodPoint, TriggerCount, WeekBucket } from '../../domain/patterns'
import { daysBetween, formatLocalDate } from '../../domain/dates'
import { t, tp } from '../../i18n'

/** Weekly urge counts as plain bars. Hand-drawn SVG: no chart library, works offline. */
export function WeeklyBars({ weeks }: { weeks: WeekBucket[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.count))
  const width = 320
  const height = 120
  const gap = 4
  const barWidth = Math.max(4, (width - gap * (weeks.length - 1)) / weeks.length)
  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height + 18}`} className="w-full" role="img" aria-label={t('Urges per week')}>
        <line x1={0} x2={width} y1={height} y2={height} stroke="var(--line)" />
        {weeks.map((week, i) => {
          const h = (week.count / max) * (height - 8)
          const x = i * (barWidth + gap)
          return (
            <g key={week.weekStart}>
              <rect x={x} y={height - h} width={barWidth} height={Math.max(h, week.count ? 2 : 0)} rx={3} fill="var(--accent)" opacity={0.8}>
                <title>
                  {t('Week of {date}', { date: formatLocalDate(week.weekStart) })}: {tp(week.count, { one: '{count} urge', other: '{count} urges' })}
                </title>
              </rect>
              {weeks.length <= 13 && week.count > 0 && (
                <text x={x + barWidth / 2} y={height - h - 4} textAnchor="middle" fontSize={10} fill="var(--muted)">
                  {week.count}
                </text>
              )}
            </g>
          )
        })}
        <text x={0} y={height + 14} fontSize={10} fill="var(--muted)">
          {weeks.length ? formatLocalDate(weeks[0].weekStart, { month: 'short', day: 'numeric' }) : ''}
        </text>
        <text x={width} y={height + 14} fontSize={10} fill="var(--muted)" textAnchor="end">
          {t('This week')}
        </text>
      </svg>
      <figcaption className="sr-only">
        {weeks.map((w) => `${formatLocalDate(w.weekStart)}: ${w.count}`).join('; ')}
      </figcaption>
    </figure>
  )
}

export function TriggerBars({ triggers }: { triggers: TriggerCount[] }) {
  const max = Math.max(1, ...triggers.map((tr) => tr.count))
  return (
    <ul className="space-y-2">
      {triggers.slice(0, 6).map((trigger) => (
        <li key={trigger.trigger}>
          <div className="flex justify-between gap-3 text-sm">
            <span>{t(trigger.trigger)}</span>
            <span className="text-muted tabular-nums">{trigger.count}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div className="h-full rounded-full bg-accent/70" style={{ width: `${(trigger.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Mood by day as dots on a 1–5 strip. */
export function MoodStrip({ moods, start, end }: { moods: MoodPoint[]; start: string; end: string }) {
  const span = Math.max(1, daysBetween(start, end))
  const width = 320
  const height = 90
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={t('Mood by day')}>
      {[1, 2, 3, 4, 5].map((level) => {
        const y = height - 10 - ((level - 1) / 4) * (height - 20)
        return <line key={level} x1={0} x2={width} y1={y} y2={y} stroke="var(--line)" strokeDasharray={level === 3 ? undefined : '2 4'} />
      })}
      {moods.map((point) => {
        const x = (daysBetween(start, point.date) / span) * (width - 10) + 5
        const y = height - 10 - ((point.mood - 1) / 4) * (height - 20)
        return (
          <circle key={point.date} cx={x} cy={y} r={4} fill="var(--accent)">
            <title>
              {formatLocalDate(point.date)}: {point.mood}/5
            </title>
          </circle>
        )
      })}
    </svg>
  )
}
