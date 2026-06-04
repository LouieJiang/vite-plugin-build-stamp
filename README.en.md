# vite-plugin-build-stamp

English | [中文](./README.md)

Injects build metadata into `index.html` as `<meta>` tags during Vite production builds.

Supports **plain mode** (human-readable tags) and **encrypted mode** (AES-256-GCM; viewable in the browser console only with the correct key).

---

## Plain mode output

```html
<!-- build stamp (vite-plugin-build-stamp) -->
<meta name="build:time"    content="2024-06-04T08:30:00.000Z">
<meta name="build:version" content="1.2.3">
<meta name="build:commit"  content="abc1234">
<meta name="build:branch"  content="main">
<meta name="build:mode"    content="production">
<!-- /build stamp -->
```

## Encrypted mode output

```html
<!-- build stamp (vite-plugin-build-stamp) [encrypted] -->
<meta name="build:encrypted" content="base64-ciphertext...">
<script>/* inline decrypt helper */</script>
<!-- /build stamp -->
```

Run in the browser console:

```js
__buildInfo('your-secret-key')
```

Example output (`locale: 'en'`):

```
┌───────────── Frontend Build Info ─────────────┐
  📦 Version: 1.2.3
  🕒 Build Time: 06/04/2024, 08:30:00 AM
  🌿 Git Branch: main
  🔗 Commit ID: abc1234
  🌍 Environment: PRODUCTION
└───────────── Frontend Build Info ─────────────┘
```

Default locale is `'zh'` (Chinese labels, `zh-CN` date format, Asia/Shanghai timezone).

---

## Install

```bash
npm install -D vite-plugin-build-stamp
# or
pnpm add -D vite-plugin-build-stamp
```

---

## Quick start

### Plain mode

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { buildStamp } from 'vite-plugin-build-stamp'

export default defineConfig({
  plugins: [buildStamp()],
})
```

### Encrypted mode

```ts
import { buildStamp } from 'vite-plugin-build-stamp'

export default defineConfig({
  plugins: [
    buildStamp({
      locale: 'en',
      encrypt: {
        key: process.env.BUILD_META_KEY ?? 'your-secret',
        helperName: '__buildInfo',
      },
    }),
  ],
})
```

> **Tip:** pass the key via an environment variable instead of hard-coding it.
>
> ```bash
> BUILD_META_KEY=my-secret vite build
> ```

---

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `buildTime` | `boolean` | `true` | Inject build timestamp (ISO 8601) |
| `version` | `boolean` | `true` | Inject `version` from `package.json` |
| `gitCommit` | `boolean \| { short?: boolean }` | `true` | Inject git commit hash (short by default) |
| `gitBranch` | `boolean` | `true` | Inject current git branch |
| `mode` | `boolean` | `true` | Inject Vite build mode |
| `custom` | `Record<string, string>` | `{}` | Extra key-value fields |
| `prefix` | `string` | `"build"` | Meta name prefix → `{prefix}:{key}` |
| `injectInDev` | `boolean` | `false` | Also inject during `vite dev` |
| `locale` | `'zh' \| 'en'` | `'zh'` | Console output language (encrypted mode) |
| `encrypt` | `EncryptOptions` | — | Encryption settings (see below) |

### EncryptOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `key` | `string` | **required** | Encryption password; derived to AES-256-GCM key via PBKDF2 |
| `helperName` | `string` | `"__buildInfo"` | Name exposed on `window` for console decryption |

---

## How encryption works

```
password
  │
  ▼ PBKDF2 (100,000 iter, SHA-256)
AES-256-GCM key
  │
  ├─ random IV (12 bytes, unique per build)
  └─ encrypt( JSON.stringify(buildInfo) )
       │
       ▼ base64( IV + AuthTag + Ciphertext )
         → stored in <meta content="...">
```

Decryption runs in the browser via the **Web Crypto API** — no extra dependencies.  
A wrong key fails AES-GCM authentication instead of returning garbage data.

---

## Reading metadata in JS (plain mode)

```ts
function getBuildInfo() {
  const get = (name: string) =>
    document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? ''
  return {
    time:    get('build:time'),
    version: get('build:version'),
    commit:  get('build:commit'),
    branch:  get('build:branch'),
    mode:    get('build:mode'),
  }
}
```

---

## Local development (without publishing to npm)

Link the plugin from a local path in your app's `package.json`:

```json
{
  "devDependencies": {
    "vite-plugin-build-stamp": "file:../path-to-this-repo"
  }
}
```

Build the plugin first: `pnpm build` in the plugin directory.

---

## Tests

```bash
npm test
```

---

## License

MIT
