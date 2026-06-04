import type { ConsoleI18n } from './i18n'

const STYLE = {
  border: 'color: #1890ff; font-weight: bold;',
  reset: 'color: #1890ff; font-weight: bold;',
  version: 'color: #52c41a; font-weight: bold; background: #f6ffed; padding: 2px 4px; border-radius: 3px;',
  time: 'color: #722ed1; font-weight: bold; background: #f9f0ff; padding: 2px 4px; border-radius: 3px;',
  branch: 'color: #13c2c2; font-weight: bold; background: #e6fffb; padding: 2px 4px; border-radius: 3px;',
  commit: 'color: #eb2f96; font-weight: bold; background: #fff0f6; padding: 2px 4px; border-radius: 3px;',
  envProd: 'color: #f5222d; font-weight: bold; background: #fff2f0; padding: 2px 4px; border-radius: 3px;',
  envDev: 'color: #fa8c16; font-weight: bold; background: #fff7e6; padding: 2px 4px; border-radius: 3px;',
  custom: 'color: #2f54eb; font-weight: bold; background: #f0f5ff; padding: 2px 4px; border-radius: 3px;',
  hintAccent: 'color:#38bdf8;font-weight:bold',
  hintCall: 'color:#a78bfa;font-family:monospace',
} as const

/**
 * Builds the inline `<script>` injected in encrypted mode.
 * Uses Web Crypto API in the browser; strings come from {@link ConsoleI18n}.
 */
export function buildDecryptScript(
  metaName: string,
  helperName: string,
  i18n: ConsoleI18n,
): string {
  const i18nJson = JSON.stringify(i18n)
  const styleJson = JSON.stringify(STYLE)

  return `<script>
(function() {
  var _i18n = ${i18nJson};
  var _style = ${styleJson};

  async function _decrypt(cipherB64, password) {
    var buf = Uint8Array.from(atob(cipherB64), function(c) { return c.charCodeAt(0); });
    var iv = buf.slice(0, 12);
    var authTag = buf.slice(12, 28);
    var ctxt = buf.slice(28);
    var enc = new TextEncoder();
    var saltStr = 'vite-plugin-build-stamp:' + password;
    var saltBuf = await crypto.subtle.digest('SHA-256', enc.encode(saltStr));
    var baseKey = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    var aesKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBuf, iterations: 100000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    var combined = new Uint8Array(ctxt.length + 16);
    combined.set(ctxt);
    combined.set(authTag, ctxt.length);
    var plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, aesKey, combined);
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function _suffix(key) {
    var i = key.lastIndexOf(':');
    return i >= 0 ? key.slice(i + 1) : key;
  }

  function _getValue(info, suffix) {
    var entry = Object.entries(info).find(function(e) { return _suffix(e[0]) === suffix; });
    return entry ? entry[1] : null;
  }

  function _logField(icon, label, value, valueStyle) {
    console.log(
      ' ' + icon + ' ' + label + ': %c' + value + '%c',
      valueStyle,
      _style.reset
    );
  }

  function _formatTime(iso) {
    var opts = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };
    if (_i18n.dateTimeZone) opts.timeZone = _i18n.dateTimeZone;
    return new Date(iso).toLocaleString(_i18n.dateLocale, opts);
  }

  function _printBuildInfo(info) {
    var border = '───────────── ' + _i18n.title + ' ─────────────';
    console.log('%c┌' + border + '┐', _style.border);

    var version = _getValue(info, 'version');
    if (version != null) _logField('📦', _i18n.version, version, _style.version);

    var buildTime = _getValue(info, 'time');
    if (buildTime != null) _logField('🕒', _i18n.buildTime, _formatTime(buildTime), _style.time);

    var gitBranch = _getValue(info, 'branch');
    if (gitBranch != null) _logField('🌿', _i18n.gitBranch, gitBranch, _style.branch);

    var gitCommit = _getValue(info, 'commit');
    if (gitCommit != null) _logField('🔗', _i18n.commitId, gitCommit, _style.commit);

    var env = _getValue(info, 'mode');
    if (env != null) {
      var envStyle = String(env).toLowerCase() === 'production' ? _style.envProd : _style.envDev;
      _logField('🌍', _i18n.environment, String(env).toUpperCase(), envStyle);
    }

    var known = { version: 1, time: 1, branch: 1, commit: 1, mode: 1 };
    Object.entries(info).forEach(function(e) {
      if (known[_suffix(e[0])]) return;
      _logField('📌', _suffix(e[0]), e[1], _style.custom);
    });

    console.log('%c└' + border + '┘', _style.border);
  }

  window[${JSON.stringify(helperName)}] = async function(key) {
    var meta = document.querySelector(${JSON.stringify(`meta[name="${metaName}"]`)});
    if (!meta) { console.error(_i18n.metaNotFound); return; }
    try {
      var info = await _decrypt(meta.getAttribute('content'), key);
      _printBuildInfo(info);
      return info;
    } catch (e) {
      console.error(_i18n.decryptFailed, e);
    }
  };

  console.log(
    '%c' + _i18n.hintBefore + '%c' + ${JSON.stringify(helperName)} + '%c' + _i18n.hintAfter,
    _style.hintAccent,
    _style.hintCall,
    'color:inherit'
  );
})();
</script>`
}
