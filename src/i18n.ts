/** Supported console output locales (encrypted mode). */
export type BuildStampLocale = 'zh' | 'en'

/** Strings baked into the browser decrypt helper at build time. */
export interface ConsoleI18n {
  title: string
  version: string
  buildTime: string
  gitBranch: string
  commitId: string
  environment: string
  metaNotFound: string
  decryptFailed: string
  hintBefore: string
  hintCall: string
  hintAfter: string
  dateLocale: string
  dateTimeZone?: string
}

const MESSAGES: Record<BuildStampLocale, ConsoleI18n> = {
  zh: {
    title: '前端构建信息',
    version: '版本号',
    buildTime: '构建时间',
    gitBranch: 'Git分支',
    commitId: '提交ID',
    environment: '运行环境',
    metaNotFound: '[build-stamp] 未找到加密 meta 标签',
    decryptFailed: '[build-stamp] 解密失败，密钥是否正确？',
    hintBefore: '[build-stamp] 在控制台执行 ',
    hintCall: '', // filled at runtime with helperName
    hintAfter: '("your-key") 查看构建信息',
    dateLocale: 'zh-CN',
    dateTimeZone: 'Asia/Shanghai',
  },
  en: {
    title: 'Frontend Build Info',
    version: 'Version',
    buildTime: 'Build Time',
    gitBranch: 'Git Branch',
    commitId: 'Commit ID',
    environment: 'Environment',
    metaNotFound: '[build-stamp] encrypted meta tag not found',
    decryptFailed: '[build-stamp] decryption failed — wrong key?',
    hintBefore: '[build-stamp] call ',
    hintCall: '', // filled at runtime with helperName
    hintAfter: '("your-key") in console to view build info',
    dateLocale: 'en-US',
  },
}

export function resolveConsoleI18n(locale: BuildStampLocale = 'zh'): ConsoleI18n {
  return MESSAGES[locale] ?? MESSAGES.zh
}
