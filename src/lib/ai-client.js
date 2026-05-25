// @ts-check
// 统一 AI 客户端 — 支持 Anthropic 协议 + OpenAI 兼容协议
// 用户自带 key 本地使用,Anthropic 走 dangerous-direct-browser-access
// OpenAI 兼容(国内大多数厂商 / Ollama / OpenRouter / 自定义)直接 fetch

const ANTHROPIC_API_VERSION = '2023-06-01';

/**
 * @typedef {{
 *   protocol: 'anthropic' | 'openai',
 *   baseURL: string,
 *   apiKey: string,
 *   model: string,
 *   system: string,
 *   userText: string,
 *   onChunk?: (text: string) => void,
 *   onDone?: (fullText: string) => void,
 *   onError?: (err: Error) => void,
 *   signal?: AbortSignal,
 *   maxTokens?: number
 * }} StreamOptions
 */

/**
 * 流式生成 — 根据 protocol 派发到对应实现
 * @param {StreamOptions} opts
 */
export async function streamGenerate(opts) {
  const protocol = opts.protocol || 'anthropic';
  if (protocol === 'anthropic') return _streamAnthropic(opts);
  return _streamOpenAI(opts);
}

/**
 * 非流式快速测试 — 让模型说一句简短回应,用于验证 key/baseURL/model 正确性
 * @param {Omit<StreamOptions, 'onChunk' | 'onDone' | 'onError' | 'system' | 'userText'> & {
 *   system?: string, userText?: string
 * }} opts
 * @returns {Promise<{ ok: true, text: string, model: string } | { ok: false, error: string }>}
 */
export async function testGenerate(opts) {
  return new Promise((resolve) => {
    let buf = '';
    streamGenerate({
      ...opts,
      system: opts.system || '你是一个助手。',
      userText: opts.userText || '回复"OK"两个字符,不要其它内容。',
      maxTokens: 32,
      onChunk: (t) => { buf += t; },
      onDone: (full) => resolve({ ok: true, text: (full || buf).trim() || 'OK', model: opts.model }),
      onError: (err) => resolve({ ok: false, error: err.message || String(err) })
    });
  });
}

// ---------- Anthropic 协议 ----------

/** @param {StreamOptions} p */
async function _streamAnthropic({
  baseURL,
  apiKey,
  model,
  system,
  userText,
  onChunk = () => {},
  onDone = () => {},
  onError = () => {},
  signal,
  maxTokens = 4096
}) {
  if (!apiKey) {
    onError(new Error('未配置 API Key'));
    return;
  }
  const url = `${(baseURL || 'https://api.anthropic.com').replace(/\/+$/, '')}/v1/messages`;

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        system,
        messages: [{ role: 'user', content: userText }]
      })
    });
  } catch (e) {
    onError(/** @type {Error} */ (e));
    return;
  }

  if (!resp.ok || !resp.body) {
    let detail = '';
    try { detail = await resp.text(); } catch (_) {}
    onError(new Error(`Anthropic API ${resp.status}: ${detail.slice(0, 500)}`));
    return;
  }

  await _consumeSSE(resp.body, signal, onChunk, onDone, onError, (json, evType) => {
    if (evType === 'content_block_delta') {
      return { chunk: json?.delta?.text || '' };
    }
    if (evType === 'message_stop') return { stop: true };
    if (evType === 'error') {
      const msg = json?.error?.message || JSON.stringify(json);
      throw new Error(`Anthropic stream error: ${msg}`);
    }
    return {};
  });
}

// ---------- OpenAI 兼容协议 ----------

/** @param {StreamOptions} p */
async function _streamOpenAI({
  baseURL,
  apiKey,
  model,
  system,
  userText,
  onChunk = () => {},
  onDone = () => {},
  onError = () => {},
  signal,
  maxTokens = 4096
}) {
  if (!baseURL) {
    onError(new Error('未配置 baseURL'));
    return;
  }
  const url = `${baseURL.replace(/\/+$/, '')}/chat/completions`;
  /** @type {Record<string, string>} */
  const headers = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      signal,
      headers,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userText }
        ]
      })
    });
  } catch (e) {
    onError(/** @type {Error} */ (e));
    return;
  }

  if (!resp.ok || !resp.body) {
    let detail = '';
    try { detail = await resp.text(); } catch (_) {}
    onError(new Error(`AI API ${resp.status}: ${detail.slice(0, 500)}`));
    return;
  }

  await _consumeSSE(resp.body, signal, onChunk, onDone, onError, (json, _evType, rawData) => {
    if (rawData === '[DONE]') return { stop: true };
    const choice = json?.choices?.[0];
    if (!choice) return {};
    const delta = choice.delta?.content || choice.message?.content || '';
    return {
      chunk: delta,
      stop: !!choice.finish_reason
    };
  });
}

// ---------- 共用 SSE 消费器 ----------

/**
 * 通用 SSE 消费 — 统一处理切片、累积 fullText、错误兜底
 * @param {ReadableStream<Uint8Array>} body
 * @param {AbortSignal | undefined} signal
 * @param {(t: string) => void} onChunk
 * @param {(t: string) => void} onDone
 * @param {(e: Error) => void} onError
 * @param {(json: any, evType: string, rawData: string) => { chunk?: string, stop?: boolean }} handler
 */
async function _consumeSSE(body, signal, onChunk, onDone, onError, handler) {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIdx;
      while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);

        const parsed = _parseSSEBlock(rawEvent);
        if (!parsed) continue;
        const { event, data } = parsed;
        if (!data) continue;

        // OpenAI 风格的终止标记
        if (data === '[DONE]') {
          onDone(fullText);
          return;
        }

        let json;
        try { json = JSON.parse(data); } catch (_) { continue; }

        let result;
        try {
          result = handler(json, event || json.type || '', data);
        } catch (e) {
          onError(/** @type {Error} */ (e));
          return;
        }

        if (result?.chunk) {
          fullText += result.chunk;
          onChunk(result.chunk);
        }
        if (result?.stop) {
          onDone(fullText);
          return;
        }
      }
    }
    onDone(fullText);
  } catch (e) {
    if (signal?.aborted) return;
    onError(/** @type {Error} */ (e));
  } finally {
    try { reader.releaseLock(); } catch (_) {}
  }
}

/**
 * 解析单个 SSE 块
 * @param {string} block
 */
function _parseSSEBlock(block) {
  let event = '';
  /** @type {string[]} */
  const dataLines = [];
  const lines = block.split('\n');
  for (const line of lines) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!event && dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}
