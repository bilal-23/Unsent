# Adding a language

1. Create `src/i18n/catalogs/<locale>.ts`:

   ```ts
   import type { Catalog } from '..'
   export const ur: Catalog = {
     locale: 'ur',
     dir: 'rtl',
     messages: {
       'Saved': '…',
       'Last contact: {date}': '…{date}…',
     },
   }
   ```

2. Register it in `src/main.tsx` with `registerCatalog(ur)` before `setLocale()`.

Message ids are the exact English strings passed to `t()` / `tp()`. Keep `{placeholders}` intact.
Layout uses logical CSS properties (`ms-*`, `pe-*`, `text-start`, …), so right-to-left
languages work without extra styling. Please have emotional copy reviewed by a fluent speaker.
