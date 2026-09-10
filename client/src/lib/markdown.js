// A small, dependency-free markdown renderer.
// Escapes HTML first, then supports: headers, bold, inline code, fenced
// code blocks, links, unordered/ordered lists, blockquotes and paragraphs.
// This is intentionally limited - it's meant for rendering LLM responses,
// not arbitrary documents.

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInline(text) {
  // Inline code `code`
  text = text.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  // Bold **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Links [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
  );
  return text;
}

export function renderMarkdown(raw) {
  if (!raw) return '';
  let text = escapeHtml(raw);

  // Extract fenced code blocks first so their content isn't touched further.
  const codeBlocks = [];
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const cls = lang ? ` class="language-${lang}"` : '';
    codeBlocks.push(`<pre><code${cls}>${code.replace(/\n$/, '')}</code></pre>`);
    return `\u0000CODEBLOCK${idx}\u0000`;
  });

  const lines = text.split('\n');
  const html = [];
  let listType = null; // 'ul' | 'ol' | null
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) { html.push(`</${listType}>`); listType = null; }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Code block placeholder
    const codeMatch = trimmed.match(/^\u0000CODEBLOCK(\d+)\u0000$/);
    if (codeMatch) {
      flushParagraph();
      closeList();
      html.push(codeBlocks[Number(codeMatch[1])]);
      continue;
    }

    // Blank line ends paragraph/list
    if (trimmed === '') {
      flushParagraph();
      closeList();
      continue;
    }

    // Headers
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      flushParagraph();
      closeList();
      const level = Math.min(headerMatch[1].length, 6);
      html.push(`<h${level}>${renderInline(headerMatch[2])}</h${level}>`);
      continue;
    }

    // Unordered list
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul'; }
      html.push(`<li>${renderInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol'; }
      html.push(`<li>${renderInline(olMatch[1])}</li>`);
      continue;
    }

    // Blockquote
    const bqMatch = trimmed.match(/^&gt;\s?(.*)$/);
    if (bqMatch) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${renderInline(bqMatch[1])}</blockquote>`);
      continue;
    }

    // Default: part of a paragraph
    closeList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();

  return html.join('\n');
}

// Pull fenced code blocks out of a markdown string, in order of appearance.
// Returns [{ lang, code }]. Used by the Game tab to run AI-generated code.
export function extractCodeBlocks(raw) {
  if (!raw) return [];
  const blocks = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    blocks.push({ lang: (m[1] || '').toLowerCase(), code: m[2].replace(/\n$/, '') });
  }
  return blocks;
}

// Split a markdown response into sections keyed by "## Header" lines.
// Returns [{ label, content }]. Content before the first header (if any)
// is returned under the label "Response".
export function splitMarkdownSections(raw) {
  if (!raw) return [];
  const lines = raw.split('\n');
  const sections = [];
  let current = { label: 'Response', content: [] };
  let started = false;

  for (const line of lines) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      if (started || current.content.some(l => l.trim() !== '')) sections.push(current);
      current = { label: match[1], content: [] };
      started = true;
    } else {
      current.content.push(line);
    }
  }
  if (current.content.some(l => l.trim() !== '') || started) sections.push(current);

  return sections.map(s => ({ label: s.label, content: s.content.join('\n').trim() }));
}
