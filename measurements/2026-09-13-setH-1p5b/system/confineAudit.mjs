// Runs the confinement audit for every candidate SINGLE_SPAN_BEHAVIORAL goal in 61-80.
// Derived from goal text + the frozen post-60 world only. No model output involved.
import { auditConfinement, pyCheck } from './confine.mjs';

const results = [];
const report = (goal, r) => {
  results.push({ goal, ...r });
  console.log('  goal ' + goal + ': ' + (r.confined
    ? 'CONFINED  span ' + r.span_bytes + 'B, a correct body of ' + r.new_body_bytes + 'B delivers it'
    : 'NOT CONFINED - ' + String(r.why).slice(0, 110)));
};

// ---- goal 64: ordered lists in to_html --------------------------------------------------------
const ol = [
  'text):',
  '    blocks = []',
  '    current = []',
  '    items = []',
  '    nums = []',
  '',
  '    def flush_para():',
  '        if current:',
  '            blocks.append("<p>" + _inline(" ".join(current)) + "</p>")',
  '            del current[:]',
  '',
  '    def flush_list():',
  '        if items:',
  '            blocks.append("<ul>" + "".join("<li>" + _inline(i) + "</li>" for i in items) + "</ul>")',
  '            del items[:]',
  '',
  '    def flush_ol():',
  '        if nums:',
  '            blocks.append("<ol>" + "".join("<li>" + _inline(i) + "</li>" for i in nums) + "</ol>")',
  '            del nums[:]',
  '',
  '    for line in str(text).split("\\n"):',
  '        if line.strip() == "":',
  '            flush_para(); flush_list(); flush_ol()',
  '            continue',
  '        if line.startswith("- "):',
  '            flush_para(); flush_ol()',
  '            items.append(line[2:].strip())',
  '            continue',
  '        m = re.match(r"^\\d+\\. (.*)$", line)',
  '        if m:',
  '            flush_para(); flush_list()',
  '            nums.append(m.group(1).strip())',
  '            continue',
  '        flush_list(); flush_ol()',
  '        h = _is_heading(line)',
  '        if h:',
  '            flush_para()',
  '            level, body = h',
  '            blocks.append("<h%d>%s</h%d>" % (level, _inline(body), level))',
  '            continue',
  '        current.append(line.strip())',
  '    flush_para(); flush_list(); flush_ol()',
  '    return "\\n".join(blocks)',
].join('\n');

report(64, auditConfinement({
  file: 's4_markdown.py', lang: 'py', fn: 'to_html', newBody: ol,
  deltaCheck: (ws) => {
    const out = pyCheck(ws, [
      'import s4_markdown as m',
      'print("A", m.to_html("1. one\\n2. two") == "<ol><li>one</li><li>two</li></ol>")',
      'print("B", m.to_html("1. **b**") == "<ol><li><strong>b</strong></li></ol>")',
      'print("C", m.to_html("- u") == "<ul><li>u</li></ul>")',
      'print("D", m.to_html("not 1. a list") == "<p>not 1. a list</p>")',
    ].join('\n'));
    const all = ['A', 'B', 'C', 'D'].every((k) => new RegExp(k + ' True').test(out));
    return { pass: all, why: out.slice(0, 110) };
  },
}));

// ---- goal 74: fenced code blocks in to_html ---------------------------------------------------
const fence = [
  'text):',
  '    blocks = []',
  '    current = []',
  '    items = []',
  '    fence_lines = None',
  '',
  '    def flush_para():',
  '        if current:',
  '            blocks.append("<p>" + _inline(" ".join(current)) + "</p>")',
  '            del current[:]',
  '',
  '    def flush_list():',
  '        if items:',
  '            blocks.append("<ul>" + "".join("<li>" + _inline(i) + "</li>" for i in items) + "</ul>")',
  '            del items[:]',
  '',
  '    for line in str(text).split("\\n"):',
  '        if fence_lines is not None:',
  '            if line.strip() == "```":',
  '                blocks.append("<pre><code>" + _escape("\\n".join(fence_lines)) + "</code></pre>")',
  '                fence_lines = None',
  '            else:',
  '                fence_lines.append(line)',
  '            continue',
  '        if line.strip() == "```":',
  '            flush_para(); flush_list()',
  '            fence_lines = []',
  '            continue',
  '        if line.strip() == "":',
  '            flush_para(); flush_list()',
  '            continue',
  '        if line.startswith("- "):',
  '            flush_para()',
  '            items.append(line[2:].strip())',
  '            continue',
  '        flush_list()',
  '        h = _is_heading(line)',
  '        if h:',
  '            flush_para()',
  '            level, body = h',
  '            blocks.append("<h%d>%s</h%d>" % (level, _inline(body), level))',
  '            continue',
  '        current.append(line.strip())',
  '    flush_para(); flush_list()',
  '    if fence_lines is not None:',
  '        blocks.append("<pre><code>" + _escape("\\n".join(fence_lines)) + "</code></pre>")',
  '    return "\\n".join(blocks)',
].join('\n');

report(74, auditConfinement({
  file: 's4_markdown.py', lang: 'py', fn: 'to_html', newBody: fence,
  deltaCheck: (ws) => {
    const out = pyCheck(ws, [
      'import s4_markdown as m',
      'src = "```\\na < b\\n**x**\\n```"',
      'print("A", m.to_html(src) == "<pre><code>a &lt; b\\n**x**</code></pre>")',
      'print("B", m.to_html("```\\nunclosed") == "<pre><code>unclosed</code></pre>")',
      'print("C", m.to_html("a\\nb") == "<p>a b</p>")',
    ].join('\n'));
    const all = ['A', 'B', 'C'].every((k) => new RegExp(k + ' True').test(out));
    return { pass: all, why: out.slice(0, 110) };
  },
}));

console.log('\n  CONFINED: ' + results.filter((r) => r.confined).map((r) => r.goal).join(', '));
console.log('  NOT CONFINED: ' + (results.filter((r) => !r.confined).map((r) => r.goal).join(', ') || 'none'));
