// BEHAVIOURAL ORACLES for the 61-80 goals whose structural contract cannot distinguish success from
// a no-op. Both are SINGLE_SPAN_BEHAVIORAL_ELIGIBLE, so a structural pass alone must not count.
//
//   goal 64  ordered lists      "1. " lines -> <ol><li>..</li>..</ol>, written like unordered lists
//   goal 74  fenced code blocks lines between two ``` -> <pre><code>..</code></pre>, line breaks
//            kept, escaped, NO other formatting; an unclosed fence runs to the end
//
// Each carries regression cases for behaviour that must survive, and each is witnessed three ways in
// probes60.test.mjs: the confinement reference PASSES, the frozen post-60 seed FAILS for a reason
// specific to the delta, and a no-op FAILS.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const py = (ws, code) => {
  writeFileSync(join(ws, '_probe60.py'), code, 'utf8');
  const r = spawnSync('python', [join(ws, '_probe60.py')], { cwd: ws, encoding: 'utf8', timeout: 30000 });
  return (String(r.stdout || '') + String(r.stderr || '')).trim();
};
const all = (out, keys) => keys.every((k) => new RegExp(k + ' True').test(out));

export const probe64 = {
  id: 'goal64.orderedlists',
  goal: 64,
  lead: 's4_markdown.py',
  run(ws) {
    const out = py(ws, [
      'import s4_markdown as m',
      'print("A", m.to_html("1. one\\n2. two") == "<ol><li>one</li><li>two</li></ol>")',
      'print("B", m.to_html("1. **b** x") == "<ol><li><strong>b</strong> x</li></ol>")',
      'print("C", m.to_html("3. only") == "<ol><li>only</li></ol>")',
      'print("D", m.to_html("not 1. a list") == "<p>not 1. a list</p>")',
      'print("E", m.to_html("- u") == "<ul><li>u</li></ul>")',
      'print("F", m.to_html("a\\nb") == "<p>a b</p>")',
      'print("G", m.to_html("# T") == "<h1>T</h1>")',
    ].join('\n'));
    if (/Traceback|Error/.test(out) && !/True|False/.test(out)) return { pass: false, why: out.split('\n').pop().slice(0, 100) };
    if (!all(out, ['A', 'B', 'C'])) return { pass: false, why: 'ordered lists not rendered: ' + out.slice(0, 90) };
    if (!all(out, ['D'])) return { pass: false, why: 'a non-list line was turned into a list' };
    if (!all(out, ['E', 'F', 'G'])) return { pass: false, why: 'REGRESSION - lists/paragraphs/headings broke: ' + out.slice(0, 90) };
    return { pass: true };
  },
};

export const probe74 = {
  id: 'goal74.fencedcode',
  goal: 74,
  lead: 's4_markdown.py',
  run(ws) {
    const out = py(ws, [
      'import s4_markdown as m',
      'src = "```\\na < b\\n**x**\\n```"',
      'print("A", m.to_html(src) == "<pre><code>a &lt; b\\n**x**</code></pre>")',
      'print("B", m.to_html("```\\nunclosed") == "<pre><code>unclosed</code></pre>")',
      'print("C", m.to_html("```\\nx\\n```\\n\\nafter") == "<pre><code>x</code></pre>\\n<p>after</p>")',
      'print("D", m.to_html("a\\nb") == "<p>a b</p>")',
      'print("E", m.to_html("- u") == "<ul><li>u</li></ul>")',
      'print("F", m.to_html("**b**") == "<p><strong>b</strong></p>")',
    ].join('\n'));
    if (/Traceback/.test(out) && !/True|False/.test(out)) return { pass: false, why: out.split('\n').pop().slice(0, 100) };
    if (!all(out, ['A'])) return { pass: false, why: 'fenced block not rendered, escaped, with line breaks kept: ' + out.slice(0, 90) };
    if (!all(out, ['B'])) return { pass: false, why: 'an unclosed fence does not run to the end' };
    if (!all(out, ['C'])) return { pass: false, why: 'a closed fence does not end the block' };
    if (!all(out, ['D', 'E', 'F'])) return { pass: false, why: 'REGRESSION - paragraphs/lists/emphasis broke: ' + out.slice(0, 90) };
    return { pass: true };
  },
};

export const PROBES60 = [probe64, probe74];
export const probe60For = (goal) => PROBES60.find((p) => p.goal === goal) || null;
