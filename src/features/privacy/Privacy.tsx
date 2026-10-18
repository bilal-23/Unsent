import { PageHeader } from '../../components/PageHeader'
import { t } from '../../i18n'

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'What Unsent does',
    body: [
      'Everything you write is stored only in this browser on this device. There is no account, no server and no cloud copy.',
      'Unsent has no analytics, no advertising and no tracking. It never sends your entries anywhere, and it cannot send a message to anyone.',
      'After the first visit, the app works fully offline. Only the app itself is cached — never your entries.',
    ],
  },
  {
    title: 'What "local" does not mean',
    body: [
      'Local is not the same as encrypted. Unless you turn on the app lock in Settings, your entries are stored as plain data in the browser.',
      'Anyone who can use this device and browser profile could open Unsent and read your entries. Browser extensions and other code running on this site could also read local data.',
      'With the app lock on, your writing is encrypted with a key protected by your passphrase. Dates, ratings and other details stay unencrypted so the app can sort and count them. If you forget the passphrase, the encrypted entries cannot be recovered.',
    ],
  },
  {
    title: 'Backups',
    body: [
      'A backup is a file you download and keep wherever you choose. A normal backup is readable by anyone who opens it. You can choose to protect a backup with a passphrase when exporting.',
      'Clearing data in Unsent deletes only what is stored in this browser. It does not delete backup files you saved elsewhere.',
    ],
  },
  {
    title: 'Keeping your entries safe',
    body: [
      'Clearing your browser data, using private browsing, or uninstalling the browser can erase everything. Some browsers also remove data from sites you have not visited for a while — adding Unsent to your Home Screen helps prevent this.',
      'Make a backup now and then, especially before changing phones.',
    ],
  },
  {
    title: 'Permissions',
    body: [
      'Unsent asks for the microphone only when you choose to record a voice note, and only while recording. It does not use notifications, location or contacts.',
    ],
  },
]

export function Privacy() {
  return (
    <div>
      <PageHeader title={t('Privacy')} back="/settings" />
      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold">{t(section.title)}</h2>
            <div className="mt-2 space-y-2 text-muted">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{t(paragraph)}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
