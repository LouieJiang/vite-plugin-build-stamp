import { createDecipheriv, createHash, pbkdf2Sync } from 'crypto'

import { CRYPTO_SALT_PREFIX } from './constants'

/** Node-side decrypt; mirrors the browser helper for tests and tooling */
export function decryptPayload(cipherB64: string, password: string): Record<string, string> {
  const salt = createHash('sha256').update(`${CRYPTO_SALT_PREFIX}${password}`).digest()
  const keyBuf = pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
  const buf = Buffer.from(cipherB64, 'base64')
  const iv = buf.subarray(0, 12)
  const authTag = buf.subarray(12, 28)
  const ctxt = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', keyBuf, iv)
  decipher.setAuthTag(authTag)
  const plain = Buffer.concat([decipher.update(ctxt), decipher.final()]).toString('utf8')
  return JSON.parse(plain)
}
