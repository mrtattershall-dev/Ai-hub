// IS THE REMAINING B1 FAILURE A BOUNDARY PROBLEM RATHER THAN A CONTENT PROBLEM?
//
// B1 fixed what it was meant to fix: with the identifier named, site 1 now writes `fence = None`
// instead of copying the neighbouring `items = []`. But the generator does not STOP at the site. It
// emits the right first statement and then keeps going - inventing flush_code(), re-declaring the
// existing flush_para(), or continuing my own instruction-comment format as a pattern. 9 of 31 steps
// hit the 600-token cap and 14 of 31 echoed instruction text.
//
// So the question is now: is the CONTENT right and only the LENGTH wrong?
//
// This is a post-hoc analysis over ALREADY-COLLECTED bytes. No new inference. It is therefore
// developmental evidence only - any bound it suggests is tuned on this data and must be re-tested on
// fresh seeds before it counts as a result.
//
// Only STEP 1 is analysed. Every seed of a goal shares the same step-1 prompt, so the comparison is
// clean; later steps were conditioned on whatever the previous step actually produced, and their
// prompts cannot be reconstructed for a counterfactual.
//
// TWO BOUNDS:
//   D1  oracle-length      truncate to the reference snippet's line count. NOT implementable - it uses
//                          the answer's length - but it upper-bounds what perfect length control could
//                          buy, and so separates "wrong content" from "right content, wrong length".
//   D2  deterministic      implementable with no oracle: stop at the first line that dedents below the
//                          site indentation, or reproduces a structural line already in the source, or
//                          looks like an instruction comment.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SITES, locate } from './oraclesites.mjs';
import { regressionFor } from './regression.mjs';
import { checkContract } from './contractCheck.mjs';
import { deriveContract } from './contract.mjs';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const DIR = process.argv[2];
const rows = JSON.parse(readFileSync(join(DIR, 'rows.json'), 'utf8'))
  .filter((r) => r.condition === 'B_oracle_localized_insertion');

const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const names = [...world.keys()].sort();
const freshWs = () => {
  const ws = mkdtempSync(join(tmpdir(), 'bnd-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of names) writeFileSync(join(ws, f), world.get(f));
  return ws;
};

const indentOf = (l) => (l.match(/^[ \t]*/) || [''])[0].length;

function d2(snippet, indent, src) {
  const srcLines = new Set(src.split('\n').map((l) => l.trim()).filter((l) => l.length > 3));
  const lines = snippet.split('\n');
  const keep = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trim();
    if (i > 0) {
      if (t && indentOf(l) < indent) break;                                   // dedented out of the site
      if (/^#/.test(t) && /WRITE ONLY|REQUESTED CHANGE|AUTHORITATIVE|MARKER/i.test(t)) break;
      if (/^(def|for|while|class)\b/.test(t) && srcLines.has(t)) break;        // re-emitting existing structure
    }
    keep.push(l);
  }
  while (keep.length && !keep[keep.length - 1].trim()) keep.pop();
  return keep.join('\n') + '\n';
}

console.log('  BOUNDARY ANALYSIS - post-hoc over preserved bytes, step 1 only, no new inference\n');
const out = [];
for (const goal of [64, 74]) {
  const spec = SITES[goal];
  const site = spec.sites[0];
  const c = deriveContract(GOALS[goal - 1]);
  const suite = regressionFor(spec.file);
  const refLines = site.reference.replace(/\n$/, '').split('\n').length;
  const ind = ' '.repeat(site.indent);
  console.log('=== goal ' + goal + '  site 1  (reference is ' + refLines + ' line(s): '
    + JSON.stringify(site.reference) + ') ===');
  for (const r of rows.filter((x) => x.goal === goal)) {
    const s = r.steps[0];
    if (!s || !s.wire_id) continue;
    const body = readFileSync(join(DIR, 'replies', s.wire_id + '.reply.txt'), 'utf8');
    const raw = ind + body;
    const ws = freshWs();
    const path = join(ws, spec.file);
    const src0 = readFileSync(path, 'utf8');
    const loc = locate(src0, site);

    const variants = {
      raw,
      D1_oracle_length: raw.split('\n').slice(0, refLines).join('\n') + '\n',
      D2_deterministic: d2(raw, site.indent, src0),
    };
    const res = {};
    for (const [k, snip] of Object.entries(variants)) {
      writeFileSync(path, loc.before + snip + loc.after, 'utf8');
      const lo = checkContract(ws, spec.file, { ...c, moduleExports: [], members: [] });
      const reg = lo.loads ? suite(ws).pass : false;
      // Does it match the reference exactly, ignoring trailing blank lines?
      const exact = snip.replace(/\s+$/, '') === site.reference.replace(/\s+$/, '');
      res[k] = { loads: lo.loads, reg, exact };
    }
    out.push({ goal, seed: r.seed, bytes: raw.length, tok: s.eval_count, cap: s.hit_cap, res });
    console.log('  seed ' + r.seed + '  ' + String(raw.length).padStart(5) + 'B/' + String(s.tok || s.eval_count).padStart(3) + 'tok'
      + (s.hit_cap ? ' CAP' : '   ')
      + '   raw ' + (res.raw.loads ? 'load' : 'FAIL') + '/' + (res.raw.reg ? 'old-ok' : 'old-x')
      + '   D1 ' + (res.D1_oracle_length.loads ? 'load' : 'FAIL') + '/' + (res.D1_oracle_length.reg ? 'old-ok' : 'old-x')
      + (res.D1_oracle_length.exact ? '/EXACT' : '')
      + '   D2 ' + (res.D2_deterministic.loads ? 'load' : 'FAIL') + '/' + (res.D2_deterministic.reg ? 'old-ok' : 'old-x')
      + (res.D2_deterministic.exact ? '/EXACT' : ''));
  }
  console.log('');
}

console.log('===== STEP-1 SUMMARY =====');
for (const goal of [64, 74]) {
  const g = out.filter((x) => x.goal === goal);
  const tally = (k, f) => g.filter((x) => f(x.res[k])).length;
  console.log('  goal ' + goal + '  n=' + g.length);
  for (const k of ['raw', 'D1_oracle_length', 'D2_deterministic']) {
    console.log('    ' + k.padEnd(18) + ' loads ' + tally(k, (v) => v.loads) + '/' + g.length
      + '   old kept ' + tally(k, (v) => v.reg) + '/' + g.length
      + '   byte-identical to reference ' + tally(k, (v) => v.exact) + '/' + g.length);
  }
}
console.log('\n  D1 uses the reference LENGTH and is not implementable - it only separates wrong content');
console.log('  from right content that ran on. D2 is implementable. Any gain must be re-tested on FRESH');
console.log('  seeds before it counts: this rule was written while looking at these trajectories.');
