import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { onboard, writeMessage } from './helpers'

const ROUTES = ['/#/', '/#/unsent', '/#/urges/new', '/#/journal', '/#/journal/check-in/today', '/#/journal/good-things', '/#/settings', '/#/patterns', '/#/programs', '/#/privacy']

test.describe('accessibility', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Axe results are browser-independent; run once')

  test('welcome screen has no serious accessibility issues', async ({ page }) => {
    await page.goto('/')
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  })

  for (const route of ROUTES) {
    test(`${route} has no serious accessibility issues`, async ({ page }) => {
      await onboard(page)
      await writeMessage(page, { title: 'A', body: 'B' })
      await page.goto(route)
      await page.waitForTimeout(300)
      const results = await new AxeBuilder({ page }).analyze()
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
    })
  }

  test('main navigation and dialogs work from the keyboard', async ({ page }) => {
    await onboard(page)
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Skip to content' })).toBeFocused()
    await page.goto('/#/settings')
    await page.getByRole('button', { name: 'Delete all data on this device' }).focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Delete all data?' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    const links = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true }).getByRole('link')
    await expect(links).toHaveCount(5)
  })
})
