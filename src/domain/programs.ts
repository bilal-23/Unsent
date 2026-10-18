import type { ExerciseKind } from './types'

/**
 * Guided content for programs and standalone exercises. Plain, non-clinical,
 * focused on the writer's own life. Field ids are stored with answers — never rename them.
 */
export interface ExerciseField {
  id: string
  label: string
  hint?: string
  multiline?: boolean
}

export type StandaloneExerciseKind = Exclude<ExerciseKind, 'program-day'>

export interface ExerciseDefinition {
  kind: StandaloneExerciseKind
  title: string
  summary: string
  intro: string
  fields: ExerciseField[]
}

export const EXERCISES: Record<StandaloneExerciseKind, ExerciseDefinition> = {
  'thought-record': {
    kind: 'thought-record',
    title: 'Thought record',
    summary: 'Untangle a thought that keeps replaying.',
    intro:
      'When a thought loops, writing it down slows it enough to look at. There are no right answers — you are only checking whether the thought is the whole story.',
    fields: [
      { id: 'situation', label: 'What was happening?', hint: 'Where were you, what were you doing?', multiline: true },
      { id: 'thought', label: 'What went through your mind?', multiline: true },
      { id: 'feeling', label: 'What did you feel, and how strongly (0–100)?' },
      { id: 'evidenceFor', label: 'What makes the thought feel true?', multiline: true },
      { id: 'evidenceAgainst', label: 'What does not fit with it?', multiline: true },
      { id: 'balanced', label: 'A more balanced way to see it', multiline: true },
      { id: 'feelingAfter', label: 'How strong is the feeling now (0–100)?' },
    ],
  },
  values: {
    kind: 'values',
    title: 'Values check',
    summary: 'Reconnect with what matters to you, on your own.',
    intro:
      'Relationships can quietly reshape our days around someone else. This is a moment to ask what you value for yourself — and one small way to live it this week.',
    fields: [
      { id: 'values', label: 'Three to five things that matter deeply to you', hint: 'e.g. honesty, creativity, family, adventure, calm', multiline: true },
      { id: 'living', label: 'Where are you already living by them?', multiline: true },
      { id: 'drifted', label: 'Where have you drifted from them?', multiline: true },
      { id: 'step', label: 'One small step you could take this week' },
    ],
  },
  'reality-check': {
    kind: 'reality-check',
    title: 'Reality check',
    summary: 'See the relationship as it was, not only as you miss it.',
    intro:
      'Missing someone tends to edit the memory: the good moments get louder and the hard ones go quiet. This is not about blame — it is about holding the whole picture.',
    fields: [
      { id: 'hard', label: 'What was genuinely hard?', multiline: true },
      { id: 'unseen', label: 'When did you feel unseen, unsettled or unlike yourself?', multiline: true },
      { id: 'compromised', label: 'What did you give up or set aside?', multiline: true },
      { id: 'need', label: 'What do you need in a relationship that was missing?', multiline: true },
      { id: 'learning', label: 'What are you learning about yourself?', multiline: true },
    ],
  },
  'letting-go': {
    kind: 'letting-go',
    title: 'Letting-go letter',
    summary: 'A letter that is not meant to be sent — written to close a chapter.',
    intro:
      'Write everything you would want to say if you knew it was the last time. Then, below it, decide what you are keeping for yourself and what you are ready to set down.',
    fields: [
      { id: 'letter', label: 'The letter', multiline: true },
      { id: 'keep', label: 'What I am keeping for myself', hint: 'A lesson, a strength, a good memory', multiline: true },
      { id: 'release', label: 'What I am ready to set down', multiline: true },
    ],
  },
}

export interface ProgramDayDefinition {
  day: number
  title: string
  reading: string
  /** Optional link to a standalone exercise for this day. */
  exercise?: StandaloneExerciseKind
  fields: ExerciseField[]
}

export interface ProgramWeek {
  title: string
  days: ProgramDayDefinition[]
}

export interface ProgramDefinition {
  id: string
  title: string
  summary: string
  weeks: ProgramWeek[]
}

const field = (id: string, label: string, multiline = true): ExerciseField => ({ id, label, multiline })

export const REBUILDING: ProgramDefinition = {
  id: 'rebuilding-28',
  title: 'Rebuilding',
  summary: 'Four gentle weeks: steadying, understanding, letting go, and building a life that feels like yours. One short reading and one small exercise a day, at your own pace.',
  weeks: [
    {
      title: 'Steadying',
      days: [
        {
          day: 1,
          title: 'Arriving',
          reading:
            'You do not have to feel better today. The only task this week is to steady yourself — to eat, sleep, move a little and get through the hours. Grief and longing come in waves; a wave is not a sign that you are going backwards.',
          fields: [field('now', 'How are you, honestly, right now?'), field('need', 'What is one thing you need today?', false)],
        },
        {
          day: 2,
          title: 'The basics',
          reading:
            'Difficult emotions hit harder on an empty stomach and a short night. Before trying to think your way through anything, check the basics: water, food, sleep, daylight, a few minutes of movement.',
          fields: [field('basics', 'Which basic needs have slipped lately?'), field('one', 'Which one will you look after today?', false)],
        },
        {
          day: 3,
          title: 'Riding an urge',
          reading:
            'An urge to reach out usually peaks and fades within minutes if you do not feed it. Try noticing it like weather: where is it in your body, how strong, what does it want? You can let it pass without obeying it.',
          fields: [field('body', 'Where do you feel urges in your body?'), field('instead', 'What could you do for ten minutes instead of acting on one?')],
        },
        {
          day: 4,
          title: 'Your people',
          reading:
            'Isolation makes everything louder. You do not need to explain the whole story to anyone — a walk, a meal or a short call with someone who cares about you is enough to remind your nervous system that you are not alone.',
          fields: [field('who', 'Who helps you feel steadier?'), field('reach', 'Who could you reach out to this week?', false)],
        },
        {
          day: 5,
          title: 'Reducing reminders',
          reading:
            'Every photo, playlist and profile check reopens the wound a little. You do not have to delete anything forever, but you can put reminders out of sight for now — muted, archived, boxed up.',
          fields: [field('reminders', 'Which reminders catch you most often?'), field('move', 'What could you move out of sight?')],
        },
        {
          day: 6,
          title: 'Kind words',
          reading:
            'Notice how you talk to yourself about this. Would you say those words to a friend in the same situation? Self-criticism feels like it keeps us safe, but it mostly keeps us stuck.',
          fields: [field('critic', 'What does your inner critic say?'), field('friend', 'What would you tell a friend instead?')],
        },
        {
          day: 7,
          title: 'Looking back at week one',
          reading: 'You got through a week. That counts, whatever it looked like. Take a moment to notice what helped, even slightly.',
          fields: [field('helped', 'What helped this week?'), field('carry', 'What will you carry into next week?')],
        },
      ],
    },
    {
      title: 'Understanding',
      days: [
        {
          day: 8,
          title: 'What you miss',
          reading:
            'Missing someone is often missing a feeling: being chosen, being known, having a person to tell things to. Naming what you miss most helps you see which needs are asking to be met — some of them in other ways.',
          fields: [field('miss', 'What do you miss most?'), field('need', 'What need sits underneath it?')],
        },
        {
          day: 9,
          title: 'The whole picture',
          reading:
            'Memory edits. Today, gently make room for the parts that were hard, without turning anyone into a villain.',
          exercise: 'reality-check',
          fields: [field('notice', 'What did you notice while doing the reality check?')],
        },
        {
          day: 10,
          title: 'Loops',
          reading:
            'Some thoughts play on repeat: “If only I had…”, “They must be…”. Rumination feels like problem-solving but rarely solves anything. Writing a loop down is a way of stepping out of it.',
          exercise: 'thought-record',
          fields: [field('loop', 'Which thought has been looping most?')],
        },
        {
          day: 11,
          title: 'Closure',
          reading:
            'We often wait for the other person to give us closure — an explanation, an apology, a final conversation. Closure that depends on someone else may never arrive. The kind you can rely on is the one you build yourself.',
          fields: [field('wanted', 'What would you want closure to give you?'), field('self', 'How could you give some of that to yourself?')],
        },
        {
          day: 12,
          title: 'Your part, fairly',
          reading:
            'Looking at your own patterns is not the same as blaming yourself. It is simply asking what you would like to do differently next time — with kindness, as you would for someone you love.',
          fields: [field('learn', 'What would you like to do differently in future?'), field('proud', 'What are you proud of in how you showed up?')],
        },
        {
          day: 13,
          title: 'Feelings as visitors',
          reading:
            'Anger, sadness, relief, guilt, hope — they can all arrive in a single afternoon, and they can contradict each other. That is normal. Feelings are visitors; you can greet them without handing them the keys.',
          fields: [field('feelings', 'Which feelings have visited this week?'), field('needs', 'What did each of them need?')],
        },
        {
          day: 14,
          title: 'Looking back at week two',
          reading: 'Two weeks in. Understanding does not make the ache disappear, but it often makes it less confusing.',
          fields: [field('clearer', 'What feels clearer than it did?'), field('still', 'What still feels tender?')],
        },
      ],
    },
    {
      title: 'Letting go',
      days: [
        {
          day: 15,
          title: 'What letting go means',
          reading:
            'Letting go does not mean pretending it did not matter, or never thinking of them again. It means loosening your grip so the relationship can become part of your story rather than the centre of your days.',
          fields: [field('grip', 'Where are you still holding on tightly?'), field('loosen', 'What would loosening your grip a little look like?')],
        },
        {
          day: 16,
          title: 'The letter',
          reading: 'Today, write the letter you will not send. Say all of it. Then decide what you keep and what you set down.',
          exercise: 'letting-go',
          fields: [field('after', 'How do you feel after writing it?')],
        },
        {
          day: 17,
          title: 'Grieving the future',
          reading:
            'Part of what hurts is losing a future you had imagined — the trips, the routines, the plans. It is okay to grieve that, too. A future you have not lived yet can still be mourned.',
          fields: [field('future', 'What future are you grieving?'), field('yours', 'Which parts of it could still be yours, in another form?')],
        },
        {
          day: 18,
          title: 'Forgiveness, optionally',
          reading:
            'Forgiveness is optional and never owed. If it comes, it is something you do for your own peace, not a message to them. Sometimes the person most in need of forgiveness is ourselves.',
          fields: [field('forgive', 'Is there anything you are ready to forgive — in them or in yourself?'), field('not', 'Is there anything you are not ready to forgive? That is allowed.')],
        },
        {
          day: 19,
          title: 'Rituals',
          reading:
            'Small rituals help the body understand that a chapter is closing: a walk to a new place, boxing up a few things, changing your phone wallpaper, rearranging a room.',
          fields: [field('ritual', 'What small ritual could mark this chapter closing?', false)],
        },
        {
          day: 20,
          title: 'When it comes back',
          reading:
            'Some days the longing will return at full strength. That does not undo the work. Each time you notice it, name it, and choose not to act on it, you are getting better at living alongside it.',
          fields: [field('plan', 'What will you do the next time a strong wave comes?')],
        },
        {
          day: 21,
          title: 'Looking back at week three',
          reading: 'You have done some of the hardest work this week. Notice how you have been carrying it.',
          fields: [field('lighter', 'What feels even slightly lighter?'), field('gentle', 'Where do you need to be gentle with yourself?')],
        },
      ],
    },
    {
      title: 'Rebuilding',
      days: [
        {
          day: 22,
          title: 'What matters to you',
          reading: 'This week turns towards your own life. Start with what you value — independent of anyone else.',
          exercise: 'values',
          fields: [field('surprise', 'Did anything about your values surprise you?')],
        },
        {
          day: 23,
          title: 'Things you put down',
          reading:
            'Most of us set some things aside in a relationship — a hobby, a friendship, a habit, a dream. Some of them might be worth picking back up.',
          fields: [field('putdown', 'What did you set aside that you miss?'), field('plan', 'Add one of them to your Plans.', false)],
        },
        {
          day: 24,
          title: 'Something new',
          reading:
            'Novelty is good for a healing mind. It does not need to be big: a new recipe, a class, a different route, a book outside your usual taste.',
          fields: [field('new', 'Three new things you would be curious to try'), field('first', 'Which one will you try first?', false)],
        },
        {
          day: 25,
          title: 'Your days',
          reading:
            'Routines that once revolved around someone else can feel hollow. Build a few small anchors that are yours: a morning walk, a weekly call, a Sunday ritual.',
          fields: [field('anchors', 'What anchors would make your week feel like yours?')],
        },
        {
          day: 26,
          title: 'Future you',
          reading: 'Imagine yourself a year from now, settled and well. Not with anyone in particular — just at home in your own life.',
          fields: [field('future', 'What does that version of you do on an ordinary day?'), field('advice', 'What advice would they give you now?')],
        },
        {
          day: 27,
          title: 'What you would want next time',
          reading:
            'Without rushing anything, it can help to know what you would want in a future relationship — how you would like to feel, and what you would no longer accept.',
          fields: [field('want', 'How do you want to feel with a future partner?'), field('boundaries', 'What will you no longer accept?')],
        },
        {
          day: 28,
          title: 'Looking back',
          reading:
            'Four weeks. Whatever today looks like, you have spent a month turning towards yourself. You can repeat any day, any time. Unsent will be here — but hopefully you will need it a little less.',
          fields: [field('changed', 'What has changed since day one?'), field('next', 'What do you want for yourself next?')],
        },
      ],
    },
  ],
}

export const PROGRAMS: ProgramDefinition[] = [REBUILDING]

export function getProgram(id: string | undefined): ProgramDefinition | undefined {
  return PROGRAMS.find((program) => program.id === id)
}

export function programDays(program: ProgramDefinition): ProgramDayDefinition[] {
  return program.weeks.flatMap((week) => week.days)
}

export function getProgramDay(program: ProgramDefinition, day: number): ProgramDayDefinition | undefined {
  return programDays(program).find((d) => d.day === day)
}

export function isStandaloneKind(kind: string | undefined): kind is StandaloneExerciseKind {
  return !!kind && kind in EXERCISES
}

/** Drops empty answers so stored entries contain only what the user wrote. */
export function cleanFields(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim()))
}
