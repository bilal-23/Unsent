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
    expect(await screen.findByText(/I want peace/)).toBeInTheDocument()
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

  it('deletes without a scary dialog, offers Undo, and keeps it in Recently deleted', async () => {
    const repos = await withSetup()
    const message = await repos.messages.create({ title: 'Letter', body: 'y', tags: [] })
    const { user } = renderApp(repos, `/unsent/${message.id}`)
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(async () => expect(await repos.messages.get(message.id)).toBeUndefined())
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await repos.messages.get(message.id))?.title).toBe('Letter'))
    expect(await repos.trash.count()).toBe(0)
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

describe('recently deleted', () => {
  it('restores an entry, and deleting for good needs confirmation', async () => {
    const repos = await withSetup()
    const urge = await repos.urges.create({ intensity: 7, trigger: 'Loneliness' })
    const plan = await repos.plans.add('Learn guitar')
    await repos.urges.delete(urge.id)
    await repos.plans.delete(plan.id)
    const { user } = renderApp(repos, '/deleted')
    expect(await screen.findByText('Learn guitar')).toBeInTheDocument()
    expect(screen.getByText('Intensity 7/10 · Loneliness')).toBeInTheDocument()
    expect(screen.getAllByText(/30 days left/)).toHaveLength(2)

    const urgeCard = screen.getByText('Intensity 7/10 · Loneliness').closest('li')!
    await user.click(within(urgeCard).getByRole('button', { name: 'Restore' }))
    await waitFor(async () => expect(await repos.urges.get(urge.id)).toBeDefined())

    await user.click(screen.getByRole('button', { name: 'Delete now' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete this for good?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete permanently' }))
    await waitFor(async () => expect(await repos.trash.count()).toBe(0))
    expect(await repos.plans.list()).toHaveLength(0)
  })
})

describe('search everywhere', () => {
  it('finds words across messages, urges, check-ins and good things — but never sealed letters', async () => {
    const repos = await withSetup()
    await repos.messages.create({ title: 'Letter', body: 'I miss the lake house', tags: [] })
    const sealed = await repos.messages.create({ title: 'Later', body: 'lake secrets', tags: [] })
    await repos.messages.seal(sealed.id, addDays(today(), 10))
    await repos.urges.create({ intensity: 6, note: 'Drove past the lake' })
    await repos.checkIns.saveForDate(today(), { mood: 4, reflection: 'Swam in the LAKE' })
    await repos.lifeLog.addMoment('Picnic by the lake', today())
    await repos.plans.add('Kayak on the lake')

    const { user } = renderApp(repos, '/search')
    await user.type(await screen.findByRole('searchbox', { name: 'Search everything' }), 'lake')
    expect(await screen.findByText('5 results')).toBeInTheDocument()
    expect(screen.queryByText(/secrets/)).toBeNull()
    expect(screen.getAllByText((_, el) => el?.tagName === 'MARK' && /lake/i.test(el.textContent ?? '')).length).toBeGreaterThanOrEqual(5)

    await user.click(screen.getByRole('button', { name: /^Urges/ }))
    expect(screen.getByText('1 result')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Drove past the/ })).toHaveAttribute('href', expect.stringContaining('/urges/'))
  })
})

describe('message tags', () => {
  it('filters the list by tag', async () => {
    const repos = await withSetup()
    await repos.messages.create({ title: 'Summer', body: 'a', tags: ['memories'] })
    await repos.messages.create({ title: 'Anger', body: 'b', tags: ['vent'] })
    await repos.messages.create({ title: 'Beach', body: 'c', tags: ['Memories', 'vent'] })
    const { user } = renderApp(repos, '/unsent')
    const filter = await screen.findByRole('group', { name: 'Filter by tag' })
    await user.click(within(filter).getByRole('button', { name: /#memories 2/i }))
    expect(screen.getByRole('link', { name: /Summer/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Beach/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Anger/ })).toBeNull()
  })
})

describe('plans and good things editing', () => {
  it('reorders plans', async () => {
    const repos = await withSetup()
    await repos.plans.add('First')
    await repos.plans.add('Second')
    const { user } = renderApp(repos, '/journal/plans')
    await user.click(await screen.findByRole('button', { name: 'Move "First" up' }))
    await waitFor(async () => expect((await repos.plans.list()).map((p) => p.text)).toEqual(['First', 'Second']))
  })

  it('edits a good thing’s words and day', async () => {
    const repos = await withSetup()
    await repos.lifeLog.addMoment('Coffee', today())
    const { user } = renderApp(repos, '/journal/good-things')
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const text = screen.getByLabelText('Good thing')
    await user.clear(text)
    await user.type(text, 'Coffee with Sam')
    const day = screen.getByLabelText('Day')
    await user.clear(day)
    await user.type(day, addDays(today(), -1))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await repos.lifeLog.list())[0]).toMatchObject({ text: 'Coffee with Sam', localDate: addDays(today(), -1) }))
  })
})

describe('help notes', () => {
  it('explains a screen, can be dismissed, and comes back from the (i) button', async () => {
    const repos = await withSetup()
    const { user } = renderApp(repos, '/urges')
    const note = await screen.findByRole('complementary', { name: 'About Urges' })
    expect(within(note).getByText(/only the intensity is needed/i)).toBeInTheDocument()
    await user.click(within(note).getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('complementary', { name: 'About Urges' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'What is this?' }))
    expect(screen.getByRole('complementary', { name: 'About Urges' })).toBeInTheDocument()
  })
})

describe('habits', () => {
  it('adds a habit with a weekly goal and ticks today from Home', async () => {
    const repos = await withSetup()
    await repos.habits.add({ name: 'Read', targetPerWeek: 3 })
    const { user } = renderApp(repos, '/')
    const tick = await screen.findByRole('checkbox', { name: 'Read today' })
    expect(screen.getByText('This week: 0 of 3 — a fresh start')).toBeInTheDocument()
    await user.click(tick)
    expect(await screen.findByText('This week: 1 of 3')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/streak|failed|missed/i)
  })
})
