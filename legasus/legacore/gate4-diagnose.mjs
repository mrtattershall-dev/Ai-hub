// GATE 4 — why do e01:op3, e06:op3 and f01:op2 leave positions standing that execution rejects?
//
// No rule is proposed here. The surviving positions are printed with their surroundings, the operation
// code, and its facts, so the residual can be READ. g03's residual looked structural and turned out to
// be semantic intent; this one gets the same treatment before anything is built.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { constrain } from './constraints5.mjs';
import { buildContext } from './opcontext.mjs';
import { reconstruct, baseFor } from '../legalabs/substrate/narrowability.mjs';

const NL = String.fromCharCode(10);
const ROOT = 'C:/Users/tatte/Projects/ai-coding-hub-indent/legasus/legalabs/substrate/';
const TARGETS = [['provenance', 'e01', 2], ['provenance', 'e06', 2], ['provenance', 'f01', 1]];

for (const [fam, task, k] of TARGETS) {
  const dir = join(ROOT + fam, task);
  if (!existsSync(join(dir, 'task.json'))) continue;
  const GT = JSON.parse(readFileSync(join(ROOT + fam, 'GROUNDTRUTH.json'), 'utf8'));
  const t = GT.find((x) => x.task === task);
  const row = t.rows[k];
  const recon = reconstruct(dir);
  const base = baseFor(recon, k);
  const ctx = buildContext(recon, k, base, row, task);
  const res = constrain(ctx, row.candidate_positions);
  const failing = new Set(row.failing_positions || []);
  const survivors = res.region.filter((p) => failing.has(p));
  const lines = base.split(NL);

  console.log('  ' + fam + '/' + task + ':' + row.op + '   indent ' + ctx.indent);
  console.log('      operation code: ' + JSON.stringify(ctx.code.trim()).slice(0, 96));
  console.log('      facts  provides ' + JSON.stringify(ctx.facts.provides)
    + '  immediate ' + JSON.stringify(ctx.facts.requires_immediate)
    + '  deferred ' + JSON.stringify(ctx.facts.requires_deferred));
  console.log('      truth passes ' + row.passing + ' of ' + row.candidates
    + '   derived ' + res.constrained + '   survivors that FAIL: ' + JSON.stringify(survivors));
  console.log('      constraints emitted: ' + res.chain.map((c) => c.kind
    + '(' + (c.removed_positions || []).length + ')').join(' '));
  console.log('      --- the text, with candidate positions marked');
  lines.forEach((l, i) => {
    const cand = row.candidate_positions.includes(i);
    const mark = !cand ? '    '
      : failing.has(i) ? (res.region.includes(i) ? 'SURV' : 'cut ') : 'pass';
    console.log('        ' + String(i).padStart(3) + ' ' + mark + '  ' + l);
  });
  console.log('');
}
