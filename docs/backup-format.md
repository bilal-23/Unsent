# Unsent backup format (schemaVersion 1)

A backup is a UTF-8 JSON file named `unsent-backup-YYYY-MM-DD.json` (or `…-protected.json`). The authoritative definition is the Zod schema in [`src/services/backup/schema.ts`](../src/services/backup/schema.ts); this document mirrors it.

## Conventions

| Kind | Format |
| --- | --- |
| `id` | UUID (RFC 9562), stable across devices |
| timestamps (`…At`) | ISO-8601 with offset, written as UTC: `2026-10-18T09:30:00.000Z` |
| local dates | `YYYY-MM-DD`, a calendar date in the user's local time — never converted through UTC |
| binary data | base64 string |
| optional fields | omitted when empty |

Unknown keys are rejected (strict objects). Files larger than 150 MB are refused before reading.

## Envelope

```json
{
  "app": "unsent",
  "schemaVersion": 1,
  "exportedAt": "2026-10-18T09:30:00.000Z",
  "data": {
    "settings": { … } | null,
    "preferences": { … } | null,
    "trackingHistory": [],
    "messages": [],
    "urges": [],
    "checkIns": [],
    "personalItems": [],
    "plans": [],
    "lifeLog": [],
    "trackers": [],
    "exerciseEntries": [],
    "voiceNotes": []
  }
}
```

## Records

### settings (no-contact tracking)
| field | type | notes |
| --- | --- | --- |
| `id` | `"singleton"` | |
| `lastContactDate` | local date | |
| `lastContactTime` | `HH:mm`? | for reference only |
| `note` | string? | |
| `journalName` | string? | ≤ 200 chars |
| `intentionDays` | integer 1–3650? | gentle intention, counted from `lastContactDate` |
| `timezone` | IANA zone | zone in use when the date was last set |
| `createdAt`, `updatedAt` | timestamp | |

### preferences
`id: "singleton"`, `theme` (`system`/`light`/`dark`), `defaultHistorySort` (`updated`/`created`), `reflectionReminderEnabled`, `reflectionReminderMinutes` (1–240), `showDayCount`, `pauseSeconds` (60/90), `privacyCover`, `showPrompts`, `showIdeas`, `fadeMode`, `graduationDismissedAt?`, `lastBackupAt?`, `backupReminderSnoozedUntil?` (local date), `textSize` (`sm`/`md`/`lg`/`xl`), `readingFont` (`serif`/`sans`), `onThisDay`, `autoLockMinutes` (0–1440). Every field except `id` is optional on import; missing ones take current defaults.

### trackingHistory
`id`, `previousDate` (local date or `null` for the first entry), `newDate`, `changedAt`, `reason?`.

### messages (unsent messages)
`id`, `title` (≤ 1000), `body` (≤ 1,000,000 chars; line breaks preserved), `status` (`draft`/`archived`), `tags` (string[]), `createdAt`, `updatedAt`, `sealedUntil?` (local date), `sealedAt?`. The app's internal revision counter is never exported.

### urges
`id`, `intensity` (1–10), `trigger?`, `emotion?`, `note?`, `createdAt`, `updatedAt`, `followUpIntensity?` (1–10), `followUpAt?`.

### checkIns
`id`, `localDate` (unique per file), `mood` (1–5), `energy?` (1–5), `reflection?`, `personalWin?`, `createdAt`, `updatedAt`.

### personalItems
`id`, `kind` (`reason`/`coping`), `text`, `position` (integer ≥ 0), `createdAt`, `updatedAt`.

### plans
`id`, `text`, `status` (`open`/`done`), `doneAt?`, `createdAt`, `updatedAt`.

### lifeLog (good things)
`id`, `kind` (`idea`/`moment`), `ideaId?` (built-in idea id), `text`, `localDate`, `photo?` `{ mimeType: image/jpeg|png|webp, width, height, data: base64 }`, `createdAt`, `updatedAt`.

### trackers
`id`, `name`, `startDate` (local date), `intentionDays?`, `archived`, `createdAt`, `updatedAt`.

### exerciseEntries
`id`, `kind` (`program-day`/`thought-record`/`values`/`reality-check`/`letting-go`), `programId?`, `day?`, `fields` (object of string answers), `createdAt`, `updatedAt`.

### voiceNotes
`id`, `title`, `mimeType` (`audio/…`), `durationMs`, `data` (base64), `createdAt`, `updatedAt`.

## Import rules

1. Parse JSON; reject anything that is not `app: "unsent"`.
2. `schemaVersion` greater than the app supports → rejected ("made by a newer version").
3. Older versions → migrated step by step (`MIGRATIONS[n]` upgrades from n to n+1).
4. Full schema validation; then duplicate ids within any collection, or two check-ins for one date, are rejected.
5. Nothing is written until the user confirms.

**Merge** — for the same `id`, the copy with the newer `updatedAt` wins (ties keep the local copy). Tracking history is append-only. A check-in with the same date but a different id: the newer one wins and the other is removed. Settings: newer wins. Preferences: local wins. Runs in one transaction.

**Replace** — after typed confirmation, every table is cleared and refilled in one transaction; any failure rolls everything back.

## Passphrase-protected backups

```json
{
  "app": "unsent",
  "encrypted": {
    "version": 1,
    "cipher": "xchacha20poly1305",
    "kdf": "PBKDF2-SHA256",
    "iterations": 600000,
    "salt": "<base64, 16 bytes>"
  },
  "data": "<base64: 24-byte nonce ‖ ciphertext ‖ 16-byte tag>"
}
```

The key is `PBKDF2-SHA256(passphrase NFC-normalised, salt, iterations) → 32 bytes`. Decrypting `data` yields the normal backup JSON above. Without the passphrase the file cannot be opened.
