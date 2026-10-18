import { expect, test, type Page } from '@playwright/test'
import { onboard, writeMessage } from './helpers'

const banner = (p: Page) => p.getByText('This message was edited in another tab or window.')

test('editing the same message in two tabs never silently overwrites', async ({ page, context }) => {
  await onboard(page)
  await writeMessage(page, { title: 'Shared', body: 'original' })
  const url = page.url()

  const other = await context.newPage()
  await other.goto(url)
  const otherBody = other.getByLabel('Message', { exact: true })
  await expect(otherBody).toHaveValue('original')

  // Both tabs edit the same version. Tab B's timers are frozen so its edit is pending
  // while tab A types (B may still save when it goes to the background — either way
  // one of them must detect the conflict).
  await other.clock.install()
  await otherBody.fill('original plus B')
  await page.getByLabel('Message', { exact: true }).fill('from tab A')
  await other.clock.runFor(2000)

  await expect.poll(async () => (await banner(page).isVisible()) || (await banner(other).isVisible()), { timeout: 10_000 }).toBe(true)
  const loser = (await banner(page).isVisible()) ? page : other
  await loser.getByRole('button', { name: 'Save mine as a copy' }).click()
  await expect(loser.getByPlaceholder('Title (optional)')).toHaveValue('Shared (copy)')

  // Both versions survive as separate messages.
  await page.goto('/#/unsent')
  await expect(page.getByRole('link', { name: /Shared/ })).toHaveCount(2)
  await expect(page.getByRole('link', { name: /from tab A/ })).toHaveCount(1)
  await expect(page.getByRole('link', { name: /original plus B/ })).toHaveCount(1)
})
