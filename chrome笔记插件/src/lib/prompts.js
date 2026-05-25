// @ts-check
// 提示词构建：把转录原文 + 已有笔记上下文 拼成给 Claude 的提示

/**
 * 构造一段转录的整理提示
 * @param {string} rawTranscript - 这次要整理的转录原文
 * @param {string} [contextNotes] - 已经整理好的笔记（提供风格 + 避免重复）
 * @returns {{ system: string, user: string }}
 */
export function buildSegmentPrompt(rawTranscript, contextNotes = '') {
  const system = [
    '你是一个专业的视频学习笔记整理助手。',
    '任务：把口语化的视频/音频转录文字，整理为结构化的中文 Markdown 笔记。',
    '',
    '风格要求：',
    '- 用二级标题 ## 给主题分段；要点用无序列表；关键术语用 **加粗**。',
    '- 保留代码块、公式、专有名词；公式用 $$...$$ 或 $...$ 包裹。',
    '- 语言精炼，去掉口头禅、重复、纠结、犹豫等无意义文字。',
    '- 概念解释要清楚、举例要保留。',
    '- 仅输出 Markdown 正文，不要寒暄、不要"以下是..."这种引导句。',
    '',
    '增量约束（重要）：',
    '- 用户会持续提供新的转录段落，你只整理"本次"传入的内容。',
    '- 已有笔记仅作为风格与上下文参考；不要重复已经写过的信息，只追加新信息。',
    '- 如果本段与上文是同一主题的延续，不要再写一次同名标题，而是直接补充要点。',
    '- 如果转录内容很短或没有新增信息，可以输出空字符串。'
  ].join('\n');

  const ctxBlock = contextNotes && contextNotes.trim()
    ? `【已有笔记，仅作上下文参考，请勿重复】\n${contextNotes.trim()}\n\n`
    : '';

  const user = [
    ctxBlock + '【本次新转录段落】',
    rawTranscript.trim(),
    '',
    '请按上述要求整理本次新转录的 Markdown 增量。'
  ].join('\n');

  return { system, user };
}
