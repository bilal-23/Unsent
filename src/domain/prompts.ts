/**
 * Static writing prompts. They focus on the writer's own feelings and needs and
 * never ask the writer to guess what the other person thinks or feels.
 */
export type PromptContext = 'message' | 'checkIn' | 'urge'

export const PROMPTS: Record<PromptContext, readonly string[]> = {
  message: [
    'What do you most want to say right now, without editing yourself?',
    'What are you hoping would happen if you sent this?',
    'What do you need that you are not getting at the moment?',
    'Write the part you have never said out loud.',
    'What would you like to forgive — in them, or in yourself?',
    'What do you miss, and what do you not miss?',
    'If this message had to be one sentence, what would it be?',
    'What do you want to remember about why you stepped back?',
    'Write to the version of yourself from a month ago.',
    'What feels unfinished, and is there a way to finish it for yourself?',
  ],
  checkIn: [
    'What took up most of your attention today?',
    'What is one small thing that went okay?',
    'Where did you notice your body holding tension?',
    'What did you do today just for yourself?',
    'Who or what helped you feel supported recently?',
    'What would make tomorrow a little easier?',
    'What are you looking forward to, even slightly?',
  ],
  urge: [
    'What happened just before the urge started?',
    'What are you hoping to feel if you reach out?',
    'Is there something else that could meet that need right now?',
    'How strong was this an hour ago, and how strong is it now?',
  ],
}

/** Picks a prompt index different from `previous` when possible. */
export function nextPromptIndex(context: PromptContext, previous: number | null, random = Math.random): number {
  const count = PROMPTS[context].length
  if (count <= 1) return 0
  let index = Math.floor(random() * count)
  if (index === previous) index = (index + 1) % count
  return index
}
