import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StorageError } from '../db/errors'
import { addDays, toLocalDate } from '../domain/dates'
import { openTestRepos, renderApp } from '../test/render'

const today = () => toLocalDate()

async function withSetup(daysAgo = 3, extra: Partial<{ intentionDays: number }> = {}) {
  const repos = await openTestRepos()
  await repos.tracking.setup({ lastContactDate: addDays(today(), -daysAgo), reasons: ['I want peace'], ...extra })
  return repos
}

describe('onboarding', () => {
  it('sends new users to the welcome screen and records the chosen date', async () => {
    const repos = await openTestRepos()
    const { user } = renderApp(repos, '/')
    await user.click(await screen.findByRole('button', { name: 'Get started' }))
    await user.click(screen.getByRole('button', { name: 'Skip' }))

    const date = screen.getByLabelText('Date')
    await user.clear(date)
    await user.type(date, addDays(today(), 2))
    expect(screen.getByText('The date of your last contact cannot be in the future.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    await user.clear(date)
    await user.type(date, addDays(today(), -5))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Skip and finish' }))

    await waitFor(async () => expect((await repos.tracking.get())?.lastContactDate).toBe(addDays(today(), -5)))
    expect(await screen.findByText('days since last contact')).toBeInTheDocument()
  })
})

describe('home', () => {
  it('shows elapsed calendar days and the intention without pass/fail language', async () => {
    const repos = await withSetup(3, { intentionDays: 30 })
    renderApp(repos, '/')
    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(screen.getByText('Day 3 of your 30-day intention')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/fail|broke|streak|lost/i)
  })

  it('shows "today" when the last contact was today', async () => {
    const repos = await withSetup(0)
    renderApp(repos, '/')
    expect(await screen.findByText('Last contact: today')).toBeInTheDocument()
  })

  it('records new contact without deleting entries', async () => {
    const repos = await withSetup(10)
    await repos.urges.create({ intensity: 4 })
    const { user } = renderApp(repos, '/')
    await user.click((await screen.findAllByRole('button', { name: 'I had contact' }))[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/every message, urge and check-in stays exactly where it is/i)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save date' }))
    await waitFor(async () => expect((await repos.tracking.get())?.lastContactDate).toBe(today()))
    expect(await repos.urges.list()).toHaveLength(1)
  })
})

describe('urges', () => {
  it('saves with only an intensity, then shows the user’s reasons', async () => {
    const repos = await withSetup()
    const { user } = renderApp(repos, '/urges/new')
    const save = await screen.findByRole('button', { name: 'Choose an intensity to save' })
    expect(save).toBeDisabled()
    await user.click(screen.getAllByRole('radio', { name: '6' })[0])
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Noted.')).toBeInTheDocument()
    expect(screen.getByText(/I want peace/)).toBeInTheDocument()
    expect((await repos.urges.list())[0]).toMatchObject({ intensity: 6, trigger: undefined })
  })
})

describe('check-ins', () => {
  it('opens the existing check-in for today instead of creating a duplicate', async () => {
    const repos = await withSetup()
    await repos.checkIns.saveForDate(today(), { mood: 2, personalWin: 'Called mum' })
    const { user } = renderApp(repos, '/journal/check-in/today')
    expect(await screen.findByDisplayValue('Called mum')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '5 – Very good' }))
    await user.click(screen.getByRole('button', { name: 'Save check-in' }))
    await waitFor(async () => expect((await repos.checkIns.list())[0].mood).toBe(5))
    expect(await repos.checkIns.list()).toHaveLength(1)
  })
})

describe('message editor', () => {
  it('autosaves, survives a failed write without losing text, and recovers on retry', async () => {
    const repos = await withSetup()
    const message = await repos.messages.create({ title: 'Hello', body: 'Start', tags: [] })
    const realSave = repos.messages.save
    repos.messages.save = () => Promise.reject(new StorageError('quota'))

    const { user } = renderApp(repos, `/unsent/${message.id}`)
    const body = await screen.findByLabelText('Message')
    await user.type(body, ' and more')
    expect(await screen.findByText('Unable to save — your text is still here.', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText(/storage is full/i)).toBeInTheDocument()
    expect(body).toHaveValue('Start and more')

    repos.messages.save = realSave
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect((await repos.messages.get(message.id))?.body).toBe('Start and more')
  })

  it('never offers a way to send a message', async () => {
    const repos = await withSetup()
    const message = await repos.messages.create({ title: 'x', body: 'y', tags: [] })
    renderApp(repos, `/unsent/${message.id}`)
    await screen.findByLabelText('Message')
    const labels = screen.getAllByRole('button').map((b) => `${b.textContent} ${b.getAttribute('aria-label') ?? ''}`)
    expect(labels.join(' ')).not.toMatch(/send|share|whatsapp|instagram|sms|email/i)
    expect(document.querySelectorAll('a[href^="mailto:"], a[href^="sms:"], a[href*="wa.me"]')).toHaveLength(0)
  })

  it('requires confirmation before deleting', async () => {
    const repos = await withSetup()
    const message = await repos.messages.create({ title: 'x', body: 'y', tags: [] })
    const { user } = renderApp(repos, `/unsent/${message.id}`)
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(await repos.messages.get(message.id)).toBeDefined()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete permanently' }))
    await waitFor(async () => expect(await repos.messages.get(message.id)).toBeUndefined())
  })
})

describe('settings', () => {
  it('needs a typed confirmation to clear all data and says backups are unaffected', async () => {
    const repos = await withSetup()
    await repos.messages.create({ title: '', body: 'keep?', tags: [] })
    const { user } = renderApp(repos, '/settings')
    await user.click(await screen.findByRole('button', { name: 'Delete all data on this device' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete all data?' })
    expect(within(dialog).getByText(/Backup files you have already downloaded are not affected/)).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: 'Delete everything' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox'), 'DELETE')
    await user.click(confirm)
    await waitFor(async () => expect(await repos.tracking.get()).toBeUndefined())
    expect(await repos.messages.list()).toHaveLength(0)
  })
})
