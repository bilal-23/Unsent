import { expect, test } from '@playwright/test'
import { localDate, nav, onboard, writeMessage, choose } from './helpers'

test.describe('Journey A — first-time setup', () => {
  test('explains privacy, records the date and lands on the dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Everything stays on this device')).toBeVisible()
    await expect(page.getByText(/not encrypted unless you turn on the app lock/)).toBeVisible()
    await onboard(page, { daysAgo: 3, intention: '30 days', reasons: ['I want to feel calm again'] })
    const status = page.getByRole('region', { name: 'No-contact status' })
    await expect(status).toContainText('3')
    await expect(status).toContainText('days since last contact')
    await expect(status).toContainText('Day 3 of your 30-day intention')
    await page.reload()
    await expect(status).toContainText('days since last contact')
  })

  test('rejects a future last-contact date', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Get started' }).click()
    await page.getByRole('button', { name: 'Skip' }).click()
    await page.getByLabel('Date', { exact: true }).fill(await localDate(page, 2))
    await expect(page.getByText('cannot be in the future')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })
})

test.describe('Journey B — unsent messages', () => {
  test('autosave survives a reload, with Unicode and line breaks intact', async ({ page }) => {
    await onboard(page)
    const body = 'First line\n\nSecond — “quoted” 🌿💙 大丈夫 עברית'
    await writeMessage(page, { title: 'To you', body })
    await page.reload()
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue(body)
    await expect(page.getByPlaceholder('Title (optional)')).toHaveValue('To you')
  })

  test('archive, restore, search, delete with Undo and restore from Recently deleted', async ({ page }) => {
    await onboard(page)
    await writeMessage(page, { title: 'Summer', body: 'about the lake' })
    await writeMessage(page, { title: 'Winter', body: 'about the snow' })

    await page.getByRole('button', { name: 'Archive' }).click()
    await expect(page).toHaveURL(/#\/unsent$/)
    await expect(page.getByRole('link', { name: /Winter/ })).toHaveCount(0)
    await page.getByRole('tab', { name: /Archive/ }).click()
    await page.getByRole('link', { name: /Winter/ }).click()
    await page.getByRole('button', { name: 'Restore from archive' }).click()
    await nav(page, 'Unsent').click()
    await expect(page.getByRole('link', { name: /Winter/ })).toBeVisible()

    await page.getByRole('searchbox').fill('lake')
    await expect(page.getByRole('link', { name: /Summer/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Winter/ })).toHaveCount(0)

    await page.getByRole('link', { name: /Summer/ }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page).toHaveURL(/#\/unsent$/)
    await expect(page.getByRole('link', { name: /Summer/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Undo' }).click()
    await page.getByRole('searchbox').fill('')
    await expect(page.getByRole('link', { name: /Summer/ })).toBeVisible()

    // Delete again, then restore from Recently deleted.
    await page.getByRole('link', { name: /Summer/ }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('link', { name: 'Recently deleted' }).click()
    await expect(page.getByText('30 days left')).toBeVisible()
    await page.getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByText('Nothing here.', { exact: false })).toBeVisible()
    await nav(page, 'Unsent').click()
    await expect(page.getByRole('link', { name: /Summer/ })).toBeVisible()
  })

  test('there is no way to send a message', async ({ page }) => {
    await onboard(page)
    await writeMessage(page, { body: 'never sent' })
    await expect(page.getByRole('button', { name: /send|share/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /send|whatsapp|instagram|sms|email/i })).toHaveCount(0)
    await expect(page.locator('a[href^="mailto:"], a[href^="sms:"], a[href*="wa.me"]')).toHaveCount(0)
  })
})

test.describe('Journey C — urges', () => {
  test('logs an urge with only an intensity and attaches a follow-up to it', async ({ page }) => {
    await onboard(page, { reasons: ['Peace'] })
    await page.goto('/#/urges/new')
    await choose(page.getByRole('radio', { name: '7', exact: true }))
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Noted.')).toBeVisible()
    await expect(page.getByText('· Peace')).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()

    await page.getByRole('link', { name: /Urge noted/ }).click()
    await choose(page.getByRole('group', { name: 'How strong is it now?' }).getByRole('radio', { name: '3', exact: true }))
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Later: 3/10')).toBeVisible()
  })
})

test.describe('Daily check-ins', () => {
  test('editing today never creates a duplicate', async ({ page }) => {
    await onboard(page)
    await page.goto('/#/journal/check-in/today')
    await choose(page.getByRole('radio', { name: '2 – Low' }).first())
    await page.getByRole('button', { name: 'Save check-in' }).click()
    await expect(page).toHaveURL(/#\/journal$/)
    await page.getByRole('link', { name: "Edit today's check-in" }).click()
    await choose(page.getByRole('radio', { name: '4 – Good' }).first())
    await page.getByLabel(/A win, however small/).fill('Went for a walk')
    await page.getByRole('button', { name: 'Save check-in' }).click()
    await expect(page.getByRole('main').getByText('Mood: Good')).toHaveCount(1)
    await page.getByRole('link', { name: 'Good things' }).click()
    await expect(page.getByText('Went for a walk')).toBeVisible()
  })
})

test.describe('No-contact tracking', () => {
  test('recording new contact keeps all entries', async ({ page }) => {
    await onboard(page, { daysAgo: 10 })
    await writeMessage(page, { body: 'still here' })
    await nav(page, 'Home').click()
    await page.getByRole('button', { name: 'I had contact' }).first().click()
    await page.getByRole('button', { name: 'Save date' }).click()
    await expect(page.getByText('Last contact: today').first()).toBeVisible()
    await nav(page, 'Unsent').click()
    await expect(page.getByRole('link', { name: /still here/ })).toBeVisible()
  })
})
