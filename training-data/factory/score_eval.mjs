/**
 * score_eval.mjs — score base vs run1 vs v2 generations into a before/after table.
 *
 *   node factory/score_eval.mjs        (reads factory/eval/eval_{base,run1,v2}.jsonl)
 *
 * For each variant's held-out generations, measures the metrics that matter for "accuracy":
 *   - has code         : produced a fenced code block at all
 *   - self-contained   : gate pass (zero free vars = no undefined refs) — the pivot's bug
 *   - avg free vars    : how many undefined refs on average (lower = better)
 *   - runs clean       : of the node-runnable (non-DOM) ones, % that execute without throwing
 * Canvas games are counted separately (need a headless DOM to fully verify — next stage).
 */
import { execFileSync } from 'child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { analyze, extractJS } from './gate.mjs';

const DIR = join('factory', 'eval');
const VARIANTS = [['base', 'eval_base.jsonl'], ['run1', 'eval_run1.jsonl'], ['v2', 'eval_v2.jsonl']];
const DOM = /\b(document|window\.|requestAnimationFrame|getContext|addEventListener|localStorage|new Image|new Audio|AudioContext)\b/;
const TMP = join('factory', '_eval_tmp');
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });

function block(text) {
  const m = text.match(/```(\w+)?\s*\n([\s\S]*?)```/);
  if (!m) return null;
  return { lang: (m[1] || '').toLowerCase() === 'html' ? 'html' : 'js', code: m[2] };
}

function scoreFile(path) {
  if (!existsSync(path)) return null;
  const rows = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  let hasCode = 0, selfContained = 0, freeSum = 0, freeDen = 0;
  let nodeRunnable = 0, ranClean = 0, threw = 0, hung = 0, browser = 0;
  const perPrompt = {};
  for (const r of rows) {
    const b = block(r.text || '');
    if (!b) { perPrompt[r.id] = 'no-code'; continue; }
    hasCode++;
    const code = extractJS(b.lang === 'html' ? 'x.html' : 'x.js', b.code);
    const a = analyze(code);
    let mark = '';
    if (a.syntax) { freeSum += a.free.length; freeDen++; if (a.free.length === 0) { selfContained++; mark = 'self-contained'; } else mark = `free:${a.free.length}`; }
    else mark = 'syntax-err';
    // execution stage (node-runnable only)
    if (a.syntax && !DOM.test(b.code)) {
      nodeRunnable++;
      const f = join(TMP, 'v_' + createHash('sha1').update(b.code).digest('hex').slice(0, 12) + '.js');
      writeFileSync(f, b.code, 'utf8');
      try { execFileSync('node', [f], { timeout: 5000, stdio: 'pipe' }); ranClean++; mark += ' +runs'; }
      catch (e) { if (e.signal === 'SIGTERM' || e.code === 'ETIMEDOUT') { hung++; mark += ' +hung'; } else { threw++; mark += ' +threw'; } }
    } else if (a.syntax) { browser++; mark += ' (browser)'; }
    perPrompt[r.id] = mark;
  }
  const n = rows.length;
  return { n, hasCode, selfContained, avgFree: freeDen ? freeSum / freeDen : 0,
           nodeRunnable, ranClean, threw, hung, browser, perPrompt };
}

const results = {};
for (const [name, file] of VARIANTS) results[name] = scoreFile(join(DIR, file));
rmSync(TMP, { recursive: true, force: true });

const pct = (a, b) => b ? `${(100 * a / b).toFixed(0)}%` : '—';
const col = (s) => String(s).padEnd(16);
console.log('\n=== held-out eval: base vs run1 vs v2 ===\n');
console.log(col('metric') + ['base', 'run1', 'v2'].map(col).join(''));
const line = (label, fn) => console.log(col(label) + VARIANTS.map(([k]) => col(results[k] ? fn(results[k]) : '—')).join(''));
line('prompts', r => r.n);
line('produced code', r => `${r.hasCode}/${r.n}`);
line('self-contained', r => `${r.selfContained}/${r.hasCode} (${pct(r.selfContained, r.hasCode)})`);
line('avg free-vars', r => r.avgFree.toFixed(2));
line('node-runnable', r => `${r.nodeRunnable}`);
line('  └ runs clean', r => `${r.ranClean}/${r.nodeRunnable} (${pct(r.ranClean, r.nodeRunnable)})`);
line('  └ threw', r => `${r.threw}`);
line('  └ hung', r => `${r.hung}`);
line('canvas (browser)', r => `${r.browser}`);

console.log('\nper-prompt (self-containment + execution):');
const ids = results.base ? Object.keys(results.base.perPrompt) : [];
console.log(col('prompt') + ['base', 'run1', 'v2'].map(col).join(''));
for (const id of ids) console.log(col(id) + VARIANTS.map(([k]) => col(results[k]?.perPrompt[id] || '—')).join(''));
console.log('\nlower avg free-vars + higher self-contained%/runs-clean% = more accurate. If run1/v2 beat base, the training moved the needle.');
