import { expect, type Locator, type Page } from '@playwright/test'

/** A local calendar date computed in the browser (same timezone as the app). */
export async function localDate(page: Page, offsetDays = 0): Promise<string> {
  return page.evaluate((offset) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, offsetDays)
}

/** Completes first-run setup through the real onboarding screens. */
export async function onboard(page: Page, { daysAgo = 3, intention, reasons = [] }: { daysAgo?: number; intention?: string; reasons?: string[] } = {}) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.getByLabel('Date', { exact: true }).fill(await localDate(page, -daysAgo))
  if (intention) await page.getByRole('button', { name: intention, exact: true }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  for (const [i, reason] of reasons.entries()) {
    if (i >= 2) await page.getByRole('button', { name: 'Add another reason' }).click()
    await page.getByLabel(`Reason ${i + 1}`).fill(reason)
  }
  await page.getByRole('button', { name: reasons.length ? 'Finish' : 'Skip and finish' }).click()
  await expect(page.getByRole('region', { name: 'No-contact status' })).toBeVisible()
}

export async function writeMessage(page: Page, { title, body }: { title?: string; body: string }) {
  await page.goto('/#/unsent/new')
  if (title) await page.getByPlaceholder('Title (optional)').fill(title)
  await page.getByLabel('Message', { exact: true }).fill(body)
  await expect(page).toHaveURL(/#\/unsent\/[0-9a-f-]{36}/)
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
}

export function nav(page: Page, name: 'Home' | 'Unsent' | 'Urges' | 'Journal' | 'Settings') {
  return page.getByRole('navigation', { name: 'Main' }).filter({ visible: true }).getByRole('link', { name })
}

/**
 * Radios and switches are visually hidden inputs inside a styled label; click the
 * visible label like a person would (forcing a click on a 1px input is unreliable in WebKit/Firefox).
 */
export async function choose(input: Locator) {
  await input.locator('xpath=ancestor::label[1]').click()
  await expect(input).toBeChecked()
}
