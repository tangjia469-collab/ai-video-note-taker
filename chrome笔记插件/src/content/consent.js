/* ============================================================
 * consent.js - 域名级同意管理 (轻量, 直接读写 chrome.storage.local)
 * 也被合并到 video-detector.js 中以避免 MV3 content_script 的
 * import 限制. 此文件保留作为同源参考实现.
 * ============================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'aivnt:consentDomains';

  // 读取某 hostname 的同意状态
  // 返回值: 'allow' | 'deny' | undefined
  async function getConsent(hostname) {
    try {
      const r = await chrome.storage.local.get(STORAGE_KEY);
      const map = r[STORAGE_KEY] || {};
      return map[hostname];
    } catch {
      return undefined;
    }
  }

  // 写入某 hostname 的同意状态
  async function setConsent(hostname, value) {
    try {
      const r = await chrome.storage.local.get(STORAGE_KEY);
      const map = r[STORAGE_KEY] || {};
      if (value == null) {
        delete map[hostname];
      } else {
        map[hostname] = value;
      }
      await chrome.storage.local.set({ [STORAGE_KEY]: map });
    } catch {}
  }

  // 暴露到 window 以便其他 content 脚本调用
  window.__aivntConsent = { getConsent, setConsent, STORAGE_KEY };
})();
