import { expect, test } from '@playwright/test'
import { onboard } from './helpers'

test.describe('voice notes', () => {
  test.skip(({ browserName }) => browserName === 'webkit', 'WebKit in Playwright has no fake microphone')

  test('record, then play back the whole note — even after renaming it', async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['microphone'])
    await onboard(page)
    await page.goto('/#/unsent?tab=voice')
    await page.getByRole('button', { name: 'Record' }).click()
    await expect(page.getByRole('button', { name: 'Stop and save' })).toBeVisible()
    await page.waitForTimeout(2500)
    await page.getByRole('button', { name: 'Stop and save' }).click()
    await expect(page.getByText('Voice note saved.')).toBeVisible()
    await expect(page.getByText(/\/ 0:0[23]/)).toBeVisible()

    // Renaming refreshes the list; playback must survive it.
    await page.getByLabel('Voice note title').fill('Things I would say')
    await page.getByLabel('Voice note title').blur()

    await page.locator('audio').evaluate((audio: HTMLAudioElement) => (audio.muted = true))
    await page.getByRole('button', { name: 'Play' }).click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    await expect.poll(() => page.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime), { timeout: 5000 }).toBeGreaterThan(1)
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible({ timeout: 5000 })

    await page.reload()
    await expect(page.getByLabel('Voice note title')).toHaveValue('Things I would say')
  })
})
