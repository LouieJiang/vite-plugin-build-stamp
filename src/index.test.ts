import { describe, it, expect, vi } from 'vitest'
import { buildStamp } from '../src/index'
import { decryptPayload } from './crypto'
import type { ResolvedConfig } from 'vite'

vi.mock('child_process', () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd.includes('abbrev-ref')) return Buffer.from('feature/my-branch\n')
    if (cmd.includes('--short')) return Buffer.from('abc1234\n')
    return Buffer.from('abc1234def5678901234567890abcdef\n')
  }),
}))

vi.mock('fs', () => ({
  readFileSync: vi.fn(() => JSON.stringify({ version: '2.3.1' })),
}))

function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    root: '/project',
    mode: 'production',
    command: 'build',
    ...overrides,
  } as unknown as ResolvedConfig
}

async function runPlugin(html: string, options = {}, configOverrides = {}) {
  const plugin = buildStamp(options)
  ;(plugin.configResolved as Function)(makeConfig(configOverrides))
  const handler = (plugin.transformIndexHtml as any).handler
  return await handler(html, {})
}

const baseHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>Test</title>
  </head>
  <body></body>
</html>`

describe('plain mode', () => {
  it('injects all meta tags by default', async () => {
    const result = await runPlugin(baseHtml)
    expect(result).toContain('name="build:time"')
    expect(result).toContain('name="build:version"')
    expect(result).toContain('name="build:commit"')
    expect(result).toContain('name="build:branch"')
    expect(result).toContain('name="build:mode"')
  })

  it('injects git branch correctly', async () => {
    const result = await runPlugin(baseHtml)
    expect(result).toContain('content="feature/my-branch"')
  })

  it('injects version from package.json', async () => {
    const result = await runPlugin(baseHtml)
    expect(result).toContain('content="2.3.1"')
  })

  it('injects custom fields', async () => {
    const result = await runPlugin(baseHtml, { custom: { region: 'cn-north' } })
    expect(result).toContain('name="build:region"')
    expect(result).toContain('content="cn-north"')
  })

  it('respects custom prefix', async () => {
    const result = await runPlugin(baseHtml, { prefix: 'app' })
    expect(result).toContain('name="app:time"')
    expect(result).toContain('name="app:branch"')
  })

  it('can disable gitBranch', async () => {
    const result = await runPlugin(baseHtml, { gitBranch: false })
    expect(result).not.toContain('build:branch')
  })

  it('can disable individual fields', async () => {
    const result = await runPlugin(baseHtml, { gitCommit: false, mode: false })
    expect(result).not.toContain('build:commit')
    expect(result).not.toContain('build:mode')
  })

  it('skips injection in dev mode by default', async () => {
    const result = await runPlugin(baseHtml, {}, { command: 'serve' })
    expect(result).not.toContain('build:time')
  })

  it('injects in dev when injectInDev=true', async () => {
    const result = await runPlugin(baseHtml, { injectInDev: true }, { command: 'serve' })
    expect(result).toContain('build:time')
  })

  it('escapes dangerous characters in content', async () => {
    const result = await runPlugin(baseHtml, { custom: { evil: '"><script>alert(1)</script>' } })
    expect(result).not.toContain('<script>alert')
    expect(result).toContain('&lt;script&gt;')
  })

  it('injects meta before </head>', async () => {
    const result = await runPlugin(baseHtml)
    expect(result.indexOf('build:time')).toBeLessThan(result.indexOf('</head>'))
  })

  it('injects full git commit when gitCommit.short is false', async () => {
    const result = await runPlugin(baseHtml, { gitCommit: { short: false } })
    expect(result).toContain('content="abc1234def5678901234567890abcdef"')
    expect(result).not.toContain('content="abc1234"')
  })

  it('injects comment block only when all fields are disabled', async () => {
    const result = await runPlugin(baseHtml, {
      buildTime: false,
      version: false,
      gitCommit: false,
      gitBranch: false,
      mode: false,
    })
    expect(result).toContain('build stamp (vite-plugin-build-stamp)')
    expect(result).not.toMatch(/<meta name="build:/)
  })
})

describe('validation', () => {
  it('throws when encrypt is set without key', () => {
    expect(() => buildStamp({ encrypt: {} as { key: string } })).toThrow(/encrypt\.key is required/)
    expect(() => buildStamp({ encrypt: { key: '' } })).toThrow(/encrypt\.key is required/)
    expect(() => buildStamp({ encrypt: { key: '   ' } })).toThrow(/encrypt\.key is required/)
  })

  it('throws on invalid prefix', () => {
    expect(() => buildStamp({ prefix: 'bad prefix' })).toThrow(/Invalid prefix/)
    expect(() => buildStamp({ prefix: '9app' })).toThrow(/Invalid prefix/)
  })

  it('throws on invalid helperName', () => {
    expect(() =>
      buildStamp({ encrypt: { key: 'k', helperName: "x';alert(1)//" } }),
    ).toThrow(/Invalid encrypt\.helperName/)
  })

  it('throws on invalid custom keys', () => {
    expect(() => buildStamp({ custom: { 'bad key': 'v' } })).toThrow(/Invalid custom key/)
  })
})

describe('encrypt mode', () => {
  it('outputs single encrypted meta instead of plain tags', async () => {
    const result = await runPlugin(baseHtml, { encrypt: { key: 'secret123' } })
    expect(result).toContain('name="build:encrypted"')
    expect(result).not.toContain('name="build:time"')
    expect(result).not.toContain('name="build:version"')
  })

  it('injects decrypt helper script', async () => {
    const result = await runPlugin(baseHtml, { encrypt: { key: 'secret123' } })
    expect(result).toContain('<script>')
    expect(result).toContain('__buildInfo')
  })

  it('quotes encrypted meta selector in decrypt helper', async () => {
    const result = await runPlugin(baseHtml, { encrypt: { key: 'secret123' } })
    expect(result).toContain('querySelector("meta[name=\\"build:encrypted\\"]")')
  })

  it('uses custom helperName', async () => {
    const result = await runPlugin(baseHtml, {
      encrypt: { key: 'secret123', helperName: 'showBuild' },
    })
    expect(result).toContain('showBuild')
    expect(result).not.toContain('__buildInfo')
  })

  it('uses custom prefix for encrypted meta name', async () => {
    const result = await runPlugin(baseHtml, {
      prefix: 'app',
      encrypt: { key: 'secret123' },
    })
    expect(result).toContain('name="app:encrypted"')
  })

  it('encrypted content is non-empty base64', async () => {
    const result = await runPlugin(baseHtml, { encrypt: { key: 'mypassword' } })
    const match = result.match(/name="build:encrypted" content="([^"]+)"/)
    expect(match).toBeTruthy()
    const b64 = match![1]
    expect(b64.length).toBeGreaterThan(50)
    // valid base64
    expect(() => atob(b64)).not.toThrow()
  })

  it('different keys produce different ciphertext', async () => {
    const r1 = await runPlugin(baseHtml, { encrypt: { key: 'key-one' } })
    const r2 = await runPlugin(baseHtml, { encrypt: { key: 'key-two' } })
    const ct1 = r1.match(/name="build:encrypted" content="([^"]+)"/)![1]
    const ct2 = r2.match(/name="build:encrypted" content="([^"]+)"/)![1]
    expect(ct1).not.toBe(ct2)
  })

  it('adds [encrypted] comment marker', async () => {
    const result = await runPlugin(baseHtml, { encrypt: { key: 'k' } })
    expect(result).toContain('[encrypted]')
  })

  it('injects beautified console output helpers (zh)', async () => {
    const result = await runPlugin(baseHtml, { encrypt: { key: 'secret123' } })
    expect(result).toContain('前端构建信息')
    expect(result).toContain('版本号')
    expect(result).toContain('构建时间')
  })

  it('uses English console output when locale is en', async () => {
    const result = await runPlugin(baseHtml, {
      locale: 'en',
      encrypt: { key: 'secret123' },
    })
    expect(result).toContain('Frontend Build Info')
    expect(result).toContain('Build Time')
    expect(result).toContain('Git Branch')
    expect(result).not.toContain('前端构建信息')
  })

  it('decrypts ciphertext with the same key (roundtrip)', async () => {
    const result = await runPlugin(baseHtml, { encrypt: { key: 'roundtrip-key' } })
    const match = result.match(/name="build:encrypted" content="([^"]+)"/)
    expect(match).toBeTruthy()

    const info = decryptPayload(match![1], 'roundtrip-key')
    expect(info['build:version']).toBe('2.3.1')
    expect(info['build:branch']).toBe('feature/my-branch')
    expect(info['build:commit']).toBe('abc1234')
    expect(info['build:mode']).toBe('production')
    expect(info['build:time']).toBeTruthy()
  })

  it('fails decrypt with wrong key', async () => {
    const result = await runPlugin(baseHtml, { encrypt: { key: 'correct' } })
    const b64 = result.match(/name="build:encrypted" content="([^"]+)"/)![1]
    expect(() => decryptPayload(b64, 'wrong')).toThrow()
  })
})
