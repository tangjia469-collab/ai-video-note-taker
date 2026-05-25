// 设置页逻辑
import { MSG, DEFAULT_SETTINGS } from '../lib/constants.js';
import { getSettings, setSettings, resetSettings } from '../lib/settings.js';
import { autoRenderIcons, renderIcon } from '../lib/icons.js';
import { MASCOT_CAT } from '../lib/mascot.js';
import { AI_PROVIDERS, getProvider } from '../lib/providers.js';

const form = document.getElementById('settings-form');
const toast = document.getElementById('toast');

// ---------- 装饰素材 ----------
const hdrMascot = document.getElementById('hdrMascot');
if (hdrMascot) hdrMascot.innerHTML = MASCOT_CAT;
autoRenderIcons();

// ---------- 主题 ----------
(async () => {
  try {
    const s = await getSettings();
    if (s.panelTheme) document.documentElement.setAttribute('data-theme', s.panelTheme);
  } catch (_) {}
})();

// ---------- 供应商下拉填充 ----------
const providerSelect = document.getElementById('aiProvider');
const providerDesc = document.getElementById('providerDesc');
const keyDocsLink = document.getElementById('keyDocsLink');
const aiApiKeyInput = document.getElementById('aiApiKey');
const aiModelSelect = document.getElementById('aiModelSelect');
const aiModelInput = document.getElementById('aiModel');
const aiProtocolSelect = document.getElementById('aiProtocol');
const aiBaseURLInput = document.getElementById('aiBaseURL');

function fillProviderSelect() {
  providerSelect.innerHTML = '';
  for (const p of AI_PROVIDERS) {
    const opt = document.createElement('option');
    opt.value = p.id;
    const tag = (p.tags || []).slice(0, 2).map((t) => `[${t}]`).join('');
    opt.textContent = `${p.name} ${tag}`;
    providerSelect.appendChild(opt);
  }
}
fillProviderSelect();

function fillModelSelect(provider, currentModel) {
  aiModelSelect.innerHTML = '';
  const opts = [...(provider.models || [])];
  if (currentModel && !opts.includes(currentModel)) opts.unshift(currentModel);
  if (opts.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '— 无推荐模型,请在右侧手动填写 —';
    aiModelSelect.appendChild(opt);
    aiModelSelect.disabled = true;
  } else {
    aiModelSelect.disabled = false;
    for (const m of opts) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      aiModelSelect.appendChild(opt);
    }
  }
}

/** 选定供应商时联动其它字段(不覆盖用户已填的 key) */
function applyProvider(providerId, opts = {}) {
  const p = getProvider(providerId);
  providerDesc.textContent = `${p.description}${p.tags ? ' · ' + p.tags.join(' / ') : ''}`;
  if (p.keyDocsUrl) {
    keyDocsLink.href = p.keyDocsUrl;
    keyDocsLink.hidden = false;
  } else {
    keyDocsLink.hidden = true;
  }
  aiApiKeyInput.placeholder = p.keyHint || '';

  // 协议 + baseURL:用户切换供应商时强制刷新成模板值;仅在初始化时若已存自定义则保留
  if (opts.force || !aiProtocolSelect.value) aiProtocolSelect.value = p.protocol;
  if (opts.force || !aiBaseURLInput.value) aiBaseURLInput.value = p.baseURL;

  // 模型下拉重新生成
  const currentModel = opts.preserveModel ? aiModelInput.value : (p.models[0] || '');
  fillModelSelect(p, currentModel);
  if (!opts.preserveModel && p.models[0]) {
    aiModelInput.value = p.models[0];
    aiModelSelect.value = p.models[0];
  } else if (currentModel) {
    aiModelSelect.value = currentModel;
  }
}

providerSelect.addEventListener('change', () => {
  applyProvider(providerSelect.value, { force: true });
});

aiModelSelect.addEventListener('change', () => {
  if (aiModelSelect.value) aiModelInput.value = aiModelSelect.value;
});
aiModelInput.addEventListener('input', () => {
  // 用户手动改 model,下拉同步选中(若匹配)
  const v = aiModelInput.value;
  if ([...aiModelSelect.options].some((o) => o.value === v)) {
    aiModelSelect.value = v;
  }
});

// ---------- 表单 <-> 对象 ----------

function fillForm(settings) {
  for (const [key, value] of Object.entries(settings)) {
    const els = form.querySelectorAll(`[name="${key}"]`);
    if (!els.length) continue;
    const first = els[0];
    if (first.type === 'checkbox') {
      first.checked = !!value;
    } else if (first.type === 'radio') {
      els.forEach((el) => { el.checked = el.value === String(value); });
    } else {
      first.value = value ?? '';
    }
  }
  const widthLabel = document.getElementById('panelWidthValue');
  if (widthLabel) widthLabel.textContent = String(settings.panelWidth);
  if (settings.panelTheme) {
    document.documentElement.setAttribute('data-theme', settings.panelTheme);
  }
  // 供应商联动:保留用户已填的 model + baseURL,但刷新描述/链接/下拉
  providerSelect.value = settings.aiProvider || 'anthropic';
  applyProvider(providerSelect.value, { preserveModel: true });
  // 已存的 model/baseURL 不被覆盖
  if (settings.aiModel) {
    aiModelInput.value = settings.aiModel;
    if ([...aiModelSelect.options].some((o) => o.value === settings.aiModel)) {
      aiModelSelect.value = settings.aiModel;
    }
  }
  if (settings.aiBaseURL) aiBaseURLInput.value = settings.aiBaseURL;
  if (settings.aiProtocol) aiProtocolSelect.value = settings.aiProtocol;
}

function readForm() {
  const data = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const els = form.querySelectorAll(`[name="${key}"]`);
    if (!els.length) continue;
    const first = els[0];
    if (first.type === 'checkbox') {
      data[key] = first.checked;
    } else if (first.type === 'radio') {
      const checked = Array.from(els).find((el) => el.checked);
      if (checked) data[key] = checked.value;
    } else if (first.type === 'number' || first.type === 'range') {
      const n = Number(first.value);
      data[key] = Number.isFinite(n) ? n : DEFAULT_SETTINGS[key];
    } else {
      data[key] = first.value;
    }
  }
  return data;
}

// ---------- Toast ----------

let toastTimer = null;
function showToast(text, kind = 'ok') {
  toast.textContent = text;
  toast.className = `toast show ${kind}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2200);
}

// ---------- 显示/隐藏密码 ----------

document.querySelectorAll('.toggle-eye').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.target;
    const input = document.getElementById(id);
    if (!input) return;
    const iconHost = btn.querySelector('[data-icon]');
    if (input.type === 'password') {
      input.type = 'text';
      if (iconHost) {
        iconHost.setAttribute('data-icon', 'eyeOff');
        renderIcon(iconHost, 'eyeOff', 14);
      }
    } else {
      input.type = 'password';
      if (iconHost) {
        iconHost.setAttribute('data-icon', 'eye');
        renderIcon(iconHost, 'eye', 14);
      }
    }
  });
});

// ---------- 滑块值实时显示 ----------

const widthInput = document.getElementById('panelWidth');
widthInput.addEventListener('input', () => {
  document.getElementById('panelWidthValue').textContent = widthInput.value;
});

// ---------- 主题选择即时预览 ----------

const themeSelect = document.getElementById('panelTheme');
if (themeSelect) {
  themeSelect.addEventListener('change', () => {
    document.documentElement.setAttribute('data-theme', themeSelect.value || 'auto');
  });
}

// ---------- 测试 AI 连接 ----------

const aiTestBtn = document.getElementById('btn-test-ai');
const aiTestResultEl = document.getElementById('ai-test-result');

aiTestBtn.addEventListener('click', async () => {
  aiTestBtn.disabled = true;
  aiTestResultEl.className = 'test-result';
  aiTestResultEl.textContent = '测试中…';

  try {
    const settings = readForm();
    const resp = await chrome.runtime.sendMessage({ type: MSG.AI_TEST, settings });
    if (resp?.ok) {
      aiTestResultEl.className = 'test-result ok';
      const reply = resp.text ? ` · 模型回复"${resp.text.slice(0, 16)}"` : '';
      aiTestResultEl.textContent = `✓ 连接成功${reply}`;
    } else {
      aiTestResultEl.className = 'test-result err';
      aiTestResultEl.textContent = `✗ ${resp?.error || '连接失败'}`;
    }
  } catch (err) {
    aiTestResultEl.className = 'test-result err';
    aiTestResultEl.textContent = `✗ ${err.message || err}`;
  } finally {
    aiTestBtn.disabled = false;
  }
});

// ---------- 测试 Obsidian 连接 ----------

const testBtn = document.getElementById('btn-test-obs');
const testResultEl = document.getElementById('obs-test-result');

testBtn.addEventListener('click', async () => {
  testBtn.disabled = true;
  testResultEl.className = 'test-result';
  testResultEl.textContent = '测试中…';

  try {
    const settings = readForm();
    const resp = await chrome.runtime.sendMessage({ type: MSG.OBS_TEST, settings });
    if (resp?.ok) {
      const r = resp.result || {};
      const version = r.version || r.serviceVersion || r.obsidianVersion || '已连接';
      testResultEl.className = 'test-result ok';
      testResultEl.textContent = `✓ 连接成功 · ${version}`;
    } else {
      testResultEl.className = 'test-result err';
      testResultEl.textContent = `✗ ${resp?.error || '连接失败'}`;
    }
  } catch (err) {
    testResultEl.className = 'test-result err';
    testResultEl.textContent = `✗ ${err.message || err}`;
  } finally {
    testBtn.disabled = false;
  }
});

// ---------- 保存 / 恢复默认 ----------

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = readForm();
    await setSettings(data);
    showToast('已保存', 'ok');
  } catch (err) {
    showToast(`保存失败: ${err.message}`, 'err');
  }
});

document.getElementById('btn-reset').addEventListener('click', async () => {
  if (!confirm('确定要恢复所有设置为默认值吗?(API key 也会被清空)')) return;
  try {
    const fresh = await resetSettings();
    fillForm(fresh);
    showToast('已恢复默认', 'ok');
  } catch (err) {
    showToast(`恢复失败: ${err.message}`, 'err');
  }
});

// ---------- 初始化 ----------

(async function init() {
  try {
    const settings = await getSettings();
    fillForm(settings);
  } catch (err) {
    console.error('[options] load failed', err);
    fillForm(DEFAULT_SETTINGS);
    showToast(`加载失败: ${err.message}`, 'err');
  }
})();
