/**
 * Lightweight, gettext-style i18n. The English text is the message id, so code
 * stays readable and English needs no catalog. To add a language, create a
 * catalog mapping English ids → translations (see catalogs/README.md), register
 * it in CATALOGS, and set `dir` for right-to-left scripts.
 *
 *   t('Saved')
 *   t('Last contact: {date}', { date })
 *   tp(days, { one: '{count} day', other: '{count} days' })
 */
export type Params = Record<string, string | number>

export interface Catalog {
  locale: string
  dir: 'ltr' | 'rtl'
  messages: Record<string, string>
}

const CATALOGS: Record<string, Catalog> = {}

let active: Catalog | null = null
let activeLocale = 'en'

export function registerCatalog(catalog: Catalog): void {
  CATALOGS[catalog.locale] = catalog
}

/** Picks the best catalog for the given locale list (falls back to English). */
export function setLocale(preferred: readonly string[] = typeof navigator === 'undefined' ? ['en'] : navigator.languages ?? ['en']): void {
  active = null
  activeLocale = 'en'
  for (const tag of preferred) {
    const exact = CATALOGS[tag] ?? CATALOGS[tag.split('-')[0]]
    if (exact) {
      active = exact
      activeLocale = exact.locale
      break
    }
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = activeLocale
    document.documentElement.dir = active?.dir ?? 'ltr'
  }
}

export function currentLocale(): string {
  return activeLocale
}

function interpolate(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match))
}

export function t(id: string, params?: Params): string {
  return interpolate(active?.messages[id] ?? id, params)
}

const pluralRules = new Map<string, Intl.PluralRules>()

/** Plural-aware translation. Each form is itself a message id; `{count}` is filled in. */
export function tp(count: number, forms: { one: string; other: string; zero?: string }, params?: Params): string {
  let rules = pluralRules.get(activeLocale)
  if (!rules) {
    rules = new Intl.PluralRules(activeLocale)
    pluralRules.set(activeLocale, rules)
  }
  const form = count === 0 && forms.zero ? forms.zero : rules.select(count) === 'one' ? forms.one : forms.other
  return t(form, { count, ...params })
}
