import { describe, it, expect } from 'vitest'
import { decryptPayload } from './crypto'

describe('decryptPayload', () => {
  it('rejects invalid ciphertext', () => {
    expect(() => decryptPayload('', 'key')).toThrow()
  })
})
