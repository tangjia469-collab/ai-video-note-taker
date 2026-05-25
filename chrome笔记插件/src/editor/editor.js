// AI 视频笔记编辑器主逻辑
import { getSettings } from '../lib/settings.js';
import { ObsidianClient } from '../lib/obsidian-client.js';
import { NoteSession } from '../lib/note-storage.js';
import { renderMarkdown } from '../lib/mini-md.js';
import { autoRenderIcons, icon } from '../lib/icons.js';
import { MASCOT_LOGO, MASCOT_EMPTY } from '../lib/mascot.js';

// NotePipeline 由其他模块提供;这里做一次软导入以便不存在时编辑器仍可调试运行
let NotePipeline = null;
try {
  ({ NotePipeline } = await import('../lib/note-pipeline.js').catch(() => ({})));
} catch (_) { /* 允许缺失 */ }

// ---- DOM 引用 ----
const $ = (id) => document.getElementById(id);
const els = {
  brandLogo: $('brandLogo'),
  title: $('noteTitle'),
  statusPill: $('statusPill'),
  statusIcon: $('statusIcon'),
  statusText: $('statusText'),
  btnRecord: $('btnRecord'),
  recIcon: document.querySelector('#btnRecord .rec-icon'),
  recLabel: document.querySelector('#btnRecord .rec-label'),
  btnSave: $('btnSave'),
  btnFullscreen: $('btnFullscreen'),
  btnSettings: $('btnSettings'),
  editor: $('editor'),
  preview: $('preview'),
  transcript: $('transcript'),
  aiStatus: $('aiStatus'),
  aiStatusText: document.querySelector('#aiStatus .ai-status-text'),
  emptyOverlay: $('emptyOverlay'),
  emptyMascot: $('emptyMascot'),
  waveIndicator: $('waveIndicator')
};

// ---- 注入 mascot + 自动渲染图标 ----
els.brandLogo.innerHTML = MASCOT_LOGO;
els.emptyMascot.innerHTML = MASCOT_EMPTY;
autoRenderIcons();

// ---- 主题应用 ----
(async () => {
  try {
    const s = await getSettings();
    if (s.panelTheme) document.documentElement.setAttribute('data-theme', s.panelTheme);
  } catch (_) {}
})();

// ---- 从 URL 读视频信息 ----
const params = new URLSearchParams(location.search);
const videoInfo = {
  title: params.get('title') || '未命名视频',
  url: params.get('url') || '',
  duration: Number(params.get('duration') || 0)
};

// ---- 编辑器状态 ----
const state = {
  aiCursor: 0,
  recording: false,
  pipeline: null,
  session: null,
  saveTimer: null,
  initialEnd: 0
};

// ---- 状态展示 ----
function setStatus(kind, text) {
  // kind: idle | recording | ai | ok | error
  els.statusPill.dataset.state = kind === 'idle' ? '' : kind;
  els.statusText.textContent = text;
  // 状态点
  let dotCls = 'dot';
  if (kind === 'recording') dotCls = 'dot live';
  else if (kind === 'ai') dotCls = 'dot ai';
  else if (kind === 'ok') dotCls = 'dot ok';
  else if (kind === 'error') dotCls = 'dot err';
  els.statusIcon.innerHTML = `<span class="${dotCls}"></span>`;
}

function setAiStatus(text, kind = '') {
  els.aiStatus.classList.remove('error', 'ok', 'working');
  if (kind) els.aiStatus.classList.add(kind === 'error' ? 'error' : kind);
  if (els.aiStatusText) els.aiStatusText.textContent = text || '就绪';
}

function updateEmptyOverlay() {
  const userTouched = els.editor.value !== state._initialContent;
  els.emptyOverlay.classList.toggle('hidden', userTouched || state.recording);
}

// ---- 初始内容 ----
function buildInitialContent() {
  const created = new Date().toISOString();
  return [
    '---',
    `title: "${(videoInfo.title || '').replace(/"/g, '\\"')}"`,
    `source: ${videoInfo.url}`,
    `created: ${created}`,
    'tags: [ai-video-note]',
    '---',
    '',
    `# ${videoInfo.title}`,
    '',
    '## 笔记',
    '',
    ''
  ].join('\n');
}

els.title.value = videoInfo.title;
const initialContent = buildInitialContent();
els.editor.value = initialContent;
state._initialContent = initialContent;
state.aiCursor = els.editor.value.length;
state.initialEnd = state.aiCursor;
renderPreview();
updateEmptyOverlay();
setStatus('idle', '待命');
setAiStatus('就绪');

// ---- 预览渲染(节流) ----
let previewTimer = null;
function renderPreview() {
  if (previewTimer) cancelAnimationFrame(previewTimer);
  previewTimer = requestAnimationFrame(() => {
    els.preview.innerHTML = renderMarkdown(els.editor.value);
  });
}

// ---- 编辑器输入处理 ----
els.editor.addEventListener('input', () => {
  const sel = els.editor.selectionStart;
  if (sel >= state.aiCursor) state.aiCursor = sel;
  if (state.aiCursor > els.editor.value.length) state.aiCursor = els.editor.value.length;
  renderPreview();
  updateEmptyOverlay();
  scheduleSave();
});

// ---- AI 流式插入 ----
function insertAiChunk(chunk) {
  if (!chunk) return;
  const v = els.editor.value;
  const insertAt = Math.min(state.aiCursor, v.length);

  const ss = els.editor.selectionStart;
  const se = els.editor.selectionEnd;

  els.editor.value = v.slice(0, insertAt) + chunk + v.slice(insertAt);
  state.aiCursor = insertAt + chunk.length;

  let newSs = ss;
  let newSe = se;
  if (ss >= insertAt) newSs = ss + chunk.length;
  if (se >= insertAt) newSe = se + chunk.length;
  if (document.activeElement === els.editor) {
    try { els.editor.setSelectionRange(newSs, newSe); } catch (_) {}
  }

  renderPreview();
  updateEmptyOverlay();
  scheduleSave();
}

// ---- 写回 Obsidian(debounce 300ms) ----
function scheduleSave() {
  if (!state.session) return;
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    state.saveTimer = null;
    state.session.overwrite(els.editor.value).catch((e) => {
      setAiStatus('保存失败: ' + (e.message || e), 'error');
    });
  }, 300);
}

els.title.addEventListener('change', () => {
  videoInfo.title = els.title.value || '未命名';
});

// ---- 初始化 NoteSession ----
async function initSession() {
  let settings;
  try { settings = await getSettings(); } catch (_) { return; }

  if (!settings.obsidianApiKey) {
    setAiStatus('未配置 Obsidian', 'error');
    return;
  }

  const client = new ObsidianClient({
    scheme: settings.obsidianScheme,
    host: settings.obsidianHost,
    port: settings.obsidianPort,
    apiKey: settings.obsidianApiKey
  });

  state.session = new NoteSession({
    client,
    folder: settings.obsidianFolder,
    title: videoInfo.title,
    videoUrl: videoInfo.url,
    filenameTemplate: settings.obsidianFilenameTemplate
  });

  try {
    await state.session.ensureCreated();
    setAiStatus('已连接 Obsidian', 'ok');
    state.session.overwrite(els.editor.value).catch(() => {});
  } catch (e) {
    setAiStatus('Obsidian 连接失败', 'error');
    console.error(e);
  }
}
initSession();

// ---- 录音 / AI Pipeline ----
function bindPipelineHandlers(pipeline) {
  pipeline.onTranscript = ({ text, isFinal }) => {
    // 第一次有内容时清空提示文字
    const empty = els.transcript.querySelector('.transcript-empty');
    if (empty) empty.remove();
    const span = document.createElement('span');
    span.className = isFinal ? 'final' : 'interim';
    span.textContent = (isFinal ? '\n' : '') + text + ' ';
    els.transcript.appendChild(span);
    while (els.transcript.childNodes.length > 200) {
      els.transcript.removeChild(els.transcript.firstChild);
    }
    els.transcript.scrollTop = els.transcript.scrollHeight;
  };

  pipeline.onMarkdownChunk = (chunk) => {
    setAiStatus('AI 整理中', 'working');
    setStatus('ai', 'AI 整理中');
    insertAiChunk(chunk);
  };

  pipeline.onAiDone = () => {
    setAiStatus('整理完成', 'ok');
    setStatus(state.recording ? 'recording' : 'idle', state.recording ? '录音中' : '待命');
  };

  pipeline.onSegmentSummary = () => {
    // segments are inserted via onMarkdownChunk; nothing extra here
  };

  pipeline.onError = (err) => {
    setAiStatus('错误: ' + (err?.message || err), 'error');
    setStatus('error', '错误');
  };
}

function setRecordButton(isRecording) {
  if (isRecording) {
    els.btnRecord.classList.add('recording');
    els.recIcon.innerHTML = icon('square', 16);
    els.recLabel.textContent = '停止录音';
    els.waveIndicator.hidden = false;
  } else {
    els.btnRecord.classList.remove('recording');
    els.recIcon.innerHTML = icon('mic', 16);
    els.recLabel.textContent = '开始录音';
    els.waveIndicator.hidden = true;
  }
}

async function startRecording() {
  if (state.recording) return;
  if (!NotePipeline) {
    setAiStatus('AI 模块未加载', 'error');
    return;
  }
  try {
    if (!state.pipeline) {
      const settings = await getSettings();
      state.pipeline = new NotePipeline({ settings, videoInfo });
      bindPipelineHandlers(state.pipeline);
    }
    await state.pipeline.start();
    state.recording = true;
    setRecordButton(true);
    setStatus('recording', '录音中');
    setAiStatus('听着呢…', 'working');
    updateEmptyOverlay();
  } catch (e) {
    setAiStatus('启动失败: ' + (e.message || e), 'error');
    setStatus('error', '错误');
  }
}

async function stopRecording() {
  if (!state.recording) return;
  try { await state.pipeline?.stop(); } catch (_) {}
  state.recording = false;
  setRecordButton(false);
  setStatus('idle', '待命');
  setAiStatus('已停止');
}

els.btnRecord.addEventListener('click', () => {
  if (state.recording) stopRecording();
  else startRecording();
});

// ---- 保存按钮 ----
els.btnSave.addEventListener('click', async () => {
  if (!state.session) {
    setAiStatus('未连接 Obsidian', 'error');
    return;
  }
  setAiStatus('保存中…', 'working');
  try {
    await state.session.overwrite(els.editor.value);
    await state.session.flush();
    setAiStatus('已保存到 Obsidian', 'ok');
  } catch (e) {
    setAiStatus('保存失败', 'error');
  }
});

// ---- 全屏切换 ----
els.btnFullscreen.addEventListener('click', () => {
  const isFull = document.documentElement.classList.toggle('fullscreen');
  els.btnFullscreen.innerHTML = icon(isFull ? 'minimize' : 'maximize', 18);
  try { parent.postMessage({ type: 'panel:toggleFullscreen' }, '*'); } catch (_) {}
});

els.btnSettings.addEventListener('click', () => {
  try { chrome.runtime.openOptionsPage?.(); } catch (_) {}
});

window.addEventListener('message', (ev) => {
  const msg = ev.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'editor:fullscreenState') {
    document.documentElement.classList.toggle('fullscreen', !!msg.on);
    els.btnFullscreen.innerHTML = icon(msg.on ? 'minimize' : 'maximize', 18);
  }
});

window.addEventListener('beforeunload', () => {
  try { state.session?.flush(); } catch (_) {}
});
