import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js'

/**
 * Crypto primitives for the optional app lock and encrypted backups.
 * - Passphrase → key-encryption key: PBKDF2-SHA256 via Web Crypto (async, done outside DB transactions)
 * - Data encryption: XChaCha20-Poly1305 (synchronous, so it can run inside IndexedDB transactions;
 *   24-byte random nonces are safe to generate per message)
 */
export const KDF_ITERATIONS = 600_000
export const KEY_BYTES = 32
const NONCE_BYTES = 24

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

export async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number = KDF_ITERATIONS): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', utf8ToBytes(passphrase.normalize('NFC')) as BufferSource, 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, material, KEY_BYTES * 8)
  return new Uint8Array(bits)
}

/** Encrypts bytes; output is nonce ‖ ciphertext+tag. */
export function seal(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const nonce = randomBytes(NONCE_BYTES)
  const ciphertext = xchacha20poly1305(key, nonce).encrypt(plaintext)
  const out = new Uint8Array(NONCE_BYTES + ciphertext.length)
  out.set(nonce)
  out.set(ciphertext, NONCE_BYTES)
  return out
}

/** Decrypts output of `seal`. Throws if the key is wrong or the data was altered. */
export function open(key: Uint8Array, sealed: Uint8Array): Uint8Array {
  if (sealed.length < NONCE_BYTES + 16) throw new Error('Ciphertext too short')
  return xchacha20poly1305(key, sealed.subarray(0, NONCE_BYTES)).decrypt(sealed.subarray(NONCE_BYTES))
}

export function sealText(key: Uint8Array, text: string): Uint8Array {
  return seal(key, utf8ToBytes(text))
}

export function openText(key: Uint8Array, sealed: Uint8Array): string {
  return bytesToUtf8(open(key, sealed))
}
