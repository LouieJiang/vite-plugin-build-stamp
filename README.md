# vite-plugin-build-stamp

[English](./README.en.md) | 中文

在 Vite 打包时，自动把编译信息以 `<meta>` 标签的形式注入到 `index.html` 的 `<head>` 中。

支持**明文模式**（直接可读）和**加密模式**（AES-256-GCM，只有知道密钥的人才能在控制台解密查看）。

---

## 明文模式效果

```html
<!-- build stamp (vite-plugin-build-stamp) -->
<meta name="build:time"    content="2024-06-04T08:30:00.000Z">
<meta name="build:version" content="1.2.3">
<meta name="build:commit"  content="abc1234">
<meta name="build:branch"  content="main">
<meta name="build:mode"    content="production">
<!-- /build stamp -->
```

## 加密模式效果

```html
<!-- build stamp (vite-plugin-build-stamp) [encrypted] -->
<meta name="build:encrypted" content="base64密文...">
<script>/* 解密辅助函数 */</script>
<!-- /build stamp -->
```

在浏览器控制台执行：

```js
__buildInfo('your-secret-key')
```

输出（默认中文）：

```
┌───────────── 前端构建信息 ─────────────┐
  📦 版本号: 1.2.3
  🕒 构建时间: 2024/06/04 08:30:00
  🌿 Git分支: main
  🔗 提交ID: abc1234
  🌍 运行环境: PRODUCTION
└───────────── 前端构建信息 ─────────────┘
```

设置 `locale: 'en'` 时输出英文标签与 `en-US` 日期格式。

---

## 安装

```bash
npm install -D vite-plugin-build-stamp
# 或
pnpm add -D vite-plugin-build-stamp
```

---

## 快速上手

### 明文模式

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { buildStamp } from 'vite-plugin-build-stamp'

export default defineConfig({
  plugins: [buildStamp()],
})
```

### 加密模式

```ts
import { buildStamp } from 'vite-plugin-build-stamp'

export default defineConfig({
  plugins: [
    buildStamp({
      locale: 'zh', // 默认中文；设为 'en' 使用英文控制台输出
      encrypt: {
        key: process.env.BUILD_META_KEY ?? 'your-secret',
        helperName: '__buildInfo', // 控制台调用名，默认 '__buildInfo'
      },
    }),
  ],
})
```

> **推荐**：通过环境变量传入 key，避免密钥硬编码在代码里。
>
> ```bash
> BUILD_META_KEY=my-secret vite build
> ```

---

## 配置项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `buildTime` | `boolean` | `true` | 注入构建时间（ISO 8601） |
| `version` | `boolean` | `true` | 注入 `package.json` 中的 `version` |
| `gitCommit` | `boolean \| { short?: boolean }` | `true` | 注入 git commit hash，默认取短 hash（7位） |
| `gitBranch` | `boolean` | `true` | 注入 git 分支名 |
| `mode` | `boolean` | `true` | 注入 Vite 构建环境（`production` / `staging` 等） |
| `custom` | `Record<string, string>` | `{}` | 注入自定义字段 |
| `prefix` | `string` | `"build"` | meta name 前缀，最终为 `{prefix}:{key}` |
| `injectInDev` | `boolean` | `false` | 是否在 dev server 下也注入 |
| `locale` | `'zh' \| 'en'` | `'zh'` | 加密模式控制台输出语言 |
| `encrypt` | `EncryptOptions` | — | 加密配置，见下表 |

### EncryptOptions

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `key` | `string` | **必填** | 加密密钥（任意字符串），通过 PBKDF2 派生为 AES-256-GCM 密钥 |
| `helperName` | `string` | `"__buildInfo"` | 解密函数挂载到 `window` 上的名称 |

---

## 加密原理

```
password
  │
  ▼ PBKDF2 (100,000 iter, SHA-256)
AES-256-GCM key
  │
  ├─ random IV (12 bytes, 每次构建不同)
  └─ encrypt( JSON.stringify(buildInfo) )
       │
       ▼ base64( IV + AuthTag + Ciphertext )
         → 存入 <meta content="...">
```

浏览器端使用 **Web Crypto API** 解密，无需引入任何第三方库。  
使用错误密钥解密时，AES-GCM 的认证标签校验会直接报错，不会返回乱码数据。

---

## 在 JS 中读取（明文模式）

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

## 运行测试

```bash
npm test
```

---

## License

MIT
