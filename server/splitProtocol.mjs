/**
 * splitProtocol.mjs - REL-2's treatment: JSON for the action, plain text for the code (splitProtocol.test.mjs).
 *
 * Call 1 is grammar-constrained (Ollama `format`) to actionSchema(): a thought, an action that can only be one of
 * the hub's real tools, and the short header fields. The schema has NO field for file content, so a small model's
 * code is never JSON-escaped - that escaping is what agentParse.js records breaking smaller models. When the action
 * carries a body, call 2 asks for that body alone, in an ordinary fenced block.
 *
 * Nothing here decides what an action MEANS. assemble() writes the two answers back into the hub's ordinary reply
 * shape and the caller hands it to the unchanged parseAction, so every guard in agentParse.js and agent.js applies
 * exactly as it does to a plain-text reply. A second parser would be a second set of rules.
 */
const FENCE = '`'.repeat(3);

// Header fields, in the order assemble() writes them. Every one is a single line except TEXT (task_add, remember).
const HEADERS = ['path', 'lines', 'command', 'query', 'url', 'which', 'goal', 'message', 'sha', 'occurrence', 'remove', 'duplicate', 'summary', 'rules'];

export function actionSchema(tools) {
  const str = { type: 'string' };
  return {
    type: 'object',
    properties: {
      thought: str,
      action: { type: 'string', enum: [...tools] },
      ...Object.fromEntries(HEADERS.map((h) => [h, str])),
      text: str,
    },
    required: ['thought', 'action'],
  };
}

/** What body this action needs from call 2, or null for a header-only action. */
export function needsBody(f) {
  switch (f && f.action) {
    case 'write_file': case 'append_file': return 'content';
    case 'edit_file': return f.lines ? 'replace' : 'find_replace';
    case 'run_python': return f.path ? null : 'code';
    default: return null;
  }
}

/** The instruction for call 2. */
export function bodyRequest(f, kind) {
  const plain = 'Write code normally: do not escape quotes or backslashes, and do not wrap it in JSON.';
  switch (kind) {
    case 'content': return f.action === 'append_file'
      ? `Now write ONLY the new code to add to the end of ${f.path} (action append_file), as ONE fenced code block and nothing else. ${plain}`
      : `Now write the COMPLETE content of ${f.path} (action write_file), as ONE fenced code block and nothing else. ${plain}`;
    case 'code': return `Now write the Python code to run (action run_python), as ONE fenced code block and nothing else. ${plain}`;
    case 'replace': return `Now write the new text for lines ${f.lines} of ${f.path} (action edit_file), as ONE fenced code block and nothing else. ${plain}`;
    case 'find_replace': return `Now give the edit for ${f.path} (action edit_file) in exactly this shape and nothing else:\nFIND:\n${FENCE}\nthe exact old code\n${FENCE}\nREPLACE:\n${FENCE}\nthe new code\n${FENCE}\n${plain}`;
    default: return '';
  }
}

const BLOCK = new RegExp(`${FENCE}[^\\n]*\\n[\\s\\S]*?\\n${FENCE}`, 'g');

/** Call 2's answer, as the text assemble() appends. Prose around the fence is dropped; an unfenced answer is kept. */
export function extractBody(text, kind) {
  const t = String(text ?? '').replace(/\r\n/g, '\n');
  const blocks = t.match(BLOCK) || [];
  if (kind === 'find_replace') {
    const at = t.search(/^[ \t]*FIND:/m);
    if (at >= 0 && /^[ \t]*REPLACE:/m.test(t.slice(at))) {
      const rep = t.slice(at).search(/^[ \t]*REPLACE:/m) + at;
      const after = t.slice(rep).match(BLOCK);
      return after ? t.slice(at, rep + t.slice(rep).indexOf(after[0]) + after[0].length) : t.slice(at).trim();
    }
    if (blocks.length >= 2) return `FIND:\n${blocks[0]}\nREPLACE:\n${blocks[1]}`;
    return t.trim();
  }
  const block = blocks[0] || `${FENCE}\n${t.trim()}\n${FENCE}`;
  return kind === 'replace' ? `REPLACE:\n${block}` : block;
}

const flat = (v) => String(v ?? '').replace(/\s*\n\s*/g, ' ').trim();
// A TEXT line that looks like a header would be read as one. The words are kept; the line stops being a header.
const defang = (v) => String(v ?? '').replace(/^([ \t]*)([A-Z][A-Z_]{1,20}):/gm, '$1$2 -');

/** The hub's ordinary reply, from call 1's fields and call 2's body. */
export function assemble(f, body = null) {
  const out = [`THOUGHT: ${flat(f.thought)}`, `ACTION: ${flat(f.action)}`];
  for (const h of HEADERS) if (f[h] !== undefined && flat(f[h]) !== '') out.push(`${h.toUpperCase()}: ${flat(f[h])}`);
  if (f.text !== undefined && String(f.text).trim() !== '') out.push(`TEXT:\n${defang(String(f.text).trim())}`);
  if (body) out.push(body);
  return out.join('\n');
}
