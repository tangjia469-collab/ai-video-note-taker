// Shared message types and constants
export const MSG = {
  VIDEO_DETECTED: 'video:detected',
  VIDEO_PLAYING: 'video:playing',
  OPEN_NOTE_PANEL: 'panel:open',
  CLOSE_NOTE_PANEL: 'panel:close',
  TOGGLE_NOTE_PANEL: 'panel:toggle',
  USER_CONSENT: 'user:consent',

  // Voice recognition
  VOICE_START: 'voice:start',
  VOICE_STOP: 'voice:stop',
  VOICE_TRANSCRIPT: 'voice:transcript',
  VOICE_ERROR: 'voice:error',

  // AI generation
  AI_GENERATE: 'ai:generate',
  AI_CHUNK: 'ai:chunk',
  AI_DONE: 'ai:done',
  AI_ERROR: 'ai:error',
  AI_TEST: 'ai:test',

  // Obsidian sync
  OBS_CREATE_NOTE: 'obsidian:create',
  OBS_UPDATE_NOTE: 'obsidian:update',
  OBS_TEST: 'obsidian:test',
  OBS_LIST_VAULTS: 'obsidian:list',

  // Settings
  GET_SETTINGS: 'settings:get',
  SET_SETTINGS: 'settings:set',

  // Editor sync
  EDITOR_USER_EDIT: 'editor:userEdit',
  EDITOR_AI_INSERT: 'editor:aiInsert',
  EDITOR_FULL_CONTENT: 'editor:fullContent'
};

export const STORAGE_KEYS = {
  SETTINGS: 'aivnt:settings',
  CURRENT_NOTE: 'aivnt:currentNote',
  CONSENT_DOMAINS: 'aivnt:consentDomains'
};

export const DEFAULT_SETTINGS = {
  // AI - 多供应商支持
  aiProvider: 'anthropic',                    // providers.js 中的 id
  aiProtocol: 'anthropic',                    // 'anthropic' | 'openai'
  aiBaseURL: 'https://api.anthropic.com',     // 不带尾斜杠,自定义/本地时用户自填
  aiApiKey: '',                               // 当前供应商的 key
  aiModel: 'claude-sonnet-4-6',
  aiBatchSeconds: 30,
  aiPrompt: '你是一个笔记整理助手。把下面这段视频转录文字整理成结构化的中文Markdown笔记，保留要点、概念、举例。仅输出markdown正文，不要寒暄。',

  // 兼容旧版字段(运行时由 settings.js 迁移到 aiApiKey)
  anthropicApiKey: '',

  // Voice
  voiceLang: 'zh-CN',
  voiceContinuous: true,
  voiceSource: 'mic', // 'mic' | 'tab'

  // Obsidian
  obsidianHost: '127.0.0.1',
  obsidianPort: 27124,
  obsidianScheme: 'https',
  obsidianApiKey: '',
  obsidianFolder: 'AI视频笔记',
  obsidianFilenameTemplate: '{date}-{title}',

  // UX
  autoPromptOnVideo: true,
  autoFullscreen: false,
  panelWidth: 480,
  panelTheme: 'auto'
};
