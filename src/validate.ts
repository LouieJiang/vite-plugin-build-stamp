/** Meta key segment: `build`, `app`, `my-field` */
const META_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/

/** Valid `window` property name for the decrypt helper */
const HELPER_NAME_RE = /^[$A-Z_a-z][$\w]*$/

const PLUGIN = '[vite-plugin-build-stamp]'

export function assertValidPrefix(prefix: string): void {
  if (!META_KEY_RE.test(prefix)) {
    throw new Error(
      `${PLUGIN} Invalid prefix "${prefix}". Use letters, numbers, hyphen, or underscore; must start with a letter.`,
    )
  }
}

export function assertValidHelperName(name: string): void {
  if (!HELPER_NAME_RE.test(name)) {
    throw new Error(
      `${PLUGIN} Invalid encrypt.helperName "${name}". Must be a valid JavaScript identifier.`,
    )
  }
}

export function assertValidCustomKeys(custom: Record<string, string>): void {
  for (const key of Object.keys(custom)) {
    if (!META_KEY_RE.test(key)) {
      throw new Error(
        `${PLUGIN} Invalid custom key "${key}". Use letters, numbers, hyphen, or underscore; must start with a letter.`,
      )
    }
  }
}

/** Requires a non-empty key when `encrypt` is present. Returns trimmed key. */
export function resolveEncryptKey(
  encrypt: { key?: string; helperName?: string } | undefined,
): string | undefined {
  if (encrypt === undefined) return undefined

  const key = encrypt.key?.trim()
  if (!key) {
    throw new Error(`${PLUGIN} encrypt.key is required when encrypt is enabled.`)
  }
  return key
}

export function validateOptions(options: {
  prefix?: string
  custom?: Record<string, string>
  encrypt?: { key?: string; helperName?: string }
}): void {
  const {
    prefix = 'build',
    custom = {},
    encrypt,
  } = options

  assertValidPrefix(prefix)
  assertValidCustomKeys(custom)

  if (encrypt !== undefined) {
    resolveEncryptKey(encrypt)
    if (encrypt.helperName !== undefined) {
      assertValidHelperName(encrypt.helperName)
    }
  }
}
