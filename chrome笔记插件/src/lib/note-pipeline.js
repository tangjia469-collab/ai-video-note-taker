// @ts-check
// 笔记流水线：语音识别 -> 累积 buffer -> 定时/达量喂给 Claude -> 流式 markdown 输出
// 协调 VoiceRecognizer + Anthropic streamGenerate

import { VoiceRecognizer, TabAudioRecognizer } from './voice-recognizer.js';
import { streamGenerate } from './ai-client.js';
import { buildSegmentPrompt } from './prompts.js';

const FLUSH_CHAR_THRESHOLD = 500; // buffer 累计到 ~500 字也触发一次

/**
 * @typedef {{
 *   id: string,
 *   raw: string,
 *   markdown: string,
 *   timestamp: number
 * }} SegmentSummary
 */

export class NotePipeline {
  /**
   * @param {{
   *   settings: any,
   *   onMarkdownChunk?: (chunk: string, segmentId: string) => void,
   *   onSegmentSummary?: (seg: SegmentSummary) => void,
   *   onTranscript?: (rawText: string, kind: 'final' | 'interim') => void,
   *   onError?: (err: Error) => void,
   *   onStateChange?: (state: 'idle' | 'listening' | 'paused' | 'generating') => void
   * }} opts
   */
  constructor(opts) {
    this.settings = opts.settings;
    this.onMarkdownChunk = opts.onMarkdownChunk || (() => {});
    this.onSegmentSummary = opts.onSegmentSummary || (() => {});
    this.onTranscript = opts.onTranscript || (() => {});
    this.onError = opts.onError || (() => {});
    this.onStateChange = opts.onStateChange || (() => {});

    /** @type {VoiceRecognizer | TabAudioRecognizer | null} */
    this._recognizer = null;
    /** @type {string[]} */
    this._buffer = [];
    // 已经整理好的所有 markdown，作为上下文喂回给 Claude
    this._accumulatedMarkdown = '';
    /** @type {ReturnType<typeof setInterval> | null} */
    this._flushTimer = null;
    /** @type {AbortController | null} */
    this._currentAbort = null;
    this._running = false;
    this._paused = false;
    this._generating = false;
    // 防止并发 flush
    this._flushing = false;
  }

  /** 启动整条流水线 */
  start() {
    if (this._running) return;
    this._running = true;
    this._paused = false;

    const source = this.settings?.voiceSource || 'mic';
    const RecognizerCtor = source === 'tab' ? TabAudioRecognizer : VoiceRecognizer;

    this._recognizer = new RecognizerCtor({
      lang: this.settings?.voiceLang || 'zh-CN',
      continuous: this.settings?.voiceContinuous !== false,
      onInterim: (text) => {
        if (!this._paused) this.onTranscript(text, 'interim');
      },
      onFinal: (text) => {
        if (this._paused) return;
        if (!text) return;
        this._buffer.push(text);
        this.onTranscript(text, 'final');
        // 达到字符阈值就立即冲刷一次
        const totalChars = this._bufferedChars();
        if (totalChars >= FLUSH_CHAR_THRESHOLD) {
          this.flush().catch((e) => this.onError(/** @type {Error} */ (e)));
        }
      },
      onError: (err) => {
        this.onError(new Error(`[语音] ${err.message} (${err.code})`));
      }
    });

    try {
      this._recognizer.start();
    } catch (e) {
      this.onError(/** @type {Error} */ (e));
      this._running = false;
      this._setState();
      return;
    }

    // 定时冲刷
    const sec = Math.max(5, Number(this.settings?.aiBatchSeconds) || 30);
    this._flushTimer = setInterval(() => {
      if (this._paused) return;
      this.flush().catch((e) => this.onError(/** @type {Error} */ (e)));
    }, sec * 1000);

    this._setState();
  }

  /** 停止整条流水线 */
  async stop() {
    if (!this._running) return;
    this._running = false;
    this._paused = false;

    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }

    if (this._recognizer) {
      try { this._recognizer.stop(); } catch (_) { /* ignore */ }
      this._recognizer = null;
    }

    // 把残留的 buffer 整理掉
    try {
      await this.flush();
    } catch (e) {
      this.onError(/** @type {Error} */ (e));
    }

    // 中止任何正在跑的 AI 请求
    if (this._currentAbort) {
      try { this._currentAbort.abort(); } catch (_) { /* ignore */ }
      this._currentAbort = null;
    }

    this._setState();
  }

  /** 暂停：保留识别但不再输出/累积，AI 也不再触发 */
  pause() {
    if (!this._running || this._paused) return;
    this._paused = true;
    // 直接停掉识别器，避免后台一直跑
    if (this._recognizer) {
      try { this._recognizer.stop(); } catch (_) { /* ignore */ }
    }
    this._setState();
  }

  /** 恢复 */
  resume() {
    if (!this._running || !this._paused) return;
    this._paused = false;
    if (this._recognizer) {
      try { this._recognizer.start(); } catch (_) { /* ignore */ }
    }
    this._setState();
  }

  /**
   * 立即把 buffer 喂给 Claude（外部也可以调用）
   * 返回 Promise，AI 流式完成时 resolve
   */
  async flush() {
    if (this._flushing) return;
    if (this._buffer.length === 0) return;

    const apiKey = this.settings?.aiApiKey || this.settings?.anthropicApiKey;
    const protocol = this.settings?.aiProtocol || 'anthropic';
    const baseURL = this.settings?.aiBaseURL || (protocol === 'anthropic'
      ? 'https://api.anthropic.com'
      : 'https://api.openai.com/v1');
    // Ollama 等本地服务可不需要 key
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(baseURL);
    if (!apiKey && !isLocal) {
      this.onError(new Error('请先在设置中填写 AI API Key'));
      return;
    }

    this._flushing = true;
    const raw = this._buffer.join(' ').trim();
    this._buffer = [];

    const segmentId = `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { system: builtSystem, user } = buildSegmentPrompt(raw, this._accumulatedMarkdown);
    // 用户在设置里自定义的 prompt 优先；否则用 buildSegmentPrompt 里的强约束 system
    const userPrompt = (this.settings?.aiPrompt || '').trim();
    const system = userPrompt ? `${userPrompt}\n\n${builtSystem}` : builtSystem;

    let markdown = '';
    this._currentAbort = new AbortController();
    this._generating = true;
    this._setState();

    await new Promise((resolve) => {
      streamGenerate({
        protocol,
        baseURL,
        apiKey,
        model: this.settings?.aiModel || 'claude-sonnet-4-6',
        system,
        userText: user,
        signal: this._currentAbort?.signal,
        onChunk: (chunk) => {
          markdown += chunk;
          this.onMarkdownChunk(chunk, segmentId);
        },
        onDone: (full) => {
          markdown = full || markdown;
          if (markdown.trim()) {
            this._accumulatedMarkdown += (this._accumulatedMarkdown ? '\n\n' : '') + markdown.trim();
            this.onSegmentSummary({
              id: segmentId,
              raw,
              markdown: markdown.trim(),
              timestamp: Date.now()
            });
          }
          resolve(undefined);
        },
        onError: (err) => {
          this.onError(err);
          resolve(undefined);
        }
      });
    });

    this._generating = false;
    this._currentAbort = null;
    this._flushing = false;
    this._setState();
  }

  /** 当前是否在跑 */
  isRunning() {
    return this._running;
  }

  /** 当前是否暂停 */
  isPaused() {
    return this._paused;
  }

  /** buffer 当前字符数 */
  _bufferedChars() {
    let n = 0;
    for (const s of this._buffer) n += s.length;
    return n;
  }

  _setState() {
    if (!this._running) {
      this.onStateChange('idle');
    } else if (this._paused) {
      this.onStateChange('paused');
    } else if (this._generating) {
      this.onStateChange('generating');
    } else {
      this.onStateChange('listening');
    }
  }
}
