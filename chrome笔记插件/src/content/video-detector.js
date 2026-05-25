/* ============================================================
 * video-detector.js  -  AI 视频笔记 / 视频检测 + 同意询问 + 面板注入
 *
 * MV3 content_script 默认非 ES module, 因此本文件用 IIFE 包裹
 * 所需常量直接硬编码 (与 src/lib/constants.js 保持一致)
 * ============================================================ */
(function () {
  'use strict';
  if (window.__aivntVideoDetectorLoaded) return;
  window.__aivntVideoDetectorLoaded = true;

  // ---------- 常量 (与 src/lib/constants.js 同步) ----------
  const MSG = {
    VIDEO_DETECTED: 'video:detected',
    VIDEO_PLAYING: 'video:playing',
    OPEN_NOTE_PANEL: 'panel:open',
    CLOSE_NOTE_PANEL: 'panel:close',
    TOGGLE_NOTE_PANEL: 'panel:toggle',
    USER_CONSENT: 'user:consent',
    GET_SETTINGS: 'settings:get'
  };
  const STORAGE_CONSENT_KEY = 'aivnt:consentDomains';
  const STORAGE_SETTINGS_KEY = 'aivnt:settings';
  const DEFAULTS = {
    autoPromptOnVideo: true,
    autoFullscreen: false,
    panelWidth: 480
  };

  // ---------- 视频过滤阈值 ----------
  const MIN_VIDEO_WIDTH = 320;       // 小于此宽度视为广告/装饰
  const MIN_VIDEO_DURATION = 60;     // 小于此秒数视为短广告
  const SCAN_INTERVAL_MS = 2000;     // 周期扫描兜底 (MutationObserver 漏掉的情况)

  // ---------- 状态 ----------
  let panelHost = null;          // 面板容器 div (挂在 documentElement)
  let panelIframe = null;        // 笔记编辑器 iframe
  let isFullscreen = false;
  let toastHost = null;          // toast shadow root host
  let observed = new WeakSet();  // 已绑定 play 监听的 video
  let promptShownForSession = false; // 本次访问已弹过 toast / 打开过面板
  let lastVideoInfo = null;
  let cachedSettings = null;

  // ---------- 工具 ----------
  function log(...a) { try { console.debug('[aivnt]', ...a); } catch {} }

  function getHostname() {
    try { return location.hostname || ''; } catch { return ''; }
  }

  function isElementHidden(el) {
    if (!el || !el.isConnected) return true;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return true;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0)
      return true;
    return false;
  }

  function isQualifiedVideo(v) {
    if (!v) return false;
    if (isElementHidden(v)) return false;
    // 元数据未就绪时, 暂时放行让 onloadedmetadata 重试
    if (v.readyState >= 1) {
      if (v.videoWidth && v.videoWidth < MIN_VIDEO_WIDTH) return false;
      if (v.duration && isFinite(v.duration) && v.duration < MIN_VIDEO_DURATION) return false;
    }
    return true;
  }

  function pickVideoInfo(v) {
    return {
      title: (document.title || '').trim() || location.hostname,
      url: location.href,
      duration: (v && isFinite(v.duration)) ? v.duration : 0,
      currentTime: (v && isFinite(v.currentTime)) ? v.currentTime : 0,
      hostname: getHostname()
    };
  }

  // ---------- 设置读取 ----------
  async function loadSettings() {
    if (cachedSettings) return cachedSettings;
    try {
      const r = await chrome.storage.local.get(STORAGE_SETTINGS_KEY);
      cachedSettings = Object.assign({}, DEFAULTS, r[STORAGE_SETTINGS_KEY] || {});
    } catch {
      cachedSettings = Object.assign({}, DEFAULTS);
    }
    return cachedSettings;
  }
  // 设置变更时清缓存
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[STORAGE_SETTINGS_KEY]) cachedSettings = null;
    });
  } catch {}

  // ---------- 同意管理 ----------
  async function getConsent(hostname) {
    try {
      const r = await chrome.storage.local.get(STORAGE_CONSENT_KEY);
      return (r[STORAGE_CONSENT_KEY] || {})[hostname];
    } catch { return undefined; }
  }
  async function setConsent(hostname, value) {
    try {
      const r = await chrome.storage.local.get(STORAGE_CONSENT_KEY);
      const map = r[STORAGE_CONSENT_KEY] || {};
      if (value == null) delete map[hostname]; else map[hostname] = value;
      await chrome.storage.local.set({ [STORAGE_CONSENT_KEY]: map });
    } catch {}
  }

  // ---------- Toast (Shadow DOM) ----------
  async function showConsentToast(videoInfo) {
    if (toastHost) return; // 已经显示, 不重复
    toastHost = document.createElement('div');
    toastHost.id = '__aivnt-toast-host';
    toastHost.style.all = 'initial';
    const shadow = toastHost.attachShadow({ mode: 'open' });

    // 注入 CSS
    let cssText = '';
    try {
      const url = chrome.runtime.getURL('src/content/inject-toast.css');
      const resp = await fetch(url);
      cssText = await resp.text();
    } catch {}

    shadow.innerHTML = `
      <style>${cssText}</style>
      <div class="aivnt-toast" role="dialog" aria-label="AI 视频笔记">
        <button class="close" data-act="close" aria-label="关闭">×</button>
        <div class="head">
          <span class="dot"></span>
          <span class="title">检测到视频</span>
        </div>
        <div class="desc">是否打开 AI 笔记面板, 边看边自动整理笔记?</div>
        <div class="btns">
          <button class="primary" data-act="once">本次打开</button>
          <button data-act="always">总是允许</button>
          <button data-act="deny">拒绝</button>
          <button class="danger" data-act="never">本站不再询问</button>
        </div>
      </div>
    `;
    (document.documentElement || document.body).appendChild(toastHost);
    const card = shadow.querySelector('.aivnt-toast');
    requestAnimationFrame(() => card.classList.add('show'));

    const dismiss = () => {
      if (!toastHost) return;
      card.classList.remove('show');
      card.classList.add('hide');
      setTimeout(() => {
        if (toastHost && toastHost.parentNode) toastHost.parentNode.removeChild(toastHost);
        toastHost = null;
      }, 240);
    };

    shadow.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const act = btn.dataset.act;
      const host = videoInfo.hostname || getHostname();
      switch (act) {
        case 'once':
          dismiss();
          openPanel(videoInfo);
          break;
        case 'always':
          await setConsent(host, 'allow');
          dismiss();
          openPanel(videoInfo);
          break;
        case 'deny':
          dismiss();
          break;
        case 'never':
          await setConsent(host, 'deny');
          dismiss();
          break;
        case 'close':
          dismiss();
          break;
      }
    });

    // 15秒后自动消失
    setTimeout(() => { if (toastHost) dismiss(); }, 15000);
  }

  // ---------- 面板注入 ----------
  function buildPanelUrl(videoInfo) {
    const base = chrome.runtime.getURL('src/editor/editor.html');
    const q = new URLSearchParams({
      title: videoInfo.title || '',
      url: videoInfo.url || '',
      duration: String(videoInfo.duration || 0),
      currentTime: String(videoInfo.currentTime || 0)
    });
    return `${base}?${q.toString()}`;
  }

  async function openPanel(videoInfo) {
    lastVideoInfo = videoInfo || lastVideoInfo || pickVideoInfo(findBestVideo());
    const settings = await loadSettings();
    const width = Math.max(320, parseInt(settings.panelWidth, 10) || 480);

    if (panelHost) {
      // 已经存在: 只刷新 URL (新视频信息)
      try { panelIframe.src = buildPanelUrl(lastVideoInfo); } catch {}
      panelHost.style.display = 'block';
      document.body && (document.body.style.marginRight = width + 'px');
      return;
    }

    panelHost = document.createElement('div');
    panelHost.id = '__aivnt-panel-host';
    Object.assign(panelHost.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      width: width + 'px',
      height: '100vh',
      zIndex: '2147483645',
      background: '#fff',
      boxShadow: '-2px 0 20px rgba(0,0,0,0.18)',
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid rgba(0,0,0,0.08)',
      transition: 'width 180ms ease, left 180ms ease, top 180ms ease, height 180ms ease',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    });

    // 顶部工具条
    const bar = document.createElement('div');
    Object.assign(bar.style, {
      flex: '0 0 auto',
      height: '34px',
      background: 'linear-gradient(180deg,#1f2330,#171a23)',
      color: '#e8ecf1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '4px',
      padding: '0 8px',
      fontSize: '12px',
      userSelect: 'none'
    });
    const mkBtn = (label, title, onClick) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = title;
      Object.assign(b.style, {
        background: 'transparent',
        color: '#e8ecf1',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: '6px',
        padding: '3px 9px',
        font: 'inherit',
        cursor: 'pointer'
      });
      b.addEventListener('mouseenter', () => b.style.background = 'rgba(255,255,255,0.08)');
      b.addEventListener('mouseleave', () => b.style.background = 'transparent');
      b.addEventListener('click', onClick);
      return b;
    };
    const labelSpan = document.createElement('span');
    labelSpan.textContent = 'AI 视频笔记';
    Object.assign(labelSpan.style, {
      marginRight: 'auto',
      paddingLeft: '4px',
      fontWeight: '600',
      letterSpacing: '0.3px',
      color: '#fff'
    });
    bar.appendChild(labelSpan);
    bar.appendChild(mkBtn('全屏', '切换全屏笔记模式 (Esc 退出)', toggleFullscreen));
    bar.appendChild(mkBtn('×', '关闭面板', closePanel));

    // iframe
    panelIframe = document.createElement('iframe');
    panelIframe.src = buildPanelUrl(lastVideoInfo);
    panelIframe.id = '__aivnt-panel-iframe';
    Object.assign(panelIframe.style, {
      flex: '1 1 auto',
      width: '100%',
      border: 'none',
      background: '#fff',
      display: 'block'
    });
    panelIframe.setAttribute('allow', 'microphone; clipboard-read; clipboard-write');

    panelHost.appendChild(bar);
    panelHost.appendChild(panelIframe);
    (document.documentElement || document.body).appendChild(panelHost);

    // 让出页面空间
    if (document.body) document.body.style.marginRight = width + 'px';

    // Esc 退出全屏 (不关闭面板)
    document.addEventListener('keydown', onKeydown, true);

    // 自动全屏
    if (settings.autoFullscreen) toggleFullscreen(true);
  }

  function closePanel() {
    if (!panelHost) return;
    try { panelHost.parentNode && panelHost.parentNode.removeChild(panelHost); } catch {}
    panelHost = null;
    panelIframe = null;
    isFullscreen = false;
    if (document.body) document.body.style.marginRight = '';
    document.removeEventListener('keydown', onKeydown, true);
  }

  async function togglePanel() {
    if (panelHost) {
      closePanel();
    } else {
      const v = findBestVideo();
      const info = v ? pickVideoInfo(v) : (lastVideoInfo || {
        title: document.title || location.hostname,
        url: location.href,
        duration: 0,
        currentTime: 0,
        hostname: getHostname()
      });
      openPanel(info);
    }
  }

  async function toggleFullscreen(force) {
    if (!panelHost) return;
    const next = (typeof force === 'boolean') ? force : !isFullscreen;
    isFullscreen = next;
    if (next) {
      panelHost.classList.add('aivnt-fullscreen');
      Object.assign(panelHost.style, {
        width: '100vw',
        height: '100vh',
        top: '0',
        left: '0',
        right: '0'
      });
      if (document.body) document.body.style.marginRight = '';
    } else {
      panelHost.classList.remove('aivnt-fullscreen');
      const settings = await loadSettings();
      const width = Math.max(320, parseInt(settings.panelWidth, 10) || 480);
      Object.assign(panelHost.style, {
        width: width + 'px',
        height: '100vh',
        top: '0',
        left: 'auto',
        right: '0'
      });
      if (document.body) document.body.style.marginRight = width + 'px';
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && isFullscreen) {
      e.stopPropagation();
      toggleFullscreen(false);
    }
  }

  // 暴露给其他模块 (背景脚本 / 工具栏)
  window.__aivntInjectPanel = openPanel;
  window.__aivntTogglePanel = togglePanel;
  window.__aivntClosePanel = closePanel;

  // ---------- 视频发现 ----------
  function listVideos() {
    return Array.from(document.querySelectorAll('video'));
  }
  function findBestVideo() {
    const list = listVideos().filter(isQualifiedVideo);
    if (!list.length) return null;
    // 选最大 (最可能是主视频)
    return list.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return (rb.width * rb.height) - (ra.width * ra.height);
    })[0];
  }

  async function handleVideoPlay(v) {
    if (promptShownForSession) return;
    if (!isQualifiedVideo(v)) return;
    const settings = await loadSettings();
    if (!settings.autoPromptOnVideo) return;

    const info = pickVideoInfo(v);
    lastVideoInfo = info;
    const host = info.hostname;
    const consent = await getConsent(host);

    promptShownForSession = true;

    // 通知背景: 已检测到视频 (供徽章/分析使用)
    try { chrome.runtime.sendMessage({ type: MSG.VIDEO_DETECTED, videoInfo: info }); } catch {}

    if (consent === 'allow') {
      try { chrome.runtime.sendMessage({ type: MSG.OPEN_NOTE_PANEL, videoInfo: info }); } catch {}
      openPanel(info);
    } else if (consent === 'deny') {
      // 用户已拒绝, 静默
    } else {
      showConsentToast(info);
    }
  }

  function bindVideo(v) {
    if (!v || observed.has(v)) return;
    observed.add(v);
    const onPlay = () => {
      v.removeEventListener('play', onPlay);
      handleVideoPlay(v);
    };
    v.addEventListener('play', onPlay, { once: true });
    // 元数据加载完后再次评估 (有些站点 play 事件早于 metadata)
    if (v.readyState < 1) {
      const onMeta = () => {
        v.removeEventListener('loadedmetadata', onMeta);
        if (!v.paused) handleVideoPlay(v);
      };
      v.addEventListener('loadedmetadata', onMeta, { once: true });
    } else if (!v.paused) {
      // 已经在播放
      handleVideoPlay(v);
    }
  }

  function scan() {
    listVideos().forEach(bindVideo);
  }

  // MutationObserver 监听 DOM 变化, 捕获 SPA 注入的 <video>
  const mo = new MutationObserver((muts) => {
    let shouldScan = false;
    for (const m of muts) {
      if (m.type === 'childList' && (m.addedNodes && m.addedNodes.length)) {
        for (const n of m.addedNodes) {
          if (!(n instanceof Element)) continue;
          if (n.tagName === 'VIDEO' || n.querySelector?.('video')) { shouldScan = true; break; }
        }
      }
      if (shouldScan) break;
    }
    if (shouldScan) scan();
  });

  function start() {
    scan();
    try {
      mo.observe(document.documentElement || document, { childList: true, subtree: true });
    } catch {}
    setInterval(scan, SCAN_INTERVAL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  // ---------- 与 background / 其他模块的消息桥 ----------
  try {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg || typeof msg !== 'object') return;
      switch (msg.type) {
        case MSG.TOGGLE_NOTE_PANEL:
          togglePanel();
          sendResponse?.({ ok: true });
          break;
        case MSG.OPEN_NOTE_PANEL:
          openPanel(msg.videoInfo || lastVideoInfo || pickVideoInfo(findBestVideo()));
          sendResponse?.({ ok: true });
          break;
        case MSG.CLOSE_NOTE_PANEL:
          closePanel();
          sendResponse?.({ ok: true });
          break;
      }
      // 同时把消息以自定义事件转发, 让 iframe 编辑器内部脚本可订阅 (postMessage 路径由 iframe 端处理)
      try {
        window.dispatchEvent(new CustomEvent('__aivnt:msg', { detail: msg }));
        if (panelIframe && panelIframe.contentWindow) {
          panelIframe.contentWindow.postMessage({ __aivnt: true, ...msg }, '*');
        }
      } catch {}
    });
  } catch {}

  log('video-detector ready on', getHostname());

})();
