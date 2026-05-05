/**
 * Forum markdown → HTML (subset, XSS-safe). Used only for forum display.
 * Supports:
 * - **bold** or __bold__
 * - *italic* or _italic_
 * - ++underline++
 * - `code`, [text](url), ![](img), - lists, ### headings, paragraphs, line breaks
 * - BBCode (forum toolbar): [size=14]...[/size], [color=#rrggbb]...[/color], [left|center|right]...[/...]
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  const lower = u.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return '';
  if (
    lower.startsWith('http://')
    || lower.startsWith('https://')
    || lower.startsWith('/')
    || lower.startsWith('#')
  ) {
    return u;
  }
  return '';
}

function sanitizeFontSizePx(raw) {
  const n = Number.parseInt(String(raw || '').trim(), 10);
  if (!Number.isFinite(n)) return '';
  return String(Math.max(10, Math.min(40, n)));
}

function sanitizeColor(raw) {
  const v = String(raw || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) return v.toLowerCase();
  return '';
}

function alignmentClassFor(tag) {
  const t = String(tag || '').toLowerCase();
  if (t === 'center') return 'forumMdAlignCenter';
  if (t === 'right') return 'forumMdAlignRight';
  return 'forumMdAlignLeft';
}

/** Strip broken fragments like [text]() before parse */
function normalizeBrokenMarkdown(raw) {
  let s = String(raw || '');
  s = s.replace(/\[text\]\(\)\s*/gi, '');
  s = s.replace(/\[text\]\(\s*\)\s*/gi, '');

  // Typo helper: users often type "**bold*" instead of "**bold**"
  s = s
    .split('\n')
    .map((line) => {
      const t = line.trimEnd();
      if (!t.startsWith('**')) return line;
      if (t.endsWith('**')) return line;
      if (!t.endsWith('*')) return line;
      // Only handle simple single-line bold openings without inner "**"
      const afterOpen = t.slice(2);
      if (afterOpen.includes('**')) return line;
      return `${line}*`;
    })
    .join('\n');

  return s;
}

/**
 * Parse inline markdown from RAW text (do not pre-escape whole string).
 */
function renderInline(raw) {
  let s = String(raw || '');
  let out = '';

  while (s.length) {
    const img = s.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (img) {
      const href = sanitizeUrl(img[2]);
      if (href) {
        const altText = escapeHtml(img[1] || '');
        out += `<figure class="forumMdFigure"><img class="forumMdImg" src="${escapeHtml(href)}" alt="${altText}" loading="lazy" /></figure>`;
      }
      s = s.slice(img[0].length);
      continue;
    }

    const link = s.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (link) {
      const href = sanitizeUrl(link[2]);
      if (href) {
        out += `<a class="forumMdLink" href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">${escapeHtml(link[1])}</a>`;
      } else {
        out += escapeHtml(link[0]);
      }
      s = s.slice(link[0].length);
      continue;
    }

    const code = s.match(/^`([^`]+)`/);
    if (code) {
      out += `<code class="forumMdCode">${escapeHtml(code[1])}</code>`;
      s = s.slice(code[0].length);
      continue;
    }

    const align = s.match(/^\[(left|center|right)\]([\s\S]*?)\[\/\1\]/i);
    if (align) {
      const cls = alignmentClassFor(align[1]);
      out += `<div class="forumMdAlign ${cls}">${renderInline(align[2])}</div>`;
      s = s.slice(align[0].length);
      continue;
    }

    const sizeTag = s.match(/^\[size=([0-9]{1,2})\]([\s\S]*?)\[\/size\]/i);
    if (sizeTag) {
      const px = sanitizeFontSizePx(sizeTag[1]);
      if (px) {
        out += `<span class="forumMdSize" style="font-size:${escapeHtml(px)}px">${renderInline(sizeTag[2])}</span>`;
      } else {
        out += escapeHtml(sizeTag[0]);
      }
      s = s.slice(sizeTag[0].length);
      continue;
    }

    const colorTag = s.match(/^\[color=(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\]([\s\S]*?)\[\/color\]/i);
    if (colorTag) {
      const col = sanitizeColor(colorTag[1]);
      if (col) {
        out += `<span class="forumMdColor" style="color:${escapeHtml(col)}">${renderInline(colorTag[2])}</span>`;
      } else {
        out += escapeHtml(colorTag[0]);
      }
      s = s.slice(colorTag[0].length);
      continue;
    }

    const bold = s.match(/^\*\*([\s\S]+?)\*\*/) || s.match(/^__([\s\S]+?)__/);
    if (bold) {
      out += `<strong class="forumMdStrong">${renderInline(bold[1])}</strong>`;
      s = s.slice(bold[0].length);
      continue;
    }

    const underline = s.match(/^\+\+([\s\S]+?)\+\+/);
    if (underline) {
      out += `<u class="forumMdU">${renderInline(underline[1])}</u>`;
      s = s.slice(underline[0].length);
      continue;
    }

    const italicStar = s.match(/^\*([^*\n]+?)\*/);
    if (italicStar) {
      out += `<em class="forumMdEm">${renderInline(italicStar[1])}</em>`;
      s = s.slice(italicStar[0].length);
      continue;
    }

    const italicUnder = s.match(/^_([^_\n]+?)_/);
    if (italicUnder) {
      out += `<em class="forumMdEm">${renderInline(italicUnder[1])}</em>`;
      s = s.slice(italicUnder[0].length);
      continue;
    }

    const autoUrl = s.match(/^(https?:\/\/[^\s<]+)/i);
    if (autoUrl) {
      const href = sanitizeUrl(autoUrl[1]);
      if (href) {
        out += `<a class="forumMdLink" href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">${escapeHtml(href)}</a>`;
        s = s.slice(autoUrl[0].length);
        continue;
      }
    }

    out += escapeHtml(s.charAt(0));
    s = s.slice(1);
  }

  return out.replace(/\n/g, '<br />');
}

export function forumMarkdownToHtml(markdown) {
  const normalized = normalizeBrokenMarkdown(markdown);
  const lines = normalized.replace(/\r\n/g, '\n').split('\n');

  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    if (/^###\s+/.test(line)) {
      const content = line.replace(/^###\s+/, '');
      blocks.push(`<h3 class="forumMdH3">${renderInline(content)}</h3>`);
      i += 1;
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        items.push(`<li class="forumMdLi">${renderInline(lines[i].replace(/^-\s+/, ''))}</li>`);
        i += 1;
      }
      blocks.push(`<ul class="forumMdUl">${items.join('')}</ul>`);
      continue;
    }

    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '') {
      paraLines.push(lines[i]);
      i += 1;
    }
    const para = paraLines.join('\n');
    blocks.push(`<p class="forumMdP">${renderInline(para)}</p>`);
  }

  return blocks.join('');
}
