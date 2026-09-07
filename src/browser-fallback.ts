import { gcm } from '@noble/ciphers/aes.js'
import { pbkdf2 } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes } from '@noble/hashes/utils.js'

import { CRYPTO_SALT_PREFIX } from './constants'

/** Pure-JS decrypt for non-secure contexts (HTTP) where `crypto.subtle` is unavailable */
export function decryptInBrowser(cipherB64: string, password: string): Record<string, string> {
  const buf = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0))
  const iv = buf.slice(0, 12)
  const authTag = buf.slice(12, 28)
  const ctxt = buf.slice(28)

  const salt = sha256(utf8ToBytes(`${CRYPTO_SALT_PREFIX}${password}`))
  const key = pbkdf2(sha256, utf8ToBytes(password), salt, { c: 100_000, dkLen: 32 })

  const combined = new Uint8Array(ctxt.length + 16)
  combined.set(ctxt)
  combined.set(authTag, ctxt.length)

  const plain = gcm(key, iv).decrypt(combined)
  return JSON.parse(new TextDecoder().decode(plain))
}
