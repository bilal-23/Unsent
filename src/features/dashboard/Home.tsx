import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useRepos } from '../../app/repos'
import { Icon } from '../../components/Icon'
import { HelpButton, HelpNote } from '../../components/HelpNote'
import { SearchButton } from '../../components/SearchButton'
import { collectGoodThings } from '../../domain/goodThings'
import { addDays, daysBetween, intentionStatus, localDateOf, noContactStatus } from '../../domain/dates'
import { fadeStage, type FadeStage } from '../../domain/fade'
import { isReadyToOpen } from '../../domain/sealing'
import type { Preferences, TrackingSettings } from '../../domain/types'
import { useCheckIns, useLifeLog, useMessages, usePlans, usePreferences, useSettings, useUrges } from '../../hooks/useData'
import { useToday } from '../../hooks/useToday'
import { t, tp } from '../../i18n'
import { DateChangeDialog } from './DateChangeDialog'
import { DayCounter } from './DayCounter'
import { HomeNotices } from './HomeNotices'
import { IntentionDialog } from './IntentionDialog'
import { OnThisDay } from './OnThisDay'
import { TodayIdea } from './TodayIdea'
import { TrackerCards } from './TrackerCards'
import { HabitsToday } from '../habits/HabitsToday'

function QuickActions({ checkedInToday, compact }: { checkedInToday: boolean; compact: boolean }) {
  const base = compact ? 'btn-secondary justify-start' : 'btn-secondary min-h-14 justify-start text-base'
  return (
    <section aria-label={t('Quick actions')} className={`grid gap-2 ${compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'}`}>
      <Link to="/unsent/new" className={compact ? base : 'btn-primary min-h-14 justify-start text-base'}>
        <Icon name="pen" />
        {t('Write an unsent message')}
      </Link>
      <Link to="/urges/new" className={base}>
        <Icon name="wave" />
        {t('Log an urge')}
      </Link>
      <Link to="/journal/check-in/today" className={base}>
        <Icon name="sun" />
        {checkedInToday ? t("Edit today's check-in") : t("Today's check-in")}
      </Link>
    </section>
  )
}

function Greeting({ settings }: { settings: TrackingSettings }) {
  const hour = new Date().getHours()
  const greeting = hour < 5 ? t('Good night') : hour < 12 ? t('Good morning') : hour < 18 ? t('Good afternoon') : t('Good evening')
  return (
    <div className="mb-2 flex items-start justify-between gap-2">
      <div>
        <h1 className="font-serif text-3xl text-ink">{greeting}</h1>
        {settings.journalName && <p className="hint mt-1">{settings.journalName}</p>}
      </div>
      <div className="flex">
        <HelpButton id="home" />
        <SearchButton />
      </div>
    </div>
  )
}

export function Home() {
  const repos = useRepos()
  const today = useToday()
  const settingsRecord = useSettings()
  const preferences = usePreferences()
  const messages = useMessages()
  const urges = useUrges()
  const checkIns = useCheckIns()
  const plans = usePlans()
  const lifeLog = useLifeLog()
  const [dateDialog, setDateDialog] = useState<'contact' | 'correct' | null>(null)
  const [intentionOpen, setIntentionOpen] = useState(false)

  const settings = settingsRecord?.value
  const loading = !settingsRecord || !preferences || !messages || !urges || !checkIns || !plans || !lifeLog

  const status = noContactStatus(settings?.lastContactDate, today)
  const intention = intentionStatus(settings?.intentionDays, status)
  const stage: FadeStage = preferences ? fadeStage(status, intention, preferences.fadeMode) : 'early'

  const weekStart = addDays(today, -6)
  const recent = useMemo(() => {
    const inWeek = (date: string) => daysBetween(weekStart, date) >= 0 && daysBetween(date, today) >= 0
    return {
      messages: messages?.filter((m) => inWeek(localDateOf(m.createdAt))).length ?? 0,
      urges: urges?.filter((u) => inWeek(localDateOf(u.createdAt))).length ?? 0,
      checkIns: checkIns?.filter((c) => inWeek(c.localDate)).length ?? 0,
    }
  }, [messages, urges, checkIns, weekStart, today])

  const goodThisWeek = useMemo(
    () => (lifeLog && plans && checkIns ? collectGoodThings(lifeLog, plans, checkIns).filter((g) => daysBetween(weekStart, g.date) >= 0) : []),
    [lifeLog, plans, checkIns, weekStart],
  )

  if (loading || !settings) return <p className="hint">{t('Loading…')}</p>

  const prefs = preferences as Preferences
  const checkedInToday = checkIns.some((c) => c.localDate === today)
  const readyLetters = messages.filter((m) => isReadyToOpen(m, today))
  const openPlans = plans.filter((p) => p.status === 'open').slice(0, 3)
  const lifeFirst = stage !== 'early'
  const hasAnyData = messages.length + urges.length + checkIns.length + plans.length + lifeLog.length > 0

  const counter = prefs.showDayCount ? (
    <DayCounter
      status={status}
      intention={intention}
      stage={stage}
      onEditDate={() => setDateDialog('correct')}
      onHadContact={() => setDateDialog('contact')}
      onEditIntention={() => setIntentionOpen(true)}
      onHide={() => void repos.preferences.update({ showDayCount: false })}
    />
  ) : (
    <p className="text-sm text-muted">
      {t('Day count hidden.')}{' '}
      <button type="button" className="link" onClick={() => void repos.preferences.update({ showDayCount: true })}>
        {t('Show')}
      </button>
    </p>
  )

  const life = (
    <>
      {prefs.showIdeas && <TodayIdea today={today} lifeLog={lifeLog} prominent={lifeFirst} />}
      <HabitsToday today={today} />
      {lifeFirst && (
        <section className="card" aria-labelledby="plans-title">
          <div className="flex items-center justify-between gap-2">
            <h2 id="plans-title" className="section-title">
              {t('Your plans')}
            </h2>
            <Link to="/journal/plans" className="link text-sm">
              {openPlans.length ? t('All plans') : t('Add a plan')}
            </Link>
          </div>
          {openPlans.length ? (
            <ul className="mt-2 space-y-1.5">
              {openPlans.map((plan) => (
                <li key={plan.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line hover:border-accent"
                    aria-label={t('Mark "{text}" as done', { text: plan.text })}
                    onClick={() => void repos.plans.setDone(plan.id, true)}
                  />
                  <span className="min-w-0 flex-1">{plan.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint mt-2">{t('Something to try, learn or get back to.')}</p>
          )}
        </section>
      )}
      {lifeFirst && (
        <section className="card" aria-labelledby="good-title">
          <div className="flex items-center justify-between gap-2">
            <h2 id="good-title" className="section-title">
              {t('This week, for you')}
            </h2>
            <Link to="/journal/good-things" className="link text-sm">
              {t('Good things')}
            </Link>
          </div>
          {goodThisWeek.length ? (
            <ul className="mt-2 space-y-1 font-serif text-ink">
              {goodThisWeek.slice(0, 4).map((item) => (
                <li key={item.key}>· {item.text}</li>
              ))}
            </ul>
          ) : (
            <p className="hint mt-2">{t('Good things you do or notice will collect here.')}</p>
          )}
        </section>
      )}
    </>
  )

  return (
    <div className="space-y-4">
      {lifeFirst ? (
        <Greeting settings={settings} />
      ) : (
        <div className="-mb-2 flex items-center justify-between">
          <h1 className="sr-only">{t('Home')}</h1>
          <span aria-hidden="true" />
          <div className="flex">
            <HelpButton id="home" />
            <SearchButton />
          </div>
        </div>
      )}
      <HelpNote id="home" />

      <HomeNotices today={today} readyLetters={readyLetters} preferences={prefs} settings={settings} hasAnyData={hasAnyData} stage={stage} />

      {lifeFirst ? (
        <>
          {life}
          <QuickActions checkedInToday={checkedInToday} compact />
          <TrackerCards today={today} />
          {counter}
        </>
      ) : (
        <>
          {counter}
          <QuickActions checkedInToday={checkedInToday} compact={false} />
          <TrackerCards today={today} />
          {life}
        </>
      )}

      {prefs.onThisDay && <OnThisDay today={today} lifeLog={lifeLog} plans={plans} checkIns={checkIns} />}

      <section className="card" aria-labelledby="recent-title">
        <h2 id="recent-title" className="section-title">
          {t('The last 7 days')}
        </h2>
        <ul className="mt-2 grid grid-cols-3 gap-2 text-center">
          <li>
            <p className="font-serif text-2xl tabular-nums">{recent.messages}</p>
            <p className="text-xs text-muted">{tp(recent.messages, { one: 'message written', other: 'messages written' })}</p>
          </li>
          <li>
            <p className="font-serif text-2xl tabular-nums">{recent.urges}</p>
            <p className="text-xs text-muted">{tp(recent.urges, { one: 'urge noted', other: 'urges noted' })}</p>
          </li>
          <li>
            <p className="font-serif text-2xl tabular-nums">{recent.checkIns}</p>
            <p className="text-xs text-muted">{tp(recent.checkIns, { one: 'check-in', other: 'check-ins' })}</p>
          </li>
        </ul>
      </section>

      <nav className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm" aria-label={t('More')}>
        <Link to="/pause" className="link">
          {t('Take a pause')}
        </Link>
        <Link to="/programs" className="link">
          {t('Guided programs')}
        </Link>
        <Link to="/patterns" className="link">
          {t('See patterns')}
        </Link>
        <Link to="/help" className="link">
          {t('Help')}
        </Link>
      </nav>

      <DateChangeDialog open={dateDialog !== null} mode={dateDialog ?? 'contact'} settings={settings} onClose={() => setDateDialog(null)} />
      <IntentionDialog open={intentionOpen} current={settings.intentionDays} onClose={() => setIntentionOpen(false)} />
    </div>
  )
}
