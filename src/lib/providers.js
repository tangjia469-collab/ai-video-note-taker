// @ts-check
// AI 供应商模板表 — 用户可一键选择,也可手动改字段
// protocol: 'anthropic' | 'openai'  (绝大多数国内厂商都兼容 OpenAI Chat Completions)

/**
 * @typedef {{
 *   id: string,                  // 内部 id
 *   name: string,                // 显示名
 *   protocol: 'anthropic' | 'openai',
 *   baseURL: string,             // 不带尾斜杠;'' 表示需要用户填
 *   models: string[],            // 推荐模型列表(第一个为默认)
 *   keyHint: string,             // key 占位/格式提示
 *   keyDocsUrl: string,          // 在哪里申请 key
 *   description: string,         // 一行简介(中文)
 *   tags?: string[]              // 标签:'国产' | '免费' | '本地' 等
 * }} AIProvider
 */

/** @type {AIProvider[]} */
export const AI_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude(官方)',
    protocol: 'anthropic',
    baseURL: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'],
    keyHint: 'sk-ant-...',
    keyDocsUrl: 'https://console.anthropic.com/settings/keys',
    description: '官方 Claude,推荐综合质量。需海外网络。',
    tags: ['官方', '推荐']
  },
  {
    id: 'openai',
    name: 'OpenAI(官方)',
    protocol: 'openai',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
    keyHint: 'sk-...',
    keyDocsUrl: 'https://platform.openai.com/api-keys',
    description: '官方 GPT。需海外网络。',
    tags: ['官方']
  },
  {
    id: 'deepseek',
    name: 'DeepSeek 深度求索',
    protocol: 'openai',
    baseURL: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyHint: 'sk-...',
    keyDocsUrl: 'https://platform.deepseek.com/api_keys',
    description: '国产,价格低质量好,中文笔记表现优秀。',
    tags: ['国产', '推荐', '便宜']
  },
  {
    id: 'kimi',
    name: 'Kimi(月之暗面)',
    protocol: 'openai',
    baseURL: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2-0905-preview', 'moonshot-v1-32k', 'moonshot-v1-128k', 'moonshot-v1-8k'],
    keyHint: 'sk-...',
    keyDocsUrl: 'https://platform.moonshot.cn/console/api-keys',
    description: '国产,长文本笔记整理强。',
    tags: ['国产']
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    protocol: 'openai',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4.6', 'glm-4-plus', 'glm-4-air', 'glm-4-flash'],
    keyHint: 'xxxxx.xxxxx',
    keyDocsUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    description: '国产清华系,glm-4-flash 有免费额度。',
    tags: ['国产', '免费']
  },
  {
    id: 'qwen',
    name: '通义千问(阿里百炼)',
    protocol: 'openai',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3-235b-a22b'],
    keyHint: 'sk-...',
    keyDocsUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
    description: '国产阿里系,qwen-turbo 性价比高。',
    tags: ['国产']
  },
  {
    id: 'openrouter',
    name: 'OpenRouter(聚合)',
    protocol: 'openai',
    baseURL: 'https://openrouter.ai/api/v1',
    models: [
      'anthropic/claude-sonnet-4.5',
      'openai/gpt-4o',
      'google/gemini-2.5-pro',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-chat'
    ],
    keyHint: 'sk-or-v1-...',
    keyDocsUrl: 'https://openrouter.ai/keys',
    description: '一个 key 用所有模型,免代理直连。',
    tags: ['聚合', '推荐']
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    protocol: 'openai',
    baseURL: 'https://api.siliconflow.cn/v1',
    models: [
      'deepseek-ai/DeepSeek-V3',
      'Qwen/Qwen2.5-72B-Instruct',
      'meta-llama/Llama-3.3-70B-Instruct'
    ],
    keyHint: 'sk-...',
    keyDocsUrl: 'https://cloud.siliconflow.cn/account/ak',
    description: '国产聚合,送免费额度,直连不需代理。',
    tags: ['国产', '聚合', '免费']
  },
  {
    id: 'ollama',
    name: 'Ollama(本地)',
    protocol: 'openai',
    baseURL: 'http://localhost:11434/v1',
    models: ['llama3.2', 'qwen2.5:14b', 'gemma2:9b', 'deepseek-r1:14b'],
    keyHint: '本地无需 key,留空即可',
    keyDocsUrl: 'https://ollama.com/download',
    description: '本地大模型,完全离线,隐私最强。',
    tags: ['本地', '免费']
  },
  {
    id: 'custom',
    name: '自定义(OpenAI 兼容)',
    protocol: 'openai',
    baseURL: '',
    models: [],
    keyHint: '你自己的 key',
    keyDocsUrl: '',
    description: '自填 baseURL + key。任何 OpenAI 兼容服务都可用。',
    tags: ['自定义']
  }
];

/** 按 id 取供应商 */
export function getProvider(id) {
  return AI_PROVIDERS.find((p) => p.id === id) || AI_PROVIDERS[0];
}

/** 默认供应商 id */
export const DEFAULT_PROVIDER_ID = 'anthropic';
