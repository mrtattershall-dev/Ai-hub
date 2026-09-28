// OLD-BEHAVIOUR REGRESSION SUITES.
//
// A behavioural replacement passes only when OLD BEHAVIOUR STILL PASSES *and* the NEW requested
// behaviour passes. Without the first half there is no way to tell "implemented the new feature"
// from "implemented the new feature by deleting yesterday's feature" - which is exactly why
// replace_method was refused in v2.
//
// These suites assert behaviour established by goals 1-40 and are run TWICE: once before the
// replacement (to prove the baseline is sound - a suite that is already failing cannot witness
// anything) and once after (to prove nothing was lost).
//
// They are deliberately independent of the delta probes in probes.mjs. A delta probe tests the NEW
// behaviour; these test what must survive it.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const runJs = (ws, code) => {
  const f = join(ws, '_reg.js');
  writeFileSync(f, code, 'utf8');
  const r = spawnSync(process.execPath, [f], { cwd: ws, encoding: 'utf8', timeout: 30000 });
  return { out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
};
const runPy = (ws, file) => {
  const r = spawnSync('python', [join(ws, file)], { cwd: ws, encoding: 'utf8', timeout: 30000 });
  return { out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
};

// ---- s4_markdown.py : goals 4, 14, 24, 34 -----------------------------------------------------
const markdownRegression = (ws) => {
  const probe = [
    'import s4_markdown as m',
    'cases = [',
    '  ("a\\nb", "<p>a b</p>"),',                              // goal 4: lines joined with one space
    '  ("a\\n\\nb", "<p>a</p>\\n<p>b</p>"),',                  // goal 4: blocks joined with newline
    '  ("1 < 2 & 3 > 0", "<p>1 &lt; 2 &amp; 3 &gt; 0</p>"),',  // goal 4: escaping
    '  ("# Title", "<h1>Title</h1>"),',                        // goal 14: headings
    '  ("x\\n## Sub\\ny", "<p>x</p>\\n<h2>Sub</h2>\\n<p>y</p>"),',
    '  ("**b** and *i*", "<p><strong>b</strong> and <em>i</em></p>"),',   // goal 24: emphasis
    '  ("a * b", "<p>a * b</p>"),',                            // goal 24: unpaired marker stays
    '  ("`a*b*c`", "<p><code>a*b*c</code></p>"),',             // goal 34: no emphasis inside code
    ']',
    'bad = []',
    'for src, want in cases:',
    '    try:',
    '        got = m.to_html(src)',
    '    except Exception as e:',
    '        bad.append("%r threw %s" % (src, e)); continue',
    '    if got != want:',
    '        bad.append("%r -> %r wanted %r" % (src, got, want))',
    'print("REGOK" if not bad else "REGFAIL " + " | ".join(bad[:3]))',
  ].join('\n');
  const f = join(ws, '_reg.py');
  writeFileSync(f, probe, 'utf8');
  const r = spawnSync('python', [f], { cwd: ws, encoding: 'utf8', timeout: 30000 });
  const out = (String(r.stdout || '') + String(r.stderr || '')).trim();
  if (out.includes('REGOK')) return { pass: true };
  const line = out.split('\n').find((l) => l.startsWith('REGFAIL')) || out.split('\n').pop() || 'no output';
  return { pass: false, why: line.slice(0, 160) };
};

// ---- s5_expr.js : goals 5, 15, 25, 35 ---------------------------------------------------------
const exprRegression = (ws) => {
  const r = runJs(ws, [
    'const { evaluate } = require("./s5_expr.js");',
    'const bad = [];',
    'const eq = (e, want, vars) => { let got; try { got = evaluate(e, vars); } catch (x) { bad.push(e + " threw " + x.message); return; }',
    '  if (got !== want) bad.push(e + " -> " + got + " wanted " + want); };',
    'const thr = (e) => { try { evaluate(e); bad.push(e + " did not throw"); } catch (x) { /* expected */ } };',
    'eq("2 + 3 * 4", 14);',            // goal 5: precedence
    'eq("10 - 2 - 3", 5);',            // goal 5: left to right
    'eq(" 1.5 * 2 ", 3);',             // goal 5: decimals and spaces
    'thr("1/0");',                     // goal 5: division by zero
    'thr("2 +");',                     // goal 5: unparseable
    'eq("-(2+3)*2", -10);',            // goal 15: parens and unary minus
    'eq("2*-3", -6);',                 // goal 15
    'eq("2^3^2", 512);',               // goal 25: right associative
    'eq("-2^2", -4);',                 // goal 25: minus applies after the power
    'eq("2*3^2", 18);',                // goal 25: binds tighter than *
    'eq("x + 1", 42, { x: 41 });',     // goal 35: variables
    'console.log(bad.length ? "REGFAIL " + bad.slice(0,3).join(" | ") : "REGOK");',
  ].join('\n'));
  const out = (r.out + '\n' + r.err).trim();
  if (out.includes('REGOK')) return { pass: true };
  const line = out.split('\n').find((l) => l.startsWith('REGFAIL')) || out.split('\n').pop() || 'no output';
  return { pass: false, why: line.slice(0, 160) };
};

// A python module's own __main__ assertions are themselves a regression suite for its file.
const selfAssertions = (file) => (ws) => {
  const r = runPy(ws, file);
  if (r.out.includes('ok') && !r.err) return { pass: true };
  return { pass: false, why: (r.err || r.out || 'no output').split('\n').pop().slice(0, 160) };
};

const SUITES = {
  's4_markdown.py': markdownRegression,
  's5_expr.js': exprRegression,
  's2_logs.py': selfAssertions('s2_logs.py'),
  's6_graph.py': selfAssertions('s6_graph.py'),
  's8_grades.py': selfAssertions('s8_grades.py'),
};

export function regressionFor(lead) { return SUITES[lead] || null; }
export function hasRegression(lead) { return !!SUITES[lead]; }
