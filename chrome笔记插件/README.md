# AI 视频笔记 (AI Video Note Taker)

看视频时 AI 辅助实时语音笔记,自动同步到 Obsidian 的 Chrome 浏览器扩展。

- 检测页面视频后自动询问是否打开笔记面板
- 实时语音识别(Web Speech API)+ AI 整理为结构化 Markdown
- 内置 9+ 主流 AI 供应商模板,自带 key 一键接入(Anthropic / OpenAI / DeepSeek / Kimi / 智谱 / 通义 / OpenRouter / SiliconFlow / Ollama 本地 / 自定义)
- 支持「AI 与人类同时编辑」(光标偏移合并,不会互相覆盖)
- debounce 后台同步到 Obsidian Vault(通过 Local REST API 插件)
- 米色奶油主题 + 自绘小猫吉祥物

## 安装

### 1. 加载扩展

1. 打开 `chrome://extensions/`,右上角开启「开发者模式」
2. 点击「加载已解压的扩展程序」,选择本目录

### 2. 准备 API Key

#### AI 供应商(任选其一,自带 key)

设置页内置模板,点选供应商后自动填好 baseURL/协议/推荐模型,只需粘贴你自己的 key:

| 供应商 | 协议 | 标签 | 申请入口 |
| --- | --- | --- | --- |
| **Anthropic Claude**(官方) | anthropic | 官方 / 推荐 | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| **OpenAI**(官方) | openai | 官方 | [platform.openai.com](https://platform.openai.com/api-keys) |
| **DeepSeek** | openai | 国产 / 推荐 / 便宜 | [platform.deepseek.com](https://platform.deepseek.com) |
| **Kimi**(月之暗面) | openai | 国产 | [platform.moonshot.cn](https://platform.moonshot.cn/console/api-keys) |
| **智谱 GLM** | openai | 国产 / 免费 | [bigmodel.cn](https://open.bigmodel.cn/usercenter/apikeys) |
| **通义千问** | openai | 国产 | [dashscope.aliyun.com](https://dashscope.console.aliyun.com/apiKey) |
| **OpenRouter** | openai | 聚合 | [openrouter.ai](https://openrouter.ai/keys) |
| **SiliconFlow**(硅基流动) | openai | 国产 / 聚合 / 免费 | [siliconflow.cn](https://cloud.siliconflow.cn/account/ak) |
| **Ollama**(本地) | openai | 本地 / 免费 / 无需 key | 本机运行 `ollama serve` |
| **自定义** | 任选 | — | 任意 OpenAI 兼容端点 |

> 所有 key 仅保存在 `chrome.storage.sync`,只发往你选的那个供应商域名,不经过任何第三方中转。本地 Ollama 不需要 key。

填好后点「测试连接」会让模型回个简短回复来验证 key/baseURL/model 三项都对。

#### Obsidian Local REST API
- Obsidian 中安装社区插件「Local REST API」
- 启用插件 → 复制生成的 API key
- 默认监听 `https://127.0.0.1:27124`(扩展已配置 host_permissions)

### 3. 在扩展设置页填入

工具栏图标 → 「打开设置」,填入两组 key,点击「测试连接」验证 Obsidian 通达后保存。

## 使用

1. 打开任意带 `<video>` 的网页(B 站、YouTube、网课等)
2. 扩展会自动浮窗询问;也可手动点击工具栏 → 「打开 AI 笔记面板」,或按 `Ctrl/Cmd+Shift+N`
3. 面板右侧出现,点 **录音** 开始语音识别
4. 攒满设定秒数(默认 30s)后,Claude 自动把当段口播整理成 Markdown 追加到笔记
5. 你可以同时手打补充;AI 在自己的「光标点」插入,不冲突
6. 笔记自动保存到 Obsidian 配置目录,文件名按模板生成(支持 `{date}` `{time}` `{title}` `{host}`)

### 快捷键

- `Ctrl/Cmd+Shift+N` — 打开/关闭笔记面板

## 配置项

设置页一览:

| 分类 | 项 | 说明 |
| --- | --- | --- |
| AI | 供应商模板 | 一键载入推荐 baseURL / 协议 / 模型 |
| AI | API Key | 你自己的 key,仅本地保存 |
| AI | 模型 | 下拉选推荐模型,或手填任意 model id |
| AI | 高级 · 协议 / Base URL | Anthropic Messages 或 OpenAI Chat Completions 兼容 |
| AI | 批次秒数 | 攒多少秒口播喂一次 AI |
| AI | 系统提示词 | 自定义整理风格 |
| 语音 | 识别语言 | zh-CN / en-US / 等 |
| 语音 | 来源 | 麦克风 / 标签页音频(实验性) |
| 语音 | 连续识别 | 中途不自动停止 |
| Obsidian | Scheme/Host/Port | 默认 https/127.0.0.1/27124 |
| Obsidian | API Key | Local REST API 生成 |
| Obsidian | 笔记目录 / 文件名模板 | |
| 行为 | 自动询问 / 自动全屏 / 面板宽度 / 主题 | |

## 技术栈

- Manifest V3(service worker + content scripts + offscreen 待用)
- 模块化 ES Modules,无打包
- `webkitSpeechRecognition` 实时转录
- 双协议 AI 客户端:Anthropic Messages SSE + OpenAI Chat Completions SSE(同套 SSE 解析器)
- Obsidian Local REST API,Bearer 鉴权
- Shadow DOM iframe 注入,避免污染宿主页样式

## 目录结构

```
manifest.json
assets/icons/             正式 PNG 图标(由内置猫咪 logo SVG 生成)
src/
├── background/service-worker.js   消息中枢
├── content/
│   ├── video-detector.js          视频检测 + 浮窗 + 面板挂载
│   ├── consent.js                 同意弹窗
│   └── inject-toast.css
├── editor/
│   ├── editor.html / editor.css / editor.js   笔记面板(iframe 内)
├── popup/                          工具栏弹窗
├── options/                        设置页
└── lib/
    ├── constants.js               MSG / STORAGE_KEYS / 默认设置
    ├── settings.js                chrome.storage.sync 封装(含旧字段迁移)
    ├── providers.js               AI 供应商模板表
    ├── ai-client.js               双协议流式 AI 客户端(Anthropic + OpenAI 兼容)
    ├── anthropic-client.js        兼容旧导入,re-export ai-client
    ├── obsidian-client.js         Local REST API 客户端
    ├── voice-recognizer.js        语音识别
    ├── note-pipeline.js           攒批喂 AI → 写入 editor
    ├── note-storage.js            会话/草稿
    ├── mini-md.js                 轻量 Markdown 渲染(预览)
    ├── prompts.js                 默认系统提示词
    ├── theme.css                  米色奶油主题(全局)
    ├── icons.js                   Lucide 风格内联 SVG 图标(MIT)
    └── mascot.js                  自绘小猫吉祥物 SVG(CC0)
```

## 隐私

- 所有 key 仅保存在 `chrome.storage.sync`,不上传第三方
- 语音识别由浏览器本地的 Web Speech API 处理(部分实现会上传 Google 服务,以浏览器为准)
- 笔记内容仅发送到:你选定的 AI 供应商域名 + Obsidian 本地 API
- 旧版本的 `anthropicApiKey` 字段会自动迁移到新的 `aiApiKey`,无需手动重填

## 已知限制

- Web Speech API 只在 Chromium 系浏览器可用
- 「标签页音频」标记为实验性,部分网站受 DRM/MediaSession 限制无法捕获
- 需 Chrome 119+(为 `webkitSpeechRecognition` 持续会话能力)

## 许可

代码 MIT。内置图标采用 Lucide 风格 (MIT) 自实现。猫咪吉祥物 CC0,可自由使用。
