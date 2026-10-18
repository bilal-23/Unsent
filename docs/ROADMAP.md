# Unsent — roadmap ideas

Status: everything under v1.1 and v2 below shipped in 1.0.0 (built together with v1). The app stays a PWA — no native wrapper or widgets.
These ideas keep the core promise: no account, no server, data stays on the device.

## v1.1 — small, high value
- **Share backup** via the Web Share API (`navigator.share({ files })`) so a backup can go straight to AirDrop / Files / Drive.
- **Text size and reading font** options; translations (i18n, including RTL languages).
- **Photos in the Good things log**, stored as IndexedDB blobs (larger backups; consider a separate media export).
- **"On this day" look-backs**, strictly opt-in so old entries never resurface uninvited.

## v2 — bigger
- **Real lock + encryption at rest**: passphrase → PBKDF2/Argon2 → AES-GCM via Web Crypto, encrypted backups, documented "lost passphrase = lost data" recovery model.
- **Guided programs**: short offline paths (e.g. 4 weeks of rebuilding) with daily readings and exercises — letting-go letter, values check, "what didn't work" reality check, thought record for rumination.
- **Additional trackers** beside no contact (e.g. "not checking their profile", less doomscrolling), same no-failure framing.
- **Voice notes** (MediaRecorder → IndexedDB; requires microphone permission; large backups).

## Deliberately out of scope
Native wrappers (Capacitor) and home-screen widgets — Unsent stays a PWA.
Cloud sync or accounts, social/community features, AI analysis of entries, anything that monitors the other person, streaks/leaderboards/penalties.

## Ideas for later
- More programs (e.g. a 2-week "first days" program) and more exercises.
- Translations reviewed by native speakers (the i18n layer is ready).
- WebAuthn PRF-based unlock as an alternative to a passphrase, where browsers support it.
- Optional reminders via the Notification Triggers / Periodic Background Sync APIs if browsers ever ship them broadly.
