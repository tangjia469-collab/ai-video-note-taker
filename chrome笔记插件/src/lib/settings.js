// Settings storage helper
import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants.js';

/**
 * 把旧版字段迁移到新结构
 * 旧 anthropicApiKey -> aiApiKey(若 aiApiKey 为空)
 * 并补齐新字段默认值
 */
function migrate(stored) {
  const next = { ...stored };
  if (!next.aiApiKey && next.anthropicApiKey) {
    next.aiApiKey = next.anthropicApiKey;
  }
  if (!next.aiProvider) next.aiProvider = 'anthropic';
  if (!next.aiProtocol) {
    // 旧用户没填过协议,根据已有模型判断
    next.aiProtocol = (next.aiModel || '').startsWith('claude') ? 'anthropic' : 'openai';
  }
  if (!next.aiBaseURL) {
    next.aiBaseURL = next.aiProtocol === 'anthropic'
      ? 'https://api.anthropic.com'
      : 'https://api.openai.com/v1';
  }
  return next;
}

export async function getSettings() {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
  const stored = result[STORAGE_KEYS.SETTINGS] || {};
  return migrate({ ...DEFAULT_SETTINGS, ...stored });
}

export async function setSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: next });
  return next;
}

export async function resetSettings() {
  await chrome.storage.sync.remove(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS };
}

export function onSettingsChanged(cb) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes[STORAGE_KEYS.SETTINGS]) {
      cb(changes[STORAGE_KEYS.SETTINGS].newValue || DEFAULT_SETTINGS);
    }
  });
}
