import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { Plugin, ResolvedConfig } from 'vite'
import { buildDecryptScript } from './decrypt-script'
import { resolveConsoleI18n, type BuildStampLocale } from './i18n'
import { CRYPTO_SALT_PREFIX } from './constants'
import { resolveEncryptKey, validateOptions } from './validate'

export type { BuildStampLocale } from './i18n'

export interface EncryptOptions {
  /** AES-GCM encryption key (any string). Same key required to decrypt in the browser. */
  key: string
  /** Name exposed on `window` for console decryption. Default: `'__buildInfo'`. */
  helperName?: string
}

export interface BuildStampOptions {
  /** Inject build timestamp (ISO 8601). Default: `true`. */
  buildTime?: boolean
  /** Inject `version` from `package.json`. Default: `true`. */
  version?: boolean
  /**
   * Inject git commit hash. Default: `true` (short hash).
   * Pass `{ short: false }` for the full hash.
   */
  gitCommit?: boolean | { short?: boolean }
  /** Inject Vite build mode. Default: `true`. */
  mode?: boolean
  /** Inject current git branch. Default: `true`. */
  gitBranch?: boolean
  /** Extra key-value pairs, e.g. `{ region: 'cn' }`. */
  custom?: Record<string, string>
  /** Meta name prefix. Default: `'build'` → `build:time`, etc. */
  prefix?: string
  /** Inject during `vite dev` as well. Default: `false`. */
  injectInDev?: boolean
  /**
   * Console output language for encrypted mode.
   * Default: `'zh'`. Set to `'en'` for English labels and date formatting.
   */
  locale?: BuildStampLocale
  /**
   * Encrypted mode: single `<meta name="build:encrypted">` plus an inline decrypt helper.
   * Plain meta tags are omitted when this is set.
   */
  encrypt?: EncryptOptions
}

// ─── Git / package.json ───────────────────────────────────────────────────────

function getGitCommit(short: boolean): string {
  try {
    const format = short ? '--short' : ''
    return execSync(`git rev-parse ${format} HEAD`, { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

function getGitBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

function getPackageVersion(root: string): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
    return pkg.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildMetaTag(name: string, content: string): string {
  return `<meta name="${escapeAttr(name)}" content="${escapeAttr(content)}">`
}

// ─── Encryption (Node.js crypto, build time) ──────────────────────────────────

async function encryptPayload(plaintext: string, password: string): Promise<string> {
  const { createHash, pbkdf2Sync, randomBytes, createCipheriv } = await import('crypto')

  const salt = createHash('sha256').update(`${CRYPTO_SALT_PREFIX}${password}`).digest()
  const keyBuf = pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
  const iv = randomBytes(12)

  const cipher = createCipheriv('aes-256-gcm', keyBuf, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

function collectBuildInfo(
  resolvedConfig: ResolvedConfig,
  options: Required<
    Pick<BuildStampOptions, 'buildTime' | 'version' | 'gitCommit' | 'gitBranch' | 'mode' | 'custom' | 'prefix'>
  >,
): Record<string, string> {
  const { buildTime, version, gitCommit, gitBranch, mode, custom, prefix } = options
  const p = (key: string) => `${prefix}:${key}`
  const info: Record<string, string> = {}

  if (buildTime) info[p('time')] = new Date().toISOString()
  if (version) info[p('version')] = getPackageVersion(resolvedConfig.root)
  if (gitCommit) {
    const short = typeof gitCommit === 'object' ? (gitCommit.short ?? true) : true
    info[p('commit')] = getGitCommit(short)
  }
  if (gitBranch) info[p('branch')] = getGitBranch()
  if (mode) info[p('mode')] = resolvedConfig.mode

  for (const [key, value] of Object.entries(custom)) {
    info[p(key)] = value
  }

  return info
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export function buildStamp(options: BuildStampOptions = {}): Plugin {
  validateOptions(options)

  const {
    buildTime = true,
    version = true,
    gitCommit = true,
    gitBranch = true,
    mode = true,
    custom = {},
    prefix = 'build',
    injectInDev = false,
    locale = 'zh',
    encrypt,
  } = options

  const encryptKey = resolveEncryptKey(encrypt)

  let resolvedConfig: ResolvedConfig

  return {
    name: 'vite-plugin-build-stamp',
    enforce: 'post',

    configResolved(config) {
      resolvedConfig = config
    },

    transformIndexHtml: {
      order: 'post',
      async handler(html) {
        if (!injectInDev && resolvedConfig.command === 'serve') {
          return html
        }

        const info = collectBuildInfo(resolvedConfig, {
          buildTime,
          version,
          gitCommit,
          gitBranch,
          mode,
          custom,
          prefix,
        })

        let injection: string

        if (encryptKey) {
          const helperName = encrypt!.helperName ?? '__buildInfo'
          const encryptedMetaName = `${prefix}:encrypted`
          const ciphertext = await encryptPayload(JSON.stringify(info), encryptKey)
          const i18n = resolveConsoleI18n(locale)

          injection = [
            '    <!-- build stamp (vite-plugin-build-stamp) [encrypted] -->',
            `    ${buildMetaTag(encryptedMetaName, ciphertext)}`,
            `    ${buildDecryptScript(encryptedMetaName, helperName, i18n)}`,
            '    <!-- /build stamp -->',
          ].join('\n')
        } else {
          const tags = Object.entries(info).map(([name, value]) => buildMetaTag(name, value))

          injection = [
            '    <!-- build stamp (vite-plugin-build-stamp) -->',
            ...tags.map(t => `    ${t}`),
            '    <!-- /build stamp -->',
          ].join('\n')
        }

        return html.replace(/<\/head>/i, `${injection}\n  </head>`)
      },
    },
  }
}

export default buildStamp
