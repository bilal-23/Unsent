import { formatLocalDate, formatTimestamp } from '../../domain/dates'
import { getIdea } from '../../domain/ideas'
import { EXERCISES, getProgram, getProgramDay } from '../../domain/programs'
import { isSealed } from '../../domain/sealing'
import type { SearchDocument } from '../../domain/search'
import type { DailyCheckIn, ExerciseEntry, Habit, LifeLogEntry, PersonalItem, Plan, UnsentMessage, UrgeEntry, VoiceNote } from '../../domain/types'
import { t } from '../../i18n'

export interface SearchSources {
  messages: UnsentMessage[]
  urges: UrgeEntry[]
  checkIns: DailyCheckIn[]
  lifeLog: LifeLogEntry[]
  plans: Plan[]
  exercises: ExerciseEntry[]
  voiceNotes: VoiceNote[]
  reasons: PersonalItem[]
  coping: PersonalItem[]
  habits?: Habit[]
}

/** Turns the user's entries into search documents. Sealed letters are left out entirely. */
export function buildSearchDocuments(sources: SearchSources, today: string): SearchDocument[] {
  const docs: SearchDocument[] = []

  for (const message of sources.messages) {
    if (isSealed(message, today)) continue
    docs.push({
      key: `message-${message.id}`,
      kind: 'message',
      title: message.title.trim() || t('Untitled'),
      text: message.body,
      keywords: message.tags.map((tag) => `#${tag} ${tag}`).join(' '),
      sortKey: message.updatedAt,
      href: `/unsent/${message.id}`,
    })
  }

  for (const urge of sources.urges) {
    const parts = [urge.trigger && t(urge.trigger), urge.emotion && t(urge.emotion), urge.note].filter(Boolean)
    docs.push({
      key: `urge-${urge.id}`,
      kind: 'urge',
      title: t('Urge {n}/10 · {date}', { n: urge.intensity, date: formatTimestamp(urge.createdAt, { dateStyle: 'medium' }) }),
      text: parts.join('\n'),
      sortKey: urge.createdAt,
      href: `/urges/${urge.id}`,
    })
  }

  for (const checkIn of sources.checkIns) {
    docs.push({
      key: `checkin-${checkIn.id}`,
      kind: 'checkIn',
      title: t('Check-in · {date}', { date: formatLocalDate(checkIn.localDate) }),
      text: [checkIn.reflection, checkIn.personalWin].filter(Boolean).join('\n'),
      sortKey: checkIn.localDate,
      href: `/journal/check-in/${checkIn.localDate}`,
    })
  }

  for (const entry of sources.lifeLog) {
    const text = entry.kind === 'idea' && getIdea(entry.ideaId)?.text === entry.text ? t(entry.text) : entry.text
    docs.push({
      key: `good-${entry.id}`,
      kind: 'goodThing',
      title: t('Good thing · {date}', { date: formatLocalDate(entry.localDate) }),
      text,
      sortKey: entry.localDate,
      href: '/journal/good-things',
    })
  }

  for (const plan of sources.plans) {
    docs.push({
      key: `plan-${plan.id}`,
      kind: 'plan',
      title: plan.status === 'done' ? t('Plan (done)') : t('Plan'),
      text: plan.text,
      sortKey: plan.doneAt ?? plan.createdAt,
      href: '/journal/plans',
    })
  }

  for (const entry of sources.exercises) {
    const program = entry.kind === 'program-day' ? getProgram(entry.programId) : undefined
    const day = program && entry.day ? getProgramDay(program, entry.day) : undefined
    const title =
      entry.kind === 'program-day'
        ? t('{program} · Day {n}', { program: t(program?.title ?? 'Program'), n: entry.day ?? '?' }) + (day ? ` · ${t(day.title)}` : '')
        : t(EXERCISES[entry.kind].title)
    docs.push({
      key: `exercise-${entry.id}`,
      kind: 'exercise',
      title,
      text: Object.values(entry.fields).join('\n'),
      sortKey: entry.updatedAt,
      href: entry.kind === 'program-day' ? `/programs/${entry.programId}/${entry.day}` : `/exercises/${entry.kind}/${entry.id}`,
    })
  }

  for (const note of sources.voiceNotes) {
    if (!note.title.trim()) continue
    docs.push({ key: `voice-${note.id}`, kind: 'voiceNote', title: t('Voice note'), text: note.title, sortKey: note.createdAt, href: '/unsent?tab=voice' })
  }

  for (const habit of sources.habits ?? []) {
    docs.push({ key: `habit-${habit.id}`, kind: 'habit', title: t('Habit'), text: habit.name, sortKey: habit.createdAt, href: '/journal/habits' })
  }

  for (const [items, label] of [
    [sources.reasons, t('Why I chose this')],
    [sources.coping, t('Things that help me')],
  ] as const) {
    for (const item of items) {
      docs.push({ key: `list-${item.id}`, kind: 'list', title: label, text: item.text, sortKey: item.createdAt, href: '/settings#lists' })
    }
  }

  return docs
}
