import { expect, test } from '@playwright/test'
import { localDate, nav, onboard, writeMessage, choose } from './helpers'

test.describe('life-focused features', () => {
  test('after an urge: reasons, coping list, a pause and a follow-up on that urge', async ({ page }) => {
    await onboard(page, { reasons: ['I deserve calm'] })
    await page.goto('/#/settings')
    await page.getByPlaceholder(/Go for a walk/).fill('Call my sister')
    await page.getByRole('button', { name: 'Add' }).nth(1).click()

    await page.goto('/#/urges/new')
    await choose(page.getByRole('radio', { name: '9', exact: true }))
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('· I deserve calm')).toBeVisible()
    await expect(page.getByText('· Call my sister')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Find a helpline near you' })).toHaveAttribute('rel', /noopener/)

    await page.getByRole('link', { name: /second pause/ }).click()
    await expect(page.getByText(/Breathe (in|out)…/)).toBeVisible()
    await page.getByRole('button', { name: 'Finish early' }).click()
    await choose(page.getByRole('radio', { name: '4', exact: true }))
    await page.getByRole('button', { name: 'Save and finish' }).click()
    await expect(page.getByText('Later: 4/10')).toBeVisible()
  })

  test('an idea for today can be done and appears in good things', async ({ page }) => {
    await onboard(page)
    const idea = page.getByRole('region', { name: 'An idea for today' })
    const text = await idea.locator('p.font-serif').innerText()
    await idea.getByRole('button', { name: 'Did it' }).click()
    await expect(page.getByText('Added to your good things.')).toBeVisible()
    await page.goto('/#/journal/good-things')
    await expect(page.getByText(text)).toBeVisible()
  })

  test('plans can be added and ticked off', async ({ page }) => {
    await onboard(page)
    await page.goto('/#/journal/plans')
    await page.getByPlaceholder(/Something to try/).fill('Book a pottery class')
    await page.getByRole('button', { name: 'Add' }).click()
    await page.getByRole('checkbox', { name: /Book a pottery class/ }).click()
    await expect(page.getByText(/^Done /)).toBeVisible()
    await page.getByRole('link', { name: 'Good things' }).click()
    await expect(page.getByText('Book a pottery class')).toBeVisible()
  })

  test('a sealed letter hides its words until its day, then opens', async ({ page }) => {
    await onboard(page)
    await writeMessage(page, { title: 'For later', body: 'words for the future' })
    await page.getByRole('button', { name: 'Seal until a date' }).click()
    await page.getByRole('button', { name: '7 days' }).click()
    await page.getByRole('button', { name: 'Seal', exact: true }).click()
    await expect(page).toHaveURL(/#\/unsent$/)
    await expect(page.getByRole('link', { name: /Sealed until/ })).toBeVisible()
    await expect(page.getByText('For later')).toHaveCount(0)
    await page.getByRole('searchbox').fill('future')
    await expect(page.getByText('No messages match your search.')).toBeVisible()

    // Eight days later.
    const later = new Date(`${await localDate(page, 8)}T09:00:00`)
    await page.clock.setFixedTime(later)
    await page.goto('/#/')
    await page.reload()
    await expect(page.getByText('A letter you sealed is ready to read.')).toBeVisible()
    await page.getByRole('link', { name: 'Open it' }).click()
    await expect(page.getByLabel('Message', { exact: true })).toHaveValue('words for the future')
    await expect(page.getByText(/Today it opens/)).toBeVisible()
  })

  test('the day count can be hidden', async ({ page }) => {
    await onboard(page)
    await page.getByRole('button', { name: 'Hide count' }).click()
    await expect(page.getByText('Day count hidden.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'No-contact status' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Show', exact: true }).click()
    await expect(page.getByRole('region', { name: 'No-contact status' })).toBeVisible()
  })

  test('home leads with the user’s life after a few weeks', async ({ page }) => {
    await onboard(page, { daysAgo: 20 })
    await expect(page.getByRole('heading', { level: 1, name: /Good (morning|afternoon|evening|night)/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'This week, for you' })).toBeVisible()
  })

  test('the app covers itself when hidden', async ({ page }) => {
    await onboard(page)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect(page.locator('html')).toHaveClass(/privacy-cover/)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect(page.locator('html')).not.toHaveClass(/privacy-cover/)
  })

  test('patterns start quiet, then reflect the user’s own data', async ({ page }) => {
    await onboard(page)
    await page.goto('/#/patterns')
    await expect(page.getByRole('heading', { name: 'Last-contact date changes' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Urges per week' })).toHaveCount(0)
    await page.goto('/#/urges/new')
    await choose(page.getByRole('radio', { name: '6', exact: true }))
    await page.getByRole('button', { name: 'Loneliness' }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.goto('/#/patterns')
    await expect(page.getByRole('img', { name: 'Urges per week' })).toBeVisible()
    await expect(page.getByText('Loneliness')).toBeVisible()
    await expect(page.locator('main')).not.toContainText(/moved on|will (come|get) back|compatib|success rate/i)
  })

  test('a guided program day can be completed at your own pace', async ({ page }) => {
    await onboard(page)
    await page.goto('/#/programs')
    await page.getByRole('link', { name: 'Begin day 1' }).click()
    await expect(page.getByRole('heading', { name: 'Arriving' })).toBeVisible()
    await page.getByRole('button', { name: 'Mark day as done' }).click()
    await expect(page.getByRole('heading', { name: 'The basics' })).toBeVisible()
    await page.goto('/#/programs')
    await expect(page.getByText('1 of 28 days done')).toBeVisible()
  })

  test('other trackers use the same no-failure framing', async ({ page }) => {
    await onboard(page)
    await page.goto('/#/trackers')
    await page.getByRole('button', { name: 'Add' }).click()
    await page.getByRole('button', { name: 'Not checking their profile' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Starting today')).toBeVisible()
    await nav(page, 'Home').click()
    await expect(page.getByText('Not checking their profile')).toBeVisible()
  })

  test('the manifest offers home-screen shortcuts', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json()
    expect(manifest.shortcuts.map((s: { url: string }) => s.url)).toEqual(['./#/urges/new', './#/unsent/new'])
    expect(manifest.display).toBe('standalone')
  })
})

test.describe('app lock', () => {
  test('locks, rejects a wrong passphrase and unlocks', async ({ page }) => {
    await onboard(page)
    await writeMessage(page, { title: 'Locked away', body: 'encrypted words' })
    await page.goto('/#/settings')
    await page.getByRole('button', { name: 'Turn on app lock' }).click()
    const dialog = page.getByRole('dialog', { name: 'Turn on app lock' })
    await dialog.getByLabel('New passphrase').fill('correct horse battery')
    await dialog.getByLabel('Repeat passphrase').fill('correct horse battery')
    await dialog.getByRole('checkbox').check()
    await dialog.getByRole('button', { name: 'Turn on' }).click()
    await expect(page.getByText('App lock is on. Your writing is encrypted on this device.')).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Passphrase')).toBeVisible()
    await page.getByLabel('Passphrase').fill('nope nope nope')
    await page.getByRole('button', { name: 'Unlock' }).click()
    await expect(page.getByText('That passphrase did not work. Try again.')).toBeVisible()
    await page.getByLabel('Passphrase').fill('correct horse battery')
    await page.getByRole('button', { name: 'Unlock' }).click()
    await nav(page, 'Unsent').click()
    await expect(page.getByRole('link', { name: /Locked away/ })).toBeVisible()

    const raw = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const open = indexedDB.open('unsent')
          open.onsuccess = () => {
            const get = open.result.transaction('messages').objectStore('messages').getAll()
            get.onsuccess = () => resolve(JSON.stringify(get.result))
          }
        }),
    )
    expect(raw).not.toContain('encrypted words')
  })
})
