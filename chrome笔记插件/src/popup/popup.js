// 工具栏 popup 逻辑
import { MSG } from '../lib/constants.js';
import { getSettings } from '../lib/settings.js';
import { autoRenderIcons } from '../lib/icons.js';
import { MASCOT_LOGO, MASCOT_CAT } from '../lib/mascot.js';

const $ = (id) => document.getElementById(id);

// ---------- 装饰素材 ----------
$('brandLogo').innerHTML = MASCOT_LOGO;
$('popupMascot').innerHTML = MASCOT_CAT;
autoRenderIcons();

// ---------- 主题 ----------
(async () => {
  try {
    const s = await getSettings();
    if (s.panelTheme) document.documentElement.setAttribute('data-theme', s.panelTheme);
  } catch (_) {}
})();

// ---------- 版本号 ----------
const manifest = chrome.runtime.getManifest();
$('version').textContent = manifest.version;

// ---------- 配置状态 ----------

async function refreshConfigStatus() {
  try {
    const settings = await getSettings();

    const aiOk = !!(settings.aiApiKey || settings.anthropicApiKey)?.trim();
    const aiDot = $('ai-dot');
    const aiState = $('ai-state');
    aiDot.classList.toggle('ok', aiOk);
    aiDot.classList.toggle('err', !aiOk);
    aiState.classList.toggle('ok', aiOk);
    aiState.classList.toggle('err', !aiOk);
    aiState.textContent = aiOk ? '已配置' : '未配置';

    const obsOk = !!settings.obsidianApiKey?.trim();
    const obsDot = $('obs-dot');
    const obsState = $('obs-state');
    obsDot.classList.toggle('ok', obsOk);
    obsDot.classList.toggle('err', !obsOk);
    obsState.classList.toggle('ok', obsOk);
    obsState.classList.toggle('err', !obsOk);
    obsState.textContent = obsOk ? '已配置' : '未配置';
  } catch (err) {
    console.error('[popup] 读取设置失败', err);
  }
}

// ---------- 视频检测 ----------

async function refreshVideoStatus() {
  const dot = $('video-dot');
  const text = $('video-text');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      dot.className = 'dot';
      text.textContent = '无活动标签页';
      return;
    }
    // 询问 content script 当前页是否有视频
    let resp;
    try {
      resp = await chrome.tabs.sendMessage(tab.id, { type: MSG.VIDEO_DETECTED });
    } catch (_) {
      resp = null;
    }

    if (resp?.hasVideo) {
      dot.className = 'dot ok';
      text.textContent = `检测到视频${resp.count ? ` (${resp.count})` : ''}`;
    } else if (resp) {
      dot.className = 'dot warn';
      text.textContent = '未检测到视频';
    } else {
      dot.className = 'dot';
      text.textContent = '此页面不支持检测';
    }
  } catch (err) {
    dot.className = 'dot err';
    text.textContent = '检测失败';
    console.warn('[popup] video status', err);
  }
}

// ---------- 打开笔记面板 ----------

$('btn-open').addEventListener('click', async () => {
  const btn = $('btn-open');
  btn.disabled = true;
  try {
    await chrome.runtime.sendMessage({ type: MSG.OPEN_NOTE_PANEL });
    window.close();
  } catch (err) {
    console.error('[popup] open panel failed', err);
    btn.disabled = false;
  }
});

// ---------- 打开设置 ----------

$('link-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
  window.close();
});

// ---------- 初始化 ----------

refreshConfigStatus();
refreshVideoStatus();
