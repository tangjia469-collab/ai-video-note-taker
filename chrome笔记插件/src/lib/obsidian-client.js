// Obsidian Local REST API HTTP 客户端
// 文档: https://github.com/coddingtonbear/obsidian-local-rest-api
// 默认端口: 27124 (HTTPS, 自签名证书) / 27123 (HTTP)

/**
 * 把路径每一段做 URL 编码,但保留 "/" 分隔符
 * Obsidian 路径可能包含中文,fetch URL 必须 percent-encode
 */
function encodeVaultPath(path) {
  return path
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

export class ObsidianClient {
  constructor({ scheme = 'https', host = '127.0.0.1', port = 27124, apiKey = '' } = {}) {
    this.scheme = scheme;
    this.host = host;
    this.port = port;
    this.apiKey = apiKey;
  }

  // 完整 URL 构造,例如 https://127.0.0.1:27124/vault/foo/bar.md
  _url(pathname) {
    const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return `${this.scheme}://${this.host}:${this.port}${normalized}`;
  }

  // 公共请求头(Bearer token + 可选 content-type)
  _headers(extra = {}) {
    const h = { ...extra };
    if (this.apiKey) h['Authorization'] = `Bearer ${this.apiKey}`;
    return h;
  }

  // 统一处理响应,4xx/5xx 抛带 status / message 的 Error
  async _request(method, pathname, { headers = {}, body } = {}) {
    let res;
    try {
      res = await fetch(this._url(pathname), {
        method,
        headers: this._headers(headers),
        body
      });
    } catch (e) {
      const err = new Error(`网络错误: ${e.message || e}`);
      err.cause = e;
      throw err;
    }
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const text = await res.text();
        if (text) msg = text;
      } catch (_) {}
      const err = new Error(`Obsidian API ${res.status}: ${msg}`);
      err.status = res.status;
      err.message_text = msg;
      throw err;
    }
    return res;
  }

  // 测试连接 - GET / 返回服务信息(authenticated/unauthenticated)
  async test() {
    try {
      const res = await this._request('GET', '/');
      const info = await res.json().catch(() => ({}));
      return { ok: true, info };
    } catch (e) {
      return { ok: false, error: e.message || String(e), status: e.status };
    }
  }

  // 列出指定文件夹内容; folder 可空表示 vault 根
  async listFolder(folder = '') {
    const p = folder ? `/vault/${encodeVaultPath(folder)}/` : '/vault/';
    const res = await this._request('GET', p);
    const data = await res.json().catch(() => ({}));
    // API 返回 { files: [...] }
    return Array.isArray(data?.files) ? data.files : [];
  }

  // 读文件内容
  async readNote(path) {
    const res = await this._request('GET', `/vault/${encodeVaultPath(path)}`);
    return await res.text();
  }

  // 创建/覆盖文件
  async createNote(path, markdown) {
    await this._request('PUT', `/vault/${encodeVaultPath(path)}`, {
      headers: { 'Content-Type': 'text/markdown' },
      body: markdown ?? ''
    });
    return true;
  }

  // 追加内容到文件末尾
  async appendNote(path, markdown) {
    await this._request('POST', `/vault/${encodeVaultPath(path)}`, {
      headers: { 'Content-Type': 'text/markdown' },
      body: markdown ?? ''
    });
    return true;
  }

  // 在指定 heading 之下/之前插入内容
  // opts: { heading: '标题名', content: '...', position: 'append'|'prepend' }
  async patchInsert(path, { heading, content, position = 'append' } = {}) {
    if (!heading) throw new Error('patchInsert 需要 heading');
    await this._request('PATCH', `/vault/${encodeVaultPath(path)}`, {
      headers: {
        'Content-Type': 'text/markdown',
        Operation: position, // append | prepend | replace
        'Target-Type': 'heading',
        Target: encodeURIComponent(heading)
      },
      body: content ?? ''
    });
    return true;
  }
}
