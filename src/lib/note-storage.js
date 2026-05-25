// Obsidian 笔记会话:封装一次"录制 -> 写入"的生命周期
// 提供 ensureCreated / appendMarkdown(节流) / overwrite / flush
// 失败时把内容缓存到 chrome.storage.local 队列,下次重试

const RETRY_QUEUE_KEY = 'aivnt:obsidianRetryQueue';
const APPEND_DEBOUNCE_MS = 1500;

// 把字符串 slug 化为合法的 Obsidian/文件系统文件名
function slugTitle(title) {
  if (!title) return 'untitled';
  return String(title)
    // 去掉 Windows 非法字符 / \ : * ? " < > |
    .replace(/[\\/:*?"<>|]/g, ' ')
    // 折叠多空白
    .replace(/\s+/g, ' ')
    .trim()
    // 限制长度防止文件名过长
    .slice(0, 80) || 'untitled';
}

// 当前日期 YYYY-MM-DD(本地时区)
function todayDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 把模板替换为实际的 {date}/{title}
function applyTemplate(tpl, vars) {
  return String(tpl || '{date}-{title}').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// 生成 frontmatter
function buildFrontmatter({ title, videoUrl }) {
  const created = new Date().toISOString();
  const safeTitle = (title || '').replace(/"/g, '\\"');
  return [
    '---',
    `title: "${safeTitle}"`,
    `source: ${videoUrl || ''}`,
    `created: ${created}`,
    'tags: [ai-video-note]',
    '---',
    '',
    ''
  ].join('\n');
}

export class NoteSession {
  /**
   * @param {object} opts
   * @param {import('./obsidian-client.js').ObsidianClient} opts.client
   * @param {string} opts.folder    - vault 内的目标文件夹
   * @param {string} opts.title     - 笔记标题
   * @param {string} opts.videoUrl  - 来源视频 URL
   * @param {string} opts.filenameTemplate - 文件名模板
   */
  constructor({ client, folder, title, videoUrl, filenameTemplate }) {
    this.client = client;
    this.folder = folder || '';
    this.title = title || '未命名';
    this.videoUrl = videoUrl || '';
    this.filenameTemplate = filenameTemplate || '{date}-{title}';

    this.filePath = null;       // 创建后填充
    this.created = false;
    this._appendBuffer = '';    // 待写入缓冲
    this._appendTimer = null;   // debounce 定时器
    this._flushPromise = null;  // 当前刷新 promise
  }

  // 第一次调用时根据 title+date 生成文件路径并写入 frontmatter
  async ensureCreated() {
    if (this.created && this.filePath) return this.filePath;

    const filename = applyTemplate(this.filenameTemplate, {
      date: todayDate(),
      title: slugTitle(this.title)
    });
    const safeName = slugTitle(filename); // 进一步保证文件名安全
    const filePath = this.folder
      ? `${this.folder}/${safeName}.md`
      : `${safeName}.md`;

    const initial = buildFrontmatter({ title: this.title, videoUrl: this.videoUrl });
    try {
      await this.client.createNote(filePath, initial);
      this.filePath = filePath;
      this.created = true;
    } catch (e) {
      // 创建失败先把要写入的内容塞进重试队列
      await this._enqueueRetry({ op: 'create', path: filePath, body: initial });
      this.filePath = filePath;
      this.created = false;
      throw e;
    }
    return this.filePath;
  }

  // 追加 markdown(节流合并)
  async appendMarkdown(md) {
    if (!md) return;
    this._appendBuffer += (this._appendBuffer.endsWith('\n') ? '' : '\n') + md;
    if (this._appendTimer) clearTimeout(this._appendTimer);
    this._appendTimer = setTimeout(() => {
      this._flushAppend().catch(() => {/* 已进重试队列 */});
    }, APPEND_DEBOUNCE_MS);
  }

  // 把缓冲区一次性 POST 出去
  async _flushAppend() {
    if (!this._appendBuffer) return;
    if (!this.filePath) {
      try { await this.ensureCreated(); } catch (_) { /* 失败也继续走队列 */ }
    }
    const payload = this._appendBuffer;
    this._appendBuffer = '';
    if (!this.filePath) {
      await this._enqueueRetry({ op: 'append', path: null, body: payload });
      return;
    }
    try {
      await this.client.appendNote(this.filePath, '\n' + payload);
    } catch (e) {
      await this._enqueueRetry({ op: 'append', path: this.filePath, body: payload });
    }
  }

  // 用整篇内容覆盖文件
  async overwrite(fullMarkdown) {
    if (!this.filePath) {
      // 没有 filePath 就先创建,再写入
      await this.ensureCreated().catch(() => {});
    }
    if (!this.filePath) {
      await this._enqueueRetry({ op: 'overwrite', path: null, body: fullMarkdown });
      return;
    }
    try {
      await this.client.createNote(this.filePath, fullMarkdown);
    } catch (e) {
      await this._enqueueRetry({ op: 'overwrite', path: this.filePath, body: fullMarkdown });
    }
  }

  // 立即把所有挂起的内容写入
  async flush() {
    if (this._appendTimer) {
      clearTimeout(this._appendTimer);
      this._appendTimer = null;
    }
    await this._flushAppend();
    await this.retryPending();
  }

  // ---- 失败重试队列 ----

  async _enqueueRetry(item) {
    try {
      const cur = await chrome.storage.local.get(RETRY_QUEUE_KEY);
      const queue = cur[RETRY_QUEUE_KEY] || [];
      queue.push({ ...item, ts: Date.now() });
      await chrome.storage.local.set({ [RETRY_QUEUE_KEY]: queue });
    } catch (_) { /* 存储失败就算了 */ }
  }

  // 尝试重放队列(由 flush 或定期触发)
  async retryPending() {
    let queue = [];
    try {
      const cur = await chrome.storage.local.get(RETRY_QUEUE_KEY);
      queue = cur[RETRY_QUEUE_KEY] || [];
    } catch (_) { return; }
    if (!queue.length) return;

    const remaining = [];
    for (const item of queue) {
      try {
        const path = item.path || this.filePath;
        if (!path) { remaining.push(item); continue; }
        if (item.op === 'create' || item.op === 'overwrite') {
          await this.client.createNote(path, item.body);
        } else if (item.op === 'append') {
          await this.client.appendNote(path, '\n' + item.body);
        }
      } catch (_) {
        remaining.push(item);
      }
    }
    try {
      await chrome.storage.local.set({ [RETRY_QUEUE_KEY]: remaining });
    } catch (_) {}
  }
}
