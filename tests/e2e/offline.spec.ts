import { expect, test } from '@playwright/test'
import { nav, onboard, writeMessage } from './helpers'

test.describe('offline', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Playwright drives service workers reliably only in Chromium')

  test('works after the first load with the network switched off', async ({ page, context }) => {
    await onboard(page)
    await writeMessage(page, { title: 'Offline proof', body: 'written online' })
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    // Make sure the page is controlled by the service worker before going offline.
    await page.reload()
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByText('Offline — everything still works')).toBeVisible()
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue('written online')
    await nav(page, 'Home').click()
    await expect(page.getByRole('region', { name: 'No-contact status' })).toBeVisible()

    for (const name of ['Unsent', 'Urges', 'Journal', 'Settings'] as const) {
      await nav(page, name).click()
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
    }

    await nav(page, 'Unsent').click()
    await expect(page.getByRole('link', { name: /Offline proof/ })).toBeVisible()
    await writeMessage(page, { body: 'written offline' })
    await page.reload()
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue('written offline')
    await context.setOffline(false)
  })

  test('caches only app files — never personal data', async ({ page }) => {
    await onboard(page)
    await writeMessage(page, { body: 'not for the cache' })
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    const cached = await page.evaluate(async () => {
      const urls: string[] = []
      for (const name of await caches.keys()) {
        const cache = await caches.open(name)
        for (const request of await cache.keys()) urls.push(new URL(request.url).pathname)
      }
      return urls
    })
    expect(cached.length).toBeGreaterThan(0)
    for (const path of cached) expect(path).toMatch(/^\/(index\.html|assets\/.+\.(js|css)|[\w.-]+\.(png|svg|js|webmanifest|ico))?$/)
  })
})
