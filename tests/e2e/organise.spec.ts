import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { choose, nav, onboard, writeMessage } from './helpers'

const PHOTO = fileURLToPath(new URL('../../public/icon-192.png', import.meta.url))

test.describe('finding and tidying entries', () => {
  test('search finds words across every kind of entry, with tag filters on Unsent', async ({ page }) => {
    await onboard(page)
    await writeMessage(page, { title: 'Summer', body: 'the lake at dusk' })
    await page.getByLabel(/Tags/).fill('memories, calm')
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
    await writeMessage(page, { title: 'Winter', body: 'nothing about water' })

    await page.goto('/#/urges/new')
    await choose(page.getByRole('radio', { name: '5', exact: true }))
    await page.getByLabel('Anything else').fill('saw the lake on my way home')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await page.getByRole('button', { name: 'Done' }).click()

    await page.goto('/#/journal/plans')
    await page.getByPlaceholder(/Something to try/).fill('Swim in the lake')
    await page.getByRole('button', { name: 'Add' }).click()

    await page.goto('/#/search')
    await page.getByRole('searchbox', { name: 'Search everything' }).fill('LAKE')
    await expect(page.getByText('3 results')).toBeVisible()
    await page.getByRole('group', { name: 'Filter results' }).getByRole('button', { name: /^Plans/ }).click()
    await expect(page.getByText('1 result')).toBeVisible()
    await page.getByRole('link', { name: /Swim in the/ }).click()
    await expect(page).toHaveURL(/#\/journal\/plans$/)

    await nav(page, 'Unsent').click()
    await page.getByRole('group', { name: 'Filter by tag' }).getByRole('button', { name: /#memories/ }).click()
    await expect(page.getByRole('link', { name: /Summer/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Winter/ })).toHaveCount(0)
  })

  test('good things can be edited and given a photo later', async ({ page }) => {
    await onboard(page)
    await page.goto('/#/journal/good-things')
    await page.getByLabel('Add a good thing').fill('Coffee')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByLabel('Good thing', { exact: true }).fill('Coffee with Sam')
    await page.locator('input[type=file]').last().setInputFiles(PHOTO)
    await expect(page.getByRole('img', { name: 'Selected photo' })).toBeVisible()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Coffee with Sam')).toBeVisible()
    await page.reload()
    const item = page.getByRole('listitem').filter({ hasText: 'Coffee with Sam' })
    await expect(item.locator('img')).toBeVisible()
    await expect.poll(() => item.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)

    // Delete with Undo.
    await item.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByText('Coffee with Sam')).toHaveCount(0)
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByText('Coffee with Sam')).toBeVisible()
  })

  test('plans can be reordered and the order survives a reload', async ({ page }) => {
    await onboard(page)
    await page.goto('/#/journal/plans')
    for (const plan of ['Third', 'Second', 'First']) {
      await page.getByPlaceholder(/Something to try/).fill(plan)
      await page.getByRole('button', { name: 'Add' }).click()
      await expect(page.getByText(plan)).toBeVisible()
    }
    const order = () => page.getByRole('checkbox').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')?.match(/"(.+)"/)?.[1]))
    await expect.poll(order).toEqual(['First', 'Second', 'Third'])
    await page.getByRole('button', { name: 'Move "Third" up' }).click()
    await expect.poll(order).toEqual(['First', 'Third', 'Second'])
    await page.reload()
    await expect.poll(order).toEqual(['First', 'Third', 'Second'])
  })
})
