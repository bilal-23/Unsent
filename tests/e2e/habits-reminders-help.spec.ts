import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { nav, onboard } from './helpers'

test.describe('habits', () => {
  test('add a habit with a weekly goal, tick it from Home and the week view', async ({ page }) => {
    await onboard(page)
    await page.goto('/#/journal/habits')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'New habit' })
    await dialog.getByRole('button', { name: 'Go to the gym' }).click()
    await dialog.getByRole('button', { name: '3× a week' }).click()
    await dialog.getByRole('button', { name: 'Add habit' }).click()
    await expect(page.getByText('This week: 0 of 3 — a fresh start')).toBeVisible()

    await nav(page, 'Home').click()
    await page.getByRole('checkbox', { name: 'Go to the gym today' }).click()
    await expect(page.getByText('This week: 1 of 3')).toBeVisible()

    await page.goto('/#/journal/habits')
    const week = page.getByRole('group', { name: 'Go to the gym, this week' })
    await expect(week.getByRole('button', { pressed: true })).toHaveCount(1)
    await page.reload()
    await expect(page.getByText('This week: 1 of 3')).toBeVisible()
    await expect(page.locator('main ul')).not.toContainText(/streak|failed/i)
  })
})

test.describe('reminders', () => {
  test('creates a calendar reminder file', async ({ page }, testInfo) => {
    await onboard(page)
    await page.goto('/#/reminders')
    await page.getByRole('button', { name: 'Evening check-in' }).click()
    await page.getByLabel('Time').fill('20:30')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Add to calendar' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('unsent-reminder.ics')
    const file = testInfo.outputPath('reminder.ics')
    await download.saveAs(file)
    const ics = await readFile(file, 'utf8')
    expect(ics).toContain('RRULE:FREQ=DAILY')
    expect(ics).toMatch(/DTSTART:\d{8}T203000/)
    expect(ics).toContain('SUMMARY:A moment for you')
    expect(ics).toContain('#/journal/check-in/today')
  })
})

test.describe('help', () => {
  test('each screen explains itself; notes can be dismissed and brought back', async ({ page }) => {
    await onboard(page)
    await expect(page.getByRole('complementary', { name: 'About Home' })).toBeVisible()
    await page.getByRole('complementary', { name: 'About Home' }).getByRole('button', { name: 'Got it' }).click()
    await expect(page.getByRole('complementary', { name: 'About Home' })).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('complementary', { name: 'About Home' })).toHaveCount(0)

    await nav(page, 'Journal').click()
    await expect(page.getByRole('complementary', { name: 'About Daily check-ins' })).toBeVisible()
    await page.getByRole('link', { name: 'Habits' }).click()
    await expect(page.getByRole('complementary', { name: 'About Habits' })).toContainText('no streaks')

    await page.goto('/#/help')
    for (const topic of ['Unsent messages', 'Urges', 'Habits', 'Recently deleted', 'Reminders']) {
      await expect(page.getByRole('heading', { name: topic, exact: true })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Show the tips on every screen again' }).click()
    await nav(page, 'Home').click()
    await expect(page.getByRole('complementary', { name: 'About Home' })).toBeVisible()
  })
})
