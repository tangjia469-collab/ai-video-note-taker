// @ts-check
// 语音识别封装：基于浏览器 Web Speech API (webkitSpeechRecognition)
// 提供麦克风识别 (VoiceRecognizer) 与标签页音频识别占位 (TabAudioRecognizer)

/**
 * 麦克风实时识别器
 * 用法：new VoiceRecognizer({ lang, continuous, onInterim, onFinal, onError }).start()
 */
export class VoiceRecognizer {
  /**
   * @param {{
   *   lang?: string,
   *   continuous?: boolean,
   *   onInterim?: (text: string) => void,
   *   onFinal?: (text: string) => void,
   *   onError?: (err: { code: string, message: string }) => void
   * }} opts
   */
  constructor(opts = {}) {
    this.lang = opts.lang || 'zh-CN';
    this.continuous = opts.continuous !== false;
    this.onInterim = opts.onInterim || (() => {});
    this.onFinal = opts.onFinal || (() => {});
    this.onError = opts.onError || (() => {});

    /** @type {any} */
    this._recognition = null;
    // 是否已被用户主动 stop（用于决定 onend 后是否自动重启）
    this._userStopped = false;
    // 是否正在运行
    this._running = false;
    // 防止 onend 重启风暴
    this._restartTimer = null;
  }

  /** 启动识别 */
  start() {
    if (this._running) return;

    // @ts-ignore - webkitSpeechRecognition 是浏览器全局
    const SR = typeof window !== 'undefined'
      // @ts-ignore
      ? (window.webkitSpeechRecognition || window.SpeechRecognition)
      : null;

    if (!SR) {
      this.onError({
        code: 'not-supported',
        message: '当前浏览器不支持 Web Speech API（请使用 Chrome/Edge）'
      });
      return;
    }

    this._userStopped = false;
    this._running = true;
    this._createRecognition(SR);

    try {
      this._recognition.start();
    } catch (e) {
      // start() 在已经运行时会抛错，吞掉
      console.warn('[VoiceRecognizer] start error:', e);
    }
  }

  /** 停止识别（用户主动） */
  stop() {
    this._userStopped = true;
    this._running = false;
    if (this._restartTimer) {
      clearTimeout(this._restartTimer);
      this._restartTimer = null;
    }
    if (this._recognition) {
      try {
        this._recognition.stop();
      } catch (e) {
        // ignore
      }
    }
  }

  /** 是否正在运行 */
  isRunning() {
    return this._running;
  }

  /**
   * 创建并配置一个 SpeechRecognition 实例
   * @param {any} SR
   */
  _createRecognition(SR) {
    const rec = new SR();
    rec.lang = this.lang;
    rec.continuous = this.continuous;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (/** @type {any} */ event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (interim) this.onInterim(interim);
      if (final) this.onFinal(final.trim());
    };

    rec.onerror = (/** @type {any} */ event) => {
      const code = event.error || 'unknown';
      const msgMap = {
        'no-speech': '未检测到语音输入',
        'audio-capture': '无法访问麦克风设备',
        'not-allowed': '用户拒绝了麦克风权限',
        'network': '语音识别网络错误',
        'aborted': '识别被中止',
        'language-not-supported': '当前语言不被支持'
      };
      // no-speech 在连续模式下经常发生，浏览器会自动接续，不必中断
      if (code === 'no-speech') {
        // 仅记录，不向上抛
        console.debug('[VoiceRecognizer] no-speech, will continue');
        return;
      }
      this.onError({
        code,
        // @ts-ignore
        message: msgMap[code] || `语音识别错误：${code}`
      });
      // not-allowed / audio-capture 这种致命错误就别再重启了
      if (code === 'not-allowed' || code === 'audio-capture' || code === 'language-not-supported') {
        this._userStopped = true;
        this._running = false;
      }
    };

    rec.onend = () => {
      // 浏览器有时会在连续模式下自动 end，需要重启
      if (this._userStopped || !this.continuous) {
        this._running = false;
        return;
      }
      // 防抖一下避免 CPU 风暴
      this._restartTimer = setTimeout(() => {
        if (this._userStopped) return;
        try {
          rec.start();
        } catch (e) {
          // 如果 rec 已经无法复用，重建一个
          try {
            this._createRecognition(SR);
            this._recognition.start();
          } catch (err) {
            console.warn('[VoiceRecognizer] auto-restart failed:', err);
            this._running = false;
            this.onError({
              code: 'restart-failed',
              message: '语音识别自动重启失败'
            });
          }
        }
      }, 300);
    };

    this._recognition = rec;
  }
}

/**
 * 标签页音频识别（占位实现）
 * 计划：chrome.tabCapture + 离线 ASR 模型（Whisper / Vosk Wasm）
 */
export class TabAudioRecognizer {
  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  constructor(_opts = {}) {
    // 接口与 VoiceRecognizer 保持一致，方便日后无缝替换
  }

  start() {
    throw new Error('TabAudio暂未实现,请用麦克风模式');
  }

  stop() {
    // no-op
  }

  isRunning() {
    return false;
  }
}
