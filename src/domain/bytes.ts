/** Base64 helpers for binary fields (photos, voice notes, key material) in JSON. */

/**
 * Realm-safe Uint8Array check. Values read back from IndexedDB (or another frame)
 * can come from a different realm, where `instanceof Uint8Array` is false.
 */
export function isBytes(value: unknown): value is Uint8Array {
  return Object.prototype.toString.call(value) === '[object Uint8Array]'
}
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** JSON.stringify replacer that writes Uint8Array values as base64 strings. */
export function bytesReplacer(_key: string, value: unknown): unknown {
  return isBytes(value) ? bytesToBase64(value) : value
}
