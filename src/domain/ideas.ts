/**
 * Small, optional suggestions for filling a day with things that are yours.
 * Ids are stable (they are stored in the good-things log) — never reuse or renumber them.
 */
export type IdeaCategory = 'connection' | 'movement' | 'outdoors' | 'creativity' | 'learning' | 'rest' | 'home' | 'kindness'

export interface Idea {
  id: string
  category: IdeaCategory
  text: string
}

export const IDEA_CATEGORY_LABELS: Record<IdeaCategory, string> = {
  connection: 'Connection',
  movement: 'Movement',
  outdoors: 'Outdoors',
  creativity: 'Creativity',
  learning: 'Learning',
  rest: 'Rest',
  home: 'Home',
  kindness: 'Kindness',
}

export const IDEAS: readonly Idea[] = [
  { id: 'connection-01', category: 'connection', text: 'Message a friend you have drifted from, just to say hi.' },
  { id: 'connection-02', category: 'connection', text: 'Call a family member instead of texting.' },
  { id: 'connection-03', category: 'connection', text: 'Make a plan with someone for this weekend.' },
  { id: 'connection-04', category: 'connection', text: 'Have a meal with someone and leave your phone in your bag.' },
  { id: 'connection-05', category: 'connection', text: 'Join a group, class or meetup for something you enjoy.' },
  { id: 'connection-06', category: 'connection', text: 'Send someone a photo that reminded you of them.' },
  { id: 'connection-07', category: 'connection', text: 'Ask a friend how they are really doing — and listen.' },
  { id: 'connection-08', category: 'connection', text: 'Say yes to an invitation you would normally skip.' },

  { id: 'movement-01', category: 'movement', text: 'Go for a 20-minute walk with no particular destination.' },
  { id: 'movement-02', category: 'movement', text: 'Stretch for ten minutes before bed.' },
  { id: 'movement-03', category: 'movement', text: 'Put on a song you love and move to it.' },
  { id: 'movement-04', category: 'movement', text: 'Try a beginner workout or yoga video.' },
  { id: 'movement-05', category: 'movement', text: 'Take the stairs everywhere today.' },
  { id: 'movement-06', category: 'movement', text: 'Go for a swim, a bike ride or a run — whatever feels good.' },
  { id: 'movement-07', category: 'movement', text: 'Book a class you have been curious about.' },

  { id: 'outdoors-01', category: 'outdoors', text: 'Spend fifteen minutes in the sun or fresh air.' },
  { id: 'outdoors-02', category: 'outdoors', text: 'Visit a park, garden or beach you have not been to in a while.' },
  { id: 'outdoors-03', category: 'outdoors', text: 'Watch the sunrise or the sunset.' },
  { id: 'outdoors-04', category: 'outdoors', text: 'Take a different route home and notice something new.' },
  { id: 'outdoors-05', category: 'outdoors', text: 'Eat a meal outside.' },
  { id: 'outdoors-06', category: 'outdoors', text: 'Plan a day trip somewhere nearby.' },
  { id: 'outdoors-07', category: 'outdoors', text: 'Find a quiet spot and look at the sky for five minutes.' },

  { id: 'creativity-01', category: 'creativity', text: 'Cook something you have never made before.' },
  { id: 'creativity-02', category: 'creativity', text: 'Take five photos of things you find beautiful today.' },
  { id: 'creativity-03', category: 'creativity', text: 'Draw, doodle or paint for fifteen minutes — no rules.' },
  { id: 'creativity-04', category: 'creativity', text: 'Make a playlist for the person you are becoming.' },
  { id: 'creativity-05', category: 'creativity', text: 'Write a page about a place you would love to visit.' },
  { id: 'creativity-06', category: 'creativity', text: 'Pick up an old hobby for half an hour.' },
  { id: 'creativity-07', category: 'creativity', text: 'Rearrange one corner of your room.' },
  { id: 'creativity-08', category: 'creativity', text: 'Bake something and share it.' },

  { id: 'learning-01', category: 'learning', text: 'Read twenty pages of a book.' },
  { id: 'learning-02', category: 'learning', text: 'Watch a documentary about something you know nothing about.' },
  { id: 'learning-03', category: 'learning', text: 'Do one lesson in a language you would like to learn.' },
  { id: 'learning-04', category: 'learning', text: 'Learn how to make one new dish.' },
  { id: 'learning-05', category: 'learning', text: 'Listen to a podcast episode on a new topic.' },
  { id: 'learning-06', category: 'learning', text: 'Look up a course or workshop starting this month.' },
  { id: 'learning-07', category: 'learning', text: 'Visit a museum, gallery or library.' },
  { id: 'learning-08', category: 'learning', text: 'Spend half an hour on a skill that would help your work.' },

  { id: 'rest-01', category: 'rest', text: 'Go to bed half an hour earlier tonight.' },
  { id: 'rest-02', category: 'rest', text: 'Take a long shower or bath with no phone nearby.' },
  { id: 'rest-03', category: 'rest', text: 'Have one hour of the evening completely screen-free.' },
  { id: 'rest-04', category: 'rest', text: 'Make a warm drink and sit with it, doing nothing else.' },
  { id: 'rest-05', category: 'rest', text: 'Try a ten-minute guided breathing or body scan.' },
  { id: 'rest-06', category: 'rest', text: 'Mute or archive one account that keeps pulling you back.' },
  { id: 'rest-07', category: 'rest', text: 'Take a nap without feeling guilty about it.' },

  { id: 'home-01', category: 'home', text: 'Tidy one drawer or shelf.' },
  { id: 'home-02', category: 'home', text: 'Put fresh sheets on the bed.' },
  { id: 'home-03', category: 'home', text: 'Buy or pick some flowers for your space.' },
  { id: 'home-04', category: 'home', text: 'Cook a proper meal for yourself, and plate it nicely.' },
  { id: 'home-05', category: 'home', text: 'Box up things that keep reminding you of the past.' },
  { id: 'home-06', category: 'home', text: 'Fix something small you have been putting off.' },
  { id: 'home-07', category: 'home', text: 'Open the windows and air out your space.' },

  { id: 'kindness-01', category: 'kindness', text: 'Do something kind for a stranger.' },
  { id: 'kindness-02', category: 'kindness', text: 'Write down three things you like about yourself.' },
  { id: 'kindness-03', category: 'kindness', text: 'Thank someone who helped you recently.' },
  { id: 'kindness-04', category: 'kindness', text: 'Treat yourself to something small you enjoy.' },
  { id: 'kindness-05', category: 'kindness', text: 'Volunteer an hour, or look up somewhere you could.' },
  { id: 'kindness-06', category: 'kindness', text: 'Forgive yourself for one thing you keep replaying.' },
  { id: 'kindness-07', category: 'kindness', text: 'Leave a genuine compliment for someone.' },
]

const IDEAS_BY_ID = new Map(IDEAS.map((idea) => [idea.id, idea]))

export function getIdea(id: string | undefined): Idea | undefined {
  return id ? IDEAS_BY_ID.get(id) : undefined
}

/** Small stable string hash (FNV-1a). */
function hash(value: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * The idea for a given day. Deterministic for (date, offset) so it doesn't change
 * on reload; `offset` advances when the user swaps. Recently done ideas are skipped.
 */
export function ideaForDay(date: string, offset: number, recentlyDone: ReadonlySet<string> = new Set()): Idea {
  const candidates = IDEAS.filter((idea) => !recentlyDone.has(idea.id))
  const pool = candidates.length ? candidates : IDEAS
  return pool[(hash(date) + offset) % pool.length]
}
