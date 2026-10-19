/** Short explanations of each part of the app, shown as dismissible notes and on the Help page. */
export type HelpId =
  | 'home'
  | 'unsent'
  | 'urges'
  | 'checkins'
  | 'goodThings'
  | 'habits'
  | 'plans'
  | 'patterns'
  | 'programs'
  | 'search'
  | 'deleted'
  | 'trackers'
  | 'reminders'
  | 'settings'

export interface HelpTopic {
  id: HelpId
  title: string
  body: string[]
  /** Where the feature lives, for the Help page. */
  path: string
}

export const HELP: Record<HelpId, HelpTopic> = {
  home: {
    id: 'home',
    title: 'Home',
    path: '/',
    body: [
      'Your day at a glance: the days since your last contact, quick buttons to write, log an urge or check in, an idea for today and your habits.',
      'After a couple of weeks, Home gently shifts towards your own life — ideas, plans and good things lead, and the count gets quieter. You can turn this off in Settings.',
    ],
  },
  unsent: {
    id: 'unsent',
    title: 'Unsent messages',
    path: '/unsent',
    body: [
      'Write what you want to say without sending it. Messages save as you type and never leave this device — there is no send button, ever.',
      'Add tags to group messages and filter by them. Seal a letter (lock icon) to keep it closed until a date you choose. The Voice tab lets you say it out loud instead.',
    ],
  },
  urges: {
    id: 'urges',
    title: 'Urges',
    path: '/urges',
    body: [
      'When you feel the pull to reach out, log it here — only the intensity is needed. Afterwards you will see your own reasons and the things that help you, and you can take a short breathing pause.',
      'Check back later and rate the urge again: over time you will see that urges rise and fall.',
    ],
  },
  checkins: {
    id: 'checkins',
    title: 'Daily check-ins',
    path: '/journal',
    body: [
      'A quick note on how your day is going: mood (the only required part), energy, a few words and a small win. One per day — opening today again edits it.',
      'Skipping days is completely fine. Nothing is counted against you.',
    ],
  },
  goodThings: {
    id: 'goodThings',
    title: 'Good things',
    path: '/journal/good-things',
    body: [
      'A record of your life, not of them: wins from check-ins, finished plans, ideas you did, and moments you add yourself — with a photo if you like.',
      'Tap the pencil to edit the words, the day or the photo.',
    ],
  },
  habits: {
    id: 'habits',
    title: 'Habits',
    path: '/journal/habits',
    body: [
      'Make room for things that are yours — the gym, reading, a walk. Give each habit a weekly goal and tick off the days you do it, here or on Home.',
      'There are no streaks: a missed day is just a blank day, and every Monday starts fresh.',
    ],
  },
  plans: {
    id: 'plans',
    title: 'Plans',
    path: '/journal/plans',
    body: [
      'Things you want to try, learn or get back to. Tick them off when done — they move to your Good things. Use the arrows to put them in the order you like.',
    ],
  },
  patterns: {
    id: 'patterns',
    title: 'Patterns',
    path: '/patterns',
    body: [
      'A quiet look at your own entries: urges per week, what tends to set them off, how they changed when you checked back, and your mood by day.',
      'There are no scores or predictions — just your data, for you.',
    ],
  },
  programs: {
    id: 'programs',
    title: 'Guided programs',
    path: '/programs',
    body: [
      '"Rebuilding" is 28 short days: a reading and one small exercise each, at your own pace. Writing is optional; you can mark a day done without answering.',
      'The exercises (thought record, values check, reality check, letting-go letter) are there whenever you need them.',
    ],
  },
  search: {
    id: 'search',
    title: 'Search',
    path: '/search',
    body: [
      'Find anything you have written — messages, urge notes, check-ins, good things, plans, habits, exercises and your lists. Case and accents do not matter.',
      'Sealed letters are never searched, and your search is never saved.',
    ],
  },
  deleted: {
    id: 'deleted',
    title: 'Recently deleted',
    path: '/deleted',
    body: [
      'Deleting something moves it here, with an Undo right after. You can restore it for 30 days; after that it is removed for good.',
      'Recently deleted entries are not included in backups.',
    ],
  },
  trackers: {
    id: 'trackers',
    title: 'Other trackers',
    path: '/trackers',
    body: [
      'Count days since you last did something you are stepping away from — like checking their profile. Starting again is just a new date, never a failure.',
      'For things you want to do more of, use Habits instead.',
    ],
  },
  reminders: {
    id: 'reminders',
    title: 'Reminders',
    path: '/reminders',
    body: [
      'Calendar reminders go into your phone’s calendar, which notifies you even when Unsent is closed. Keep the text neutral — others may see your calendar.',
      'Notifications while open can nudge you when an urge check-back is due, as long as Unsent is still running.',
    ],
  },
  settings: {
    id: 'settings',
    title: 'Settings',
    path: '/settings',
    body: [
      'Change your last-contact date, edit your reasons and coping list, choose how Home looks, turn on the app lock, and make or restore backups.',
      'Your entries live only on this device. Make a backup now and then — it is the only way to move to a new phone.',
    ],
  },
}

export const HELP_ORDER: HelpId[] = ['home', 'unsent', 'urges', 'checkins', 'goodThings', 'habits', 'plans', 'search', 'deleted', 'patterns', 'programs', 'trackers', 'reminders', 'settings']
