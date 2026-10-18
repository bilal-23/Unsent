import { z } from '../../lib/zod'
import { deriveKey, KDF_ITERATIONS, openText, randomBytes, sealText } from '../../db/crypto'
import { base64ToBytes, bytesToBase64 } from '../../domain/bytes'
import { APP_ID } from '../../domain/constants'

/**
 * Passphrase-protected backup: the normal backup JSON, encrypted as a whole.
 * There is no recovery — without the passphrase the file cannot be opened.
 */
export const encryptedEnvelopeSchema = z.object({
  app: z.literal(APP_ID),
  encrypted: z.strictObject({
    version: z.literal(1),
    cipher: z.literal('xchacha20poly1305'),
    kdf: z.literal('PBKDF2-SHA256'),
    iterations: z.number().int().min(100_000).max(10_000_000),
    salt: z.base64(),
  }),
  data: z.base64(),
})

export type EncryptedEnvelope = z.infer<typeof encryptedEnvelopeSchema>

export class WrongBackupPassphraseError extends Error {
  constructor() {
    super('Wrong passphrase')
    this.name = 'WrongBackupPassphraseError'
  }
}

export function asEncryptedEnvelope(json: unknown): EncryptedEnvelope | null {
  if (typeof json !== 'object' || json === null || !('encrypted' in json)) return null
  const parsed = encryptedEnvelopeSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

export async function encryptBackupJson(json: string, passphrase: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS)
  const sealed = sealText(key, json)
  key.fill(0)
  const envelope: EncryptedEnvelope = {
    app: APP_ID,
    encrypted: { version: 1, cipher: 'xchacha20poly1305', kdf: 'PBKDF2-SHA256', iterations: KDF_ITERATIONS, salt: bytesToBase64(salt) },
    data: bytesToBase64(sealed),
  }
  return JSON.stringify(envelope)
}

export async function decryptBackupJson(envelope: EncryptedEnvelope, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, base64ToBytes(envelope.encrypted.salt), envelope.encrypted.iterations)
  try {
    return openText(key, base64ToBytes(envelope.data))
  } catch {
    throw new WrongBackupPassphraseError()
  } finally {
    key.fill(0)
  }
}
