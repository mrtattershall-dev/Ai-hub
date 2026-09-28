// PROSPECTIVE RUN of the frozen selector against the sealed holdout.
//
// THE SEPARATION THAT MAKES THIS A MEASUREMENT: the SELECTOR sees only what a solver would - the
// task contract and the source. The SCORER may read the oracle, because its job is to say whether
// the selector was right, and it cannot do that without ground truth. Any leak in the other
// direction turns the run into a demonstration.
//
// The seal is verified first. A holdout whose bytes changed after the selector was frozen proves
// nothing, and "I'm sure it didn't change" is not a measurement.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { selectSites } from '../../legaparse/selectv2.mjs';
import { legalRegion, siteEquivalent, scorePosition } from '../../legaparse/siteclass.mjs';
import { verifyFamily } from './seal.mjs';

const NL = String.fromCharCode(10);
const DIR = process.argv[2] || './holdout';

const seal = verifyFamily(DIR, join(DIR, 'MANIFEST.sealed.json'));
if (!seal.ok) {
  console.log('  SEAL BROKEN - refusing to score');
  for (const p of seal.problems) console.log('    ' + p.task_id + '  ' + p.field);
  process.exit(1);
}
console.log('  seal intact: ' + seal.n + ' task(s) byte-identical to ' + seal.sealed_at);
console.log('');

// The reference line for an operation: the last line of its anchor, i.e. the line the new code goes
// after. Computed from the sealed anchor text, never from a stored line number, so a reformat cannot
// silently shift ground truth.
function refLine(src, anchor) {
  const at = src.indexOf(anchor);
  if (at < 0) return null;
  // The line index of the anchor's LAST CHARACTER. An anchor ending in a newline ends on the line the
  // new code follows; an anchor that stops mid-line (c03 inserts inside a list literal) ends on the
  // line it edits. The earlier form assumed every anchor was newline-terminated and reported line -1
  // for the mid-line ones - a scorer bug, not a selector result.
  return src.slice(0, at + anchor.length - 1).split(NL).length - 1;
}

// A mechanical operation descriptor for the SCORER, derived from the reference's inserted code.
// The selector never sees this.
function describe(src, code, ref) {
  const lines = src.split(NL);
  const provides = [];
  for (const m of code.matchAll(/^\s*(?:def|class)\s+(\w+)/gm)) provides.push(m[1]);
  for (const m of code.matchAll(/^\s*self\.(\w+)\s*=(?!=)/gm)) provides.push(m[1]);
  for (const m of code.matchAll(/^([A-Za-z_]\w*)\s*=(?!=)/gm)) provides.push(m[1]);
  const requires = [];
  for (const m of code.matchAll(/\b([A-Za-z_]\w*)\b/g)) {
    const t = m[1];
    if (provides.includes(t) || requires.includes(t)) continue;
    if (new RegExp('^\\s*(?:def\\s+' + t + '\\b|(?:self\\.)?' + t + '\\s*=(?!=))', 'm').test(src)) requires.push(t);
  }
  // Structural parent of the reference position, by indentation of the enclosing def/class.
  const codeIndent = (code.split(NL).find((l) => l.trim()) || '').match(/^[ \t]*/)[0].length;
  let parent = 'module';
  for (let i = ref; i >= 0; i--) {
    const m = lines[i].match(/^(\s*)(?:def|class)\s+(\w+)/);
    if (m && m[1].length < codeIndent) { parent = m[2]; break; }
  }
  return { parent_scope: parent, kind: /^\s*def\s/m.test(code) ? 'sibling_def' : 'statement',
    requires, provides, indent: codeIndent };
}

const rows = [];
for (const d of readdirSync(DIR).sort()) {
  if (!existsSync(join(DIR, d, 'task.json'))) continue;
  const task = JSON.parse(readFileSync(join(DIR, d, 'task.json'), 'utf8'));
  const oracle = JSON.parse(readFileSync(join(DIR, d, 'evidence', 'oracle.json'), 'utf8'));
  const srcName = readdirSync(join(DIR, d, 'source'))[0];
  const src = readFileSync(join(DIR, d, 'source', srcName), 'utf8');

  const out = selectSites(task, src);                      // <- selector sees contract + source only
  const ops = oracle.transaction.operations;
  const refs = ops.map((o) => refLine(src, o.site_hint)).filter((x) => x !== null);

  // Reference code per op, recovered from the sealed patch.
  const patch = readFileSync(join(DIR, d, 'evidence', 'reference.patch'), 'utf8');
  const blocks = patch.split(/^--- op .*$/m).slice(1).map((b) => b.replace(/^\n/, ''));

  const hit = refs.filter((r) => out.sites.includes(r)).length;
  const useful = out.sites.filter((s) => refs.includes(s)).length;
  const recall = refs.length ? hit / refs.length : 0;
  const precision = out.sites.length ? useful / out.sites.length : null;
  const inflation = refs.length ? out.sites.length / refs.length : null;

  console.log('  ' + d + '  ' + oracle.analogy_class + '  ops=' + ops.length
    + '  decision=' + out.decision);
  console.log('      reference lines  ' + JSON.stringify(refs));
  console.log('      derived sites    ' + JSON.stringify(out.sites));
  if (out.decision === 'APPLY') {
    console.log('      concern          ' + out.resolved_concern
      + '   witness ' + JSON.stringify(out.resolution_witness));
    console.log('      recall ' + hit + '/' + refs.length + '   precision ' + useful + '/'
      + out.sites.length + '   inflation ' + (inflation === null ? 'n/a' : inflation.toFixed(2)));
    // Two-axis score per operation, against the nearest derived site.
    for (let i = 0; i < ops.length && i < blocks.length; i++) {
      const r = refs[i];
      if (r === undefined || r === null) continue;
      const op = describe(src, blocks[i], r);
      const near = out.sites.length
        ? out.sites.reduce((a, s) => (Math.abs(s - r) < Math.abs(a - r) ? s : a), out.sites[0]) : null;
      if (near === null) continue;
      const sc = scorePosition(src, op, near, r);
      console.log('      ' + ops[i].id + '  derived ' + near + ' vs ref ' + r + '   '
        + sc.position_result
        + '   legal ' + JSON.stringify(sc.legal_region)
        + '   selectivity ' + (sc.selectivity === null ? 'n/a' : sc.selectivity.toFixed(2))
        + '   gain ' + (sc.information_gain_bits === null ? 'n/a' : sc.information_gain_bits.toFixed(2) + ' bits'));
      rows.push({ task: d, op: ops[i].id, cls: oracle.analogy_class, result: sc.position_result,
        selectivity: sc.selectivity, gain: sc.information_gain_bits });
    }
  }
  console.log('');
  rows.push({ task: d, cls: oracle.analogy_class, decision: out.decision, recall, precision, inflation, summary: true });
}

// ---- headline
const tasks = rows.filter((r) => r.summary);
const applied = tasks.filter((r) => r.decision === 'APPLY');
const an = tasks.filter((r) => r.cls === 'analogy_specified');
const no = tasks.filter((r) => r.cls === 'no_supported_analogy');
const scored = rows.filter((r) => r.result);
const exact = scored.filter((r) => r.result === 'EXACT').length;
const equiv = scored.filter((r) => r.result === 'EQUIVALENT').length;
const invalid = scored.filter((r) => r.result === 'INVALID').length;

console.log('  ---- HEADLINE');
console.log('  coverage           ' + applied.length + '/' + tasks.length + ' tasks applied');
console.log('    on analogy       ' + an.filter((r) => r.decision === 'APPLY').length + '/' + an.length
  + '   <- TRUE APPLY: these have a relation to resolve');
console.log('    on no-analogue   ' + no.filter((r) => r.decision === 'APPLY').length + '/' + no.length
  + '   <- FALSE APPLY: these have none, so applying is an error');
console.log('  position result    EXACT ' + exact + '   EQUIVALENT ' + equiv + '   INVALID ' + invalid
  + '   (of ' + scored.length + ' scored operations)');
const gains = scored.map((r) => r.gain).filter((g) => g !== null && g !== undefined && isFinite(g));
if (gains.length) {
  console.log('  information gain   mean ' + (gains.reduce((a, b) => a + b, 0) / gains.length).toFixed(2)
    + ' bits over ' + gains.length + ' operations');
}
console.log('');
console.log('  SEMANTIC coverage is EXACT+EQUIVALENT; INFORMATIVE coverage is the gain. A run can be');
console.log('  fully semantic and carry no information, which is a different situation from a wrong');
console.log('  placement and must not be reported as the same number.');
