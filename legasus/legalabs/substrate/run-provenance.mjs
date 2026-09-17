// Scores a selector against the sealed provenance family and its pre-registered expectations.
//
// Takes the selector module as an argument so the SAME scorer runs v2 and v5. A scorer rewritten
// between the baseline and the treatment measures the rewrite.
//
//     node run-provenance.mjs ../../legaparse/selectv2.mjs
//
// The selector sees task.json and the source. The scorer sees the oracle and EXPECTED.json. Any leak
// in the other direction turns this into a demonstration.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { scorePosition } from '../../legaparse/siteclass.mjs';
import { verifyFamily } from './seal.mjs';

const NL = String.fromCharCode(10);
const DIR = './provenance';
const SEL = process.argv[2] || '../../legaparse/selectv2.mjs';
const { selectSites } = await import(SEL);

const seal = verifyFamily(DIR, join(DIR, 'MANIFEST.sealed.json'));
if (!seal.ok) { console.log('  SEAL BROKEN - refusing to score'); process.exit(1); }
const EXP = JSON.parse(readFileSync(join(DIR, 'EXPECTED.json'), 'utf8'));
console.log('  selector: ' + SEL);
console.log('  seal intact: ' + seal.n + ' task(s) byte-identical to ' + seal.sealed_at);
console.log('');

function refLine(src, anchor) {
  const at = src.indexOf(anchor);
  if (at < 0) return null;
  return src.slice(0, at + anchor.length - 1).split(NL).length - 1;
}
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
const scored = [];
for (const spec of EXP.tasks) {
  const d = spec.id;
  if (!existsSync(join(DIR, d, 'task.json'))) continue;
  const task = JSON.parse(readFileSync(join(DIR, d, 'task.json'), 'utf8'));
  const oracle = JSON.parse(readFileSync(join(DIR, d, 'evidence', 'oracle.json'), 'utf8'));
  const srcName = readdirSync(join(DIR, d, 'source'))[0];
  const src = readFileSync(join(DIR, d, 'source', srcName), 'utf8');

  const out = selectSites(task, src);
  const applied = out.decision === 'APPLY';
  const wanted = spec.expected_decision === 'APPLY';
  const ops = oracle.transaction.operations;
  const refs = ops.map((o) => refLine(src, o.site_hint)).filter((x) => x !== null);
  const patch = readFileSync(join(DIR, d, 'evidence', 'reference.patch'), 'utf8');
  const blocks = patch.split(/^--- op .*$/m).slice(1).map((b) => b.replace(/^\n/, ''));

  // DECISION is scored first and separately. A right answer reached by the wrong concern is not a
  // right answer, so concern identity is checked too and reported apart from the decision.
  const decisionOk = applied === wanted;
  const concernOk = !applied ? null
    : (spec.expected_concern ? out.resolved_concern === spec.expected_concern : null);
  const inflation = applied && refs.length ? out.sites.length / refs.length : null;

  let mark = decisionOk ? 'ok  ' : 'MISS';
  if (decisionOk && applied && concernOk === false) mark = 'WRONG';
  console.log('  ' + mark + '  ' + d + '  control ' + spec.control + '  want '
    + spec.expected_decision + ', got ' + out.decision);
  if (applied) {
    console.log('        concern ' + out.resolved_concern
      + (spec.expected_concern ? '   expected ' + spec.expected_concern : '')
      + (concernOk === false ? '   <- WRONG CONCERN' : ''));
    console.log('        sites ' + JSON.stringify(out.sites) + '  refs ' + JSON.stringify(refs)
      + '   inflation ' + (inflation === null ? 'n/a' : inflation.toFixed(2))
      + (spec.expected_required_sites ? '   required ' + spec.expected_required_sites : ''));
    for (let i = 0; i < ops.length && i < blocks.length; i++) {
      const r = refs[i];
      if (r === undefined || r === null || !out.sites.length) continue;
      const op = describe(src, blocks[i], r);
      const near = out.sites.reduce((a, s) => (Math.abs(s - r) < Math.abs(a - r) ? s : a), out.sites[0]);
      const sc = scorePosition(src, op, near, r);
      scored.push(sc);
    }
  }
  rows.push({ id: d, control: spec.control, wanted, applied, decisionOk, concernOk, inflation });
}

// ---- headline, against the pre-registered targets
const applyExpected = rows.filter((r) => r.wanted);
const abstainExpected = rows.filter((r) => !r.wanted);
const coverage = applyExpected.filter((r) => r.applied && r.concernOk !== false).length;
const nonOverreach = abstainExpected.filter((r) => !r.applied).length;
const infl = rows.map((r) => r.inflation).filter((x) => x !== null).sort((a, b) => a - b);
const median = infl.length ? (infl.length % 2 ? infl[(infl.length - 1) / 2]
  : (infl[infl.length / 2 - 1] + infl[infl.length / 2]) / 2) : null;
const gains = scored.map((s) => s.information_gain_bits).filter((g) => g !== null && isFinite(g));
const positive = gains.filter((g) => g > 0).length;
const good = scored.filter((s) => s.position_result !== 'INVALID').length;

const line = (name, got, target, pass) => console.log('  ' + name.padEnd(34) + String(got).padEnd(18)
  + 'target ' + String(target).padEnd(16) + (pass ? 'MET' : 'not met'));
console.log('');
console.log('  ---- AGAINST PRE-REGISTERED TARGETS');
line('non-overreach', nonOverreach + '/' + abstainExpected.length, '>= 5/6', nonOverreach >= 5);
line('coverage (right concern)', coverage + '/' + applyExpected.length, '>= 4/6', coverage >= 4);
line('median candidate inflation', median === null ? 'n/a' : median.toFixed(2), '<= 1.25', median !== null && median <= 1.25);
line('information gain positive', positive + '/' + gains.length, '> half', gains.length ? positive > gains.length / 2 : false);
line('exact or equivalent', good + '/' + scored.length, '>= 80%', scored.length ? good / scored.length >= 0.8 : false);
console.log('');
console.log('  A wrong-concern APPLY is NOT counted as coverage. Reaching the right decision through');
console.log('  the wrong concern is the failure this family was built to expose.');
