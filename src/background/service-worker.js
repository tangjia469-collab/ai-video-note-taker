// 后台 Service Worker — 消息中转与命令处理
import { MSG } from '../lib/constants.js';
import { getSettings, setSettings } from '../lib/settings.js';
import { ObsidianClient } from '../lib/obsidian-client.js';
import { testGenerate } from '../lib/ai-client.js';

// ---------- 工具函数 ----------

/** 获取当前活动 tab */
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

/** 安全地向某个 tab 发送消息(吞掉 content script 不存在等错误) */
async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    console.warn('[bg] sendToTab failed', tabId, err?.message);
    return { ok: false, error: err?.message || String(err) };
  }
}

// ---------- 消息分发 ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string') return false;

  // 用 IIFE 处理异步,return true 让通道保持开启
  (async () => {
    try {
      switch (msg.type) {
        case MSG.OBS_TEST: {
          // 优先使用消息附带的 settings,否则读取存储
          const settings = msg.settings || (await getSettings());
          const client = new ObsidianClient({
            scheme: settings.obsidianScheme,
            host: settings.obsidianHost,
            port: settings.obsidianPort,
            apiKey: settings.obsidianApiKey
          });
          const result = await client.test();
          sendResponse({ ok: true, result });
          break;
        }

        case MSG.AI_TEST: {
          const settings = msg.settings || (await getSettings());
          const protocol = settings.aiProtocol || 'anthropic';
          const baseURL = settings.aiBaseURL || (protocol === 'anthropic'
            ? 'https://api.anthropic.com'
            : 'https://api.openai.com/v1');
          const apiKey = settings.aiApiKey || settings.anthropicApiKey || '';
          const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(baseURL);
          if (!apiKey && !isLocal) {
            sendResponse({ ok: false, error: '请先填写 API Key' });
            break;
          }
          if (!settings.aiModel) {
            sendResponse({ ok: false, error: '请先选择或填写模型' });
            break;
          }
          const result = await testGenerate({
            protocol,
            baseURL,
            apiKey,
            model: settings.aiModel
          });
          sendResponse(result);
          break;
        }

        case MSG.OPEN_NOTE_PANEL:
        case MSG.CLOSE_NOTE_PANEL:
        case MSG.TOGGLE_NOTE_PANEL: {
          // 如果消息来自 popup/options(没有 tab),需要 query 活动 tab
          let tabId = sender?.tab?.id;
          if (!tabId) {
            const tab = await getActiveTab();
            tabId = tab?.id;
          }
          if (!tabId) {
            sendResponse({ ok: false, error: '没有可用的活动 tab' });
            break;
          }
          const result = await sendToTab(tabId, { type: msg.type, payload: msg.payload });
          sendResponse({ ok: true, result });
          break;
        }

        case MSG.GET_SETTINGS: {
          const settings = await getSettings();
          sendResponse({ ok: true, settings });
          break;
        }

        case MSG.SET_SETTINGS: {
          const next = await setSettings(msg.patch || {});
          sendResponse({ ok: true, settings: next });
          break;
        }

        case MSG.VIDEO_DETECTED: {
          // content script 报告检测到视频,可在此做角标提示
          if (sender?.tab?.id) {
            try {
              await chrome.action.setBadgeText({ tabId: sender.tab.id, text: '●' });
              await chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#3ecf8e' });
            } catch (_) {}
          }
          sendResponse({ ok: true });
          break;
        }

        default:
          // 未识别的消息不处理,让其他监听器有机会响应
          return;
      }
    } catch (err) {
      console.error('[bg] handler error', msg.type, err);
      sendResponse({ ok: false, error: err?.message || String(err) });
    }
  })();

  return true; // 表示将异步响应
});

// ---------- 快捷键命令 ----------

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-note-panel') return;
  const tab = await getActiveTab();
  if (!tab?.id) return;
  await sendToTab(tab.id, { type: MSG.TOGGLE_NOTE_PANEL });
});

// ---------- 安装/更新 ----------

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // 首次安装,打开设置页让用户填 API key
    try {
      await chrome.runtime.openOptionsPage();
    } catch (err) {
      console.warn('[bg] openOptionsPage failed', err);
    }
  }
});
