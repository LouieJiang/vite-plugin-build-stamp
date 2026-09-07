import { describe, it, expect } from 'vitest'
import { decryptPayload } from './crypto'
import { decryptInBrowser } from './browser-fallback'
import { createHash, pbkdf2Sync, randomBytes, createCipheriv } from 'crypto'
import { CRYPTO_SALT_PREFIX } from './constants'

function encryptPayload(plaintext: string, password: string): string {
  const salt = createHash('sha256').update(`${CRYPTO_SALT_PREFIX}${password}`).digest()
  const keyBuf = pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

describe('decryptInBrowser', () => {
  it('matches Node decryptPayload roundtrip', () => {
    const info = { 'build:version': '1.0.0', 'build:time': '2024-01-01T00:00:00.000Z' }
    const b64 = encryptPayload(JSON.stringify(info), 'test-key')
    expect(decryptInBrowser(b64, 'test-key')).toEqual(info)
    expect(decryptPayload(b64, 'test-key')).toEqual(info)
  })

  it('fails with wrong key', () => {
    const b64 = encryptPayload('{"build:version":"1.0.0"}', 'right-key')
    expect(() => decryptInBrowser(b64, 'wrong-key')).toThrow()
  })
})
