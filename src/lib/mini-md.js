// 迷你 Markdown 渲染器:把 Markdown 字符串转成 HTML
// 仅支持 H1-H4、**bold**、*italic*、列表(- / 数字)、围栏代码块 ```...```、行内 `code`、链接
// 不依赖任何外部库,且对内容进行 HTML 转义防止 XSS

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 行内格式: 链接 / 行内代码 / 粗体 / 斜体
function renderInline(text) {
  let s = escapeHtml(text);

  // 行内代码 `...`
  s = s.replace(/`([^`]+?)`/g, (_, code) => `<code>${code}</code>`);

  // 链接 [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const safeUrl = url.replace(/"/g, '&quot;');
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // 粗体 **text**
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  // 斜体 *text*
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');

  return s;
}

export function renderMarkdown(md) {
  if (!md) return '';
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let inList = null; // 'ul' | 'ol' | null

  const closeList = () => {
    if (inList) {
      out.push(`</${inList}>`);
      inList = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // 围栏代码块 ```lang
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      closeList();
      const lang = fence[1] || '';
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // 跳过结束 ```
      const cls = lang ? ` class="lang-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    // 标题 H1-H4
    const heading = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // 无序列表 - / *
    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    if (ul) {
      if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul'; }
      out.push(`<li>${renderInline(ul[1])}</li>`);
      i++;
      continue;
    }

    // 有序列表 1. 2.
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ol) {
      if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${renderInline(ol[1])}</li>`);
      i++;
      continue;
    }

    // 空行 -> 关闭列表 / 段落分隔
    if (/^\s*$/.test(line)) {
      closeList();
      i++;
      continue;
    }

    // 普通段落:把连续非空非列表非标题行合并
    closeList();
    const para = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i])
      && !/^#{1,4}\s+/.test(lines[i])
      && !/^\s*[-*]\s+/.test(lines[i])
      && !/^\s*\d+\.\s+/.test(lines[i])
      && !/^```/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${renderInline(para.join(' '))}</p>`);
  }

  closeList();
  return out.join('\n');
}
