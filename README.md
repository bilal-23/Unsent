# Unsent — a private no-contact journal

An offline-first Progressive Web App for people maintaining no contact. Write messages you will not send, notice urges without acting on them, check in with yourself, and slowly turn your attention back to your own life.

**No account. No server. No tracking.** Everything is stored in the browser on the device, and the app can never send a message to anyone.

## Features

| Area | What it does |
| --- | --- |
| Home | Calendar-day count since last contact, optional gentle intention ("Day 12 of 30", no failure state), "I had contact" that keeps every entry, today's idea, recent activity. With *fade mode*, Home gradually leads with your life instead of the counter. |
| Unsent | Drafts with autosave (500 ms debounce, `Saving… / Saved / Unable to save`), search, tag filters, archive, sealed letters that stay closed until a date, voice notes (recorded as MP4/AAC where supported so they play on any device). No send or share affordance exists. |
| Urges | Log in seconds (intensity only is required), optional trigger/emotion/note, your own reasons and coping list afterwards, a 60/90-second breathing pause, optional in-app check-back, follow-up ratings. |
| Journal | One check-in per day, a Good things log (wins, finished plans, done ideas, moments with photos — all editable), Habits with a weekly goal (gym 3× a week, read daily — tick days off, no streaks), and Plans you can reorder. |
| Programs | A 28-day "Rebuilding" program and standalone exercises (thought record, values check, reality check, letting-go letter). |
| Patterns | Quiet charts of your own entries. No scores, no predictions. |
| Reminders | Calendar reminders: Unsent builds a repeating `.ics` event your phone's calendar notifies you about, even when the app is closed — no server. Optional system notifications for the urge check-back while the app is running. |
| Help | Every screen has a short, dismissible "what is this for" note (bring it back with the (i) button), plus a Help page covering every feature. |
| Search | One search across messages, urge notes, check-ins, good things, plans, exercises, voice-note titles and your lists. Accent- and case-insensitive, highlighted matches, never searches sealed letters; the query is never put in the URL or stored. Press `/` on a keyboard. |
| Recently deleted | Deleting moves an entry here with an **Undo** button instead of an "Are you sure?" dialog. Entries can be restored for 30 days, then are removed for good (deleting from here asks for confirmation). Encrypted like everything else when the app lock is on; not included in backups. |
| Settings | Last-contact date, lists, trackers for other habits, display options, app lock (encryption at rest), backup/restore, storage status, delete all data. |

## Run it

```bash
npm install
npm run dev
```

## Build and deploy

```bash
npm run build
```

`dist/` is a static site: upload it to any static host (Netlify, Cloudflare Pages, GitHub Pages, S3, …). Routing is hash-based, so no rewrite rules are needed. `public/_headers` adds security headers on hosts that support it; the same Content Security Policy is also injected as a `<meta>` tag at build time.

The app must be served over HTTPS (or `localhost`) for the service worker, `crypto.randomUUID` and Web Crypto to work.

## Test

```bash
npm run lint
npm run typecheck
npm test
npx playwright install chromium webkit firefox
npm run test:e2e
```

- **Unit/component (Vitest, jsdom, fake-indexeddb)** run in `America/New_York` so daylight-saving transitions are exercised. They cover date math, schema migrations, repositories, export/import round trips, merge rules, encryption at rest, autosave and the main screens.
- **End-to-end (Playwright)** run against the production build in Chromium (Pixel 7), WebKit (iPhone 14) and Firefox: onboarding, autosave across reloads, archive/restore/delete, urges and follow-ups, check-ins, backup export → restore on a fresh device → merge without duplicates, malformed/future backups, passphrase-protected backups, multi-tab conflicts, offline use, network/CSP privacy checks, sealed letters, app lock, and axe accessibility scans.

## Architecture

```
UI (src/features, src/components)
  → hooks (live queries via dexie-react-hooks)
    → repositories (src/repositories)  ← the only code that touches IndexedDB
      → Dexie + encryption middleware (src/db)
        → IndexedDB
```

- `src/domain` — pure logic: types, local-date math, patterns, merge rules, ideas/prompts/program content.
- `src/services/backup` — Zod-validated, versioned JSON backup format with migrations and optional passphrase encryption.
- An ESLint rule prevents UI code from importing Dexie directly.

### Dates

Local calendar dates are stored as `YYYY-MM-DD` and counted with pure calendar arithmetic, so time zones and daylight saving never shift a day. Timestamps are ISO-8601 UTC. "Today" re-evaluates at local midnight, on focus, and every minute (for sleep and time-zone changes).

### Multi-tab safety

Each message has an internal revision number. A save only succeeds if nobody else changed the message since it was loaded; otherwise the editor stops and offers *Save mine as a copy* or *Load the other version*. Nothing is silently overwritten.

## Privacy model

See the in-app **Privacy** page. In short:

- Local is not the same as encrypted. Without the app lock, entries are plain data in the browser.
- With the **app lock**, writing, photos and recordings are encrypted with XChaCha20-Poly1305 using a random data key wrapped by a PBKDF2-SHA256 (600,000 iterations) passphrase key. Dates, ratings and ids stay unencrypted so the app can sort and count. A forgotten passphrase cannot be recovered.
- Backups are files you keep. A normal backup is readable; a protected backup is encrypted as a whole with a passphrase.
- No analytics, no third-party scripts, no remote fonts, no network requests with personal data. The service worker caches only app files.
- Clearing browser data (or Safari's storage eviction for sites not added to the Home Screen) can erase entries. The app reminds you to back up and suggests installing it.

## Translations

UI strings go through `t()` / `tp()` with the English text as the message id (`src/i18n`). See `src/i18n/catalogs/README.md` to add a language; layout uses logical CSS properties so right-to-left languages work.

## Docs

- [Backup format](docs/backup-format.md)
- [Roadmap](docs/ROADMAP.md)
