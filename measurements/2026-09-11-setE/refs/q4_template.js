// Reference solution (final state of chain q4) - used only to prove checks-E.mjs can pass.
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
const FILTERS = { upper: (s) => s.toUpperCase(), lower: (s) => s.toLowerCase(), trim: (s) => s.trim() };
const splitFilters = (s) => { const [name, ...filters] = s.split('|').map((x) => x.trim()); return { name, filters }; };

function parse(t) {
  const re = /\{\{\{\s*([\s\S]+?)\s*\}\}\}|\{\{\s*([#^\/!>]?)\s*([\s\S]*?)\s*\}\}/g;
  const root = { children: [] }; const stack = [root]; let last = 0, m;
  while ((m = re.exec(t))) {
    const top = stack[stack.length - 1];
    if (m.index > last) top.children.push({ type: 'text', text: t.slice(last, m.index) });
    last = re.lastIndex;
    if (m[1] !== undefined) { top.children.push({ type: 'var', raw: true, ...splitFilters(m[1]) }); continue; }
    const kind = m[2], body = m[3].trim();
    if (kind === '!') continue;
    if (kind === '#' || kind === '^') { const node = { type: 'section', inverted: kind === '^', name: body, children: [] }; top.children.push(node); stack.push(node); continue; }
    if (kind === '/') {
      if (stack.length === 1) throw new Error(`closing tag {{/${body}}} has no open section`);
      if (top.name !== body) throw new Error(`closing tag {{/${body}}} does not match the open section {{#${top.name}}}`);
      stack.pop(); continue;
    }
    if (kind === '>') { top.children.push({ type: 'partial', name: body }); continue; }
    top.children.push({ type: 'var', raw: false, ...splitFilters(body) });
  }
  if (last < t.length) stack[stack.length - 1].children.push({ type: 'text', text: t.slice(last) });
  if (stack.length > 1) throw new Error(`section {{#${stack[stack.length - 1].name}}} is never closed`);
  return root.children;
}

function lookup(stack, path) {
  if (path === '.') return stack[stack.length - 1];
  const parts = path.split('.');
  for (let i = stack.length - 1; i >= 0; i--) {
    const c = stack[i];
    if (c !== null && typeof c === 'object' && parts[0] in c) {
      let v = c;
      for (const p of parts) { if (v === null || v === undefined) return undefined; v = v[p]; }
      return v;
    }
  }
  return undefined;
}

function renderNodes(nodes, stack, partials) {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') out += n.text;
    else if (n.type === 'var') {
      const v = lookup(stack, n.name);
      let s = v === undefined || v === null ? '' : String(v);
      for (const f of n.filters) { if (!FILTERS[f]) throw new Error('unknown filter: ' + f); s = FILTERS[f](s); }
      out += n.raw ? s : escape(s);
    } else if (n.type === 'section') {
      const v = lookup(stack, n.name);
      const empty = !v || (Array.isArray(v) && v.length === 0);
      if (n.inverted) { if (empty) out += renderNodes(n.children, stack, partials); }
      else if (!empty) {
        if (Array.isArray(v)) for (const el of v) out += renderNodes(n.children, [...stack, el], partials);
        else out += renderNodes(n.children, typeof v === 'object' ? [...stack, v] : stack, partials);
      }
    } else if (n.type === 'partial') {
      if (!partials || !(n.name in partials)) throw new Error('missing partial: ' + n.name);
      out += renderNodes(parse(String(partials[n.name])), stack, partials);
    }
  }
  return out;
}

function compile(template) { const tree = parse(String(template)); return (data, partials = {}) => renderNodes(tree, [data], partials); }
function render(template, data, partials = {}) { return compile(template)(data, partials); }
module.exports = { render, compile };
