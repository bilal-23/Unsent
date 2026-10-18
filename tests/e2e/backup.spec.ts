import { readFile, writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { nav, onboard, writeMessage, choose } from './helpers'

test.describe('Journey D — backup and restore', () => {
  test('export from one device, restore on another, then merge without duplicates', async ({ page, browser }, testInfo) => {
    await onboard(page, { daysAgo: 5, reasons: ['Peace 🌿'] })
    await writeMessage(page, { title: 'Kept', body: 'Line one\nLine two 💙' })
    await page.goto('/#/settings')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download backup' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^unsent-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const file = testInfo.outputPath('backup.json')
    await download.saveAs(file)
    const json = JSON.parse(await readFile(file, 'utf8'))
    expect(json).toMatchObject({ app: 'unsent', schemaVersion: 1 })
    await expect(page.getByText('Last backup: today')).toBeVisible()

    // A fresh browser context is a new device with empty storage.
    const device = await browser.newContext({ ...testInfo.project.use })
    const newPage = await device.newPage()
    await newPage.goto('/')
    await newPage.getByRole('button', { name: 'Restore from a backup' }).click()
    await newPage.locator('#backup-file').setInputFiles(file)
    await expect(newPage.getByText('This backup contains:')).toBeVisible()
    await newPage.getByRole('button', { name: 'Restore this backup' }).click()
    await expect(newPage.getByRole('region', { name: 'No-contact status' })).toContainText('5')
    await nav(newPage, 'Unsent').click()
    await newPage.getByRole('link', { name: /Kept/ }).click()
    await expect(newPage.getByLabel('Message', { exact: true })).toHaveValue('Line one\nLine two 💙')

    // Merging the same backup again must not duplicate anything.
    await newPage.goto('/#/settings')
    await newPage.locator('#backup-file').setInputFiles(file)
    await expect(newPage.getByText(/would add 0 and update 0/)).toBeVisible()
    await newPage.getByRole('button', { name: 'Merge with this device' }).click()
    await nav(newPage, 'Unsent').click()
    await expect(newPage.getByRole('link', { name: /Kept/ })).toHaveCount(1)
    await device.close()
  })

  test('replace needs typed confirmation; malformed files change nothing', async ({ page }, testInfo) => {
    await onboard(page)
    await writeMessage(page, { title: 'Original', body: 'mine' })
    await page.goto('/#/settings')

    const bad = testInfo.outputPath('bad.json')
    await writeFile(bad, '{"app":"unsent","schemaVersion":1,"data":{"messages":"oops"}')
    await page.locator('#backup-file').setInputFiles(bad)
    await expect(page.getByRole('alert')).toContainText('Nothing was changed.')

    const future = testInfo.outputPath('future.json')
    await writeFile(future, JSON.stringify({ app: 'unsent', schemaVersion: 7, exportedAt: new Date().toISOString(), data: {} }))
    await page.getByRole('button', { name: 'Choose another file' }).click()
    await page.locator('#backup-file').setInputFiles(future)
    await expect(page.getByRole('alert')).toContainText('newer version')

    // A valid but empty-ish backup from another device.
    const other = testInfo.outputPath('other.json')
    await writeFile(
      other,
      JSON.stringify({
        app: 'unsent',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        data: { settings: null, preferences: null, trackingHistory: [], messages: [], urges: [], checkIns: [], personalItems: [], plans: [], lifeLog: [], trackers: [], exerciseEntries: [], voiceNotes: [] },
      }),
    )
    await page.getByRole('button', { name: 'Choose another file' }).click()
    await page.locator('#backup-file').setInputFiles(other)
    await page.getByRole('button', { name: 'Replace everything' }).click()
    const dialog = page.getByRole('dialog', { name: 'Replace all data on this device?' })
    const confirm = dialog.getByRole('button', { name: 'Replace everything' })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    await nav(page, 'Unsent').click()
    await expect(page.getByRole('link', { name: /Original/ })).toBeVisible()
  })

  test('passphrase-protected backups open only with the passphrase', async ({ page }, testInfo) => {
    await onboard(page)
    await writeMessage(page, { title: 'Secret', body: 'protected words' })
    await page.goto('/#/settings')
    await choose(page.getByRole('switch', { name: /Protect the backup with a passphrase/ }))
    await page.getByLabel('Backup passphrase').first().fill('correct horse battery')
    await page.getByLabel('Repeat passphrase').first().fill('correct horse battery')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download backup' }).click()
    const file = testInfo.outputPath('protected.json')
    await (await downloadPromise).saveAs(file)
    expect(await readFile(file, 'utf8')).not.toContain('protected words')

    await page.locator('#backup-file').setInputFiles(file)
    await page.getByLabel('Backup passphrase').last().fill('wrong passphrase')
    await page.getByRole('button', { name: 'Open backup' }).click()
    await expect(page.getByText('That passphrase did not open this backup.')).toBeVisible()
    await page.getByLabel('Backup passphrase').last().fill('correct horse battery')
    await page.getByRole('button', { name: 'Open backup' }).click()
    await expect(page.getByText('This backup contains:')).toBeVisible()
  })
})
