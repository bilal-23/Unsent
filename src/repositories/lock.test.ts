import { Dexie } from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../db/database'
import { isEncryptedValue } from '../db/encryption'
import { createRepos, type Repos } from '.'
import { WrongPassphraseError } from './lockRepo'

const SECRET = 'I still think about you every day 💙'
let name: string
let repos: Repos

/** Reads rows straight from IndexedDB, bypassing the encryption middleware. */
async function rawRows(table: string) {
  const raw = new Dexie(name)
  await raw.open()
  const rows = await raw.table(table).toArray()
  raw.close()
  return rows
}

beforeEach(async () => {
  name = `lock-test-${Math.random().toString(36).slice(2)}`
  repos = createRepos(createDatabase(name))
  await repos.connection.open()
  await repos.lock.init()
  await repos.tracking.setup({ lastContactDate: '2026-10-15', journalName: 'Private', reasons: ['Peace'] })
  await repos.messages.create({ title: 'Dear you', body: SECRET, tags: ['raw'] })
  await repos.urges.create({ intensity: 6, trigger: 'Missing them', note: SECRET })
  await repos.lifeLog.addMoment('Sunset', '2026-10-17', { mimeType: 'image/jpeg', width: 1, height: 1, data: new Uint8Array([9, 9, 9]) })
})

describe('app lock (encryption at rest)', () => {
  it('encrypts existing writing and keeps metadata readable for indexes', async () => {
    await repos.lock.enable('correct horse battery')
    const [message] = await rawRows('messages')
    expect(isEncryptedValue(message.body)).toBe(true)
    expect(isEncryptedValue(message.title)).toBe(true)
    expect(JSON.stringify(message)).not.toContain('still think')
    expect(message.status).toBe('draft')
    const [urge] = await rawRows('urges')
    expect(urge.intensity).toBe(6)
    expect(isEncryptedValue(urge.trigger)).toBe(true)
    const [moment] = await rawRows('lifeLog')
    expect(isEncryptedValue(moment.photo.data)).toBe(true)
    expect(moment.photo.width).toBe(1)
    const [settings] = await rawRows('settings')
    expect(isEncryptedValue(settings.journalName)).toBe(true)
    expect(settings.lastContactDate).toBe('2026-10-15')
  })

  it('reads plaintext through the app while unlocked, and encrypts new writes', async () => {
    await repos.lock.enable('correct horse battery')
    expect((await repos.messages.list())[0].body).toBe(SECRET)
    await repos.messages.create({ title: '', body: 'brand new secret', tags: [] })
    expect(JSON.stringify(await rawRows('messages'))).not.toContain('brand new secret')
  })

  it('refuses reads and writes while locked, then unlocks with the passphrase', async () => {
    await repos.lock.enable('correct horse battery')
    repos.lock.lock()
    expect(repos.lock.status()).toBe('locked')
    await expect(repos.messages.list()).rejects.toMatchObject({ kind: 'locked' })
    await expect(repos.messages.create({ title: '', body: 'plaintext?', tags: [] })).rejects.toMatchObject({ kind: 'locked' })
    expect(JSON.stringify(await rawRows('messages'))).not.toContain('plaintext?')

    await expect(repos.lock.unlock('wrong passphrase')).rejects.toBeInstanceOf(WrongPassphraseError)
    await repos.lock.unlock('correct horse battery')
    expect(repos.lock.status()).toBe('unlocked')
    expect((await repos.messages.list())[0].body).toBe(SECRET)
  })

  it('survives a restart: a new connection starts locked', async () => {
    await repos.lock.enable('correct horse battery')
    repos.connection.close()
    const reopened = createRepos(createDatabase(name))
    await reopened.connection.open()
    await reopened.lock.init()
    expect(reopened.lock.status()).toBe('locked')
    await reopened.lock.unlock('correct horse battery')
    expect((await reopened.urges.list())[0].note).toBe(SECRET)
  })

  it('changes the passphrase without re-encrypting', async () => {
    await repos.lock.enable('correct horse battery')
    const before = (await rawRows('messages'))[0].body
    await expect(repos.lock.changePassphrase('nope nope nope', 'new passphrase 1')).rejects.toBeInstanceOf(WrongPassphraseError)
    await repos.lock.changePassphrase('correct horse battery', 'new passphrase 1')
    expect((await rawRows('messages'))[0].body).toEqual(before)
    repos.lock.lock()
    await expect(repos.lock.unlock('correct horse battery')).rejects.toBeInstanceOf(WrongPassphraseError)
    await repos.lock.unlock('new passphrase 1')
    expect((await repos.messages.list())[0].body).toBe(SECRET)
  })

  it('turning the lock off decrypts everything and removes the key', async () => {
    await repos.lock.enable('correct horse battery')
    await repos.lock.disable('correct horse battery')
    expect(repos.lock.status()).toBe('off')
    const [message] = await rawRows('messages')
    expect(message.body).toBe(SECRET)
    expect(Array.from((await rawRows('lifeLog'))[0].photo.data)).toEqual([9, 9, 9])
    expect(await rawRows('keyring')).toHaveLength(0)
  })

  it('exports plaintext backups while unlocked (encryption is for storage at rest)', async () => {
    await repos.lock.enable('correct horse battery')
    const snapshot = await repos.data.snapshot()
    expect(snapshot.messages[0].body).toBe(SECRET)
  })

  it('rejects short passphrases', async () => {
    await expect(repos.lock.enable('short')).rejects.toThrow()
    expect(repos.lock.status()).toBe('off')
  })
})
