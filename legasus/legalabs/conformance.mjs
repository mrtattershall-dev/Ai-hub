// CONFORMANCE AUDIT against the contract in legasus/SUPPORTED.md.
//
// The standard is: within the declared supported classes, every authority decision is justified, every
// missing fact is declared, every constraint is replayable, and NO KNOWN UNSUPPORTED CONDITION
// SILENTLY MASQUERADES AS SUCCESS.
//
// That last clause is the one that cannot be checked by reading code, so it is checked by running it
// over every sealed family. A standard that is only written down is a reminder, and this project's
// hazard ledger has four occurrences proving reminders fail.
//
// SEVEN PROPERTIES, each of which can fail independently:
//
//   P1  WITNESSED          every narrowing carries a witness object
//   P2  REPLAYABLE         every witness independently re-derives its own claim
//   P3  NO OVER-CONSTRAINT every removed boundary genuinely fails when executed
//   P4  STYLE ZERO         canonical_realization never narrows and never claims gain
//   P5  ACCOUNTED          every immediate requirement appears as resolved OR unresolved - none
//                          silently vanishes between extraction and reporting
//   P6  NO SHADOWED LOSS   no token dropped by the builtin stoplist is actually bound in the program.
//                          If a program defines its own `round`, treating it as a builtin loses a real
//                          requirement with nothing reporting the loss - silent information loss of
//                          exactly the kind this audit exists to catch.
//   P7  UNSUPPORTED VISIBLE an operation that depends on a declared-unsupported form must NOT report
//                          requirement_complete: true
//   P8  CHANNEL COMPLETE   every removed boundary fails on AT LEAST ONE channel - behavioural or
//                          structural - and the audit says which one answered
//
// P3 AND P8 ARE DELIBERATELY BOTH HERE, AND P8 DOES NOT RESCUE P3.
//
// `failing_positions` means different things in different families. V1 ground truth is behavioural
// only, so a position that executes fine while re-parenting existing statements is sealed as passing,
// and a correct structural rule that removes it scores as an over-constraint. `scopecont/j01:op3` is
// exactly that, and LEGACORE_REV6.frozen records it as an open failure with the remedy named: stronger
// probes, NEVER a weaker rule.
//
// P8 is that stronger probe, run now instead of waiting for a future family. It adjudicates each
// removal on both channels and records which one answered. P3 keeps its frozen meaning and keeps
// failing, because a recorded failure that disappears the moment its adjudication improves is not a
// fix - it is a score obtained by changing the rule after seeing the result. Two properties, two
// verdicts, both visible.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { constrain, verify } from '../legacore/constraints6.mjs';
import { operationFacts } from '../legacore/opfacts.mjs';
import { buildContext } from '../legacore/opcontext.mjs';
import { reconstruct, baseFor } from './substrate/narrowability.mjs';
import { adjudicateRemoval, oracleVersion } from './adjudicate.mjs';

const NL = String.fromCharCode(10);
const ind = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
const ROOT = 'C:/Users/tatte/Projects/ai-coding-hub-indent/legasus/legalabs/substrate/';
const FAMILIES = process.argv.slice(2);
const families = FAMILIES.length ? FAMILIES
  : ['family', 'holdout', 'provenance', 'generalization', 'requirements', 'unresolved', 'scopecont', 'scopeself'];

// Declared-unsupported provider forms, detected in the text an operation is placed into.
const UNSUPPORTED = [
  { id: 'import', re: /^\s*(?:import\s+\w+|from\s+[\w.]+\s+import\b)/m },
  { id: 'star_import', re: /^\s*from\s+[\w.]+\s+import\s+\*/m },
  { id: 'inheritance', re: /^\s*class\s+\w+\s*\([^)]*\w[^)]*\)\s*:/m },
  { id: 'dynamic_provision', re: /\b(?:setattr|globals|locals|exec|eval)\s*\(/ },
];

// The stoplist revision 3's extractor applies. Re-declared here on purpose: if the audit imported it,
// a change to the stoplist would change the audit in the same direction and P6 could never fail.
const STOPLIST = ['len', 'str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'sum', 'max',
  'min', 'abs', 'sorted', 'reversed', 'range', 'print', 'round', 'enumerate', 'zip', 'isinstance',
  'type', 'repr', 'Exception', 'ValueError', 'TypeError', 'KeyError', 'AssertionError'];

const problems = [];
const note = (p, fam, op, detail) => problems.push({ property: p, family: fam, op, detail });
let opsAudited = 0;
let famAudited = 0;
const adjudications = [];

for (const fam of families) {
  const dir = ROOT + fam;
  if (!existsSync(join(dir, 'GROUNDTRUTH.json'))) continue;
  famAudited++;
  const GT = JSON.parse(readFileSync(join(dir, 'GROUNDTRUTH.json'), 'utf8'));
  for (const t of GT) {
    const tdir = join(dir, t.task);
    if (!existsSync(join(tdir, 'task.json'))) continue;
    const recon = reconstruct(tdir);
    for (let k = 0; k < t.rows.length; k++) {
      const row = t.rows[k];
      if (row.intra_line || row.error || !row.candidate_positions) continue;
      const base = baseFor(recon, k);
      if (base === null) continue;
      if (row.base_lines !== undefined && base.split(NL).length !== row.base_lines) {
        note('ALIGNMENT', fam, t.task + ':' + row.op, 'ground truth built against a different text');
        continue;
      }
      opsAudited++;
      // ONE context builder, shared with the scorer. Improvising it here is exactly what produced
      // seven phantom over-constraints on the first run of this audit: a whole-file parentRange let
      // control_flow_boundary find a terminator belonging to a different function entirely.
      const ctx = buildContext(recon, k, base, row, t.task);
      const code = ctx.code;
      const facts = ctx.facts;
      const res = constrain(ctx, row.candidate_positions);
      const rep = verify(ctx, res.chain);
      const id = t.task + ':' + row.op;

      // P1
      for (const c of res.chain) {
        if ((c.removed_positions || []).length && !c.witness) note('P1', fam, id, c.kind + ' narrowed without a witness');
      }
      // P2
      for (const r of rep.results) if (!r.replayed) note('P2', fam, id, r.kind + ': ' + r.why);
      // P3 - the frozen property, behavioural ground truth, unchanged.
      // P8 - the same removals, adjudicated on both channels, reported separately.
      const failing = new Set(row.failing_positions || []);
      for (const c of res.chain) {
        for (const p of (c.removed_positions || [])) {
          if (failing.has(p)) continue;
          note('P3', fam, id, c.kind + ' removed boundary after line ' + p + ', which executes fine');
          const a = adjudicateRemoval({ base, code, position: p, row });
          adjudications.push({ fam, id, kind: c.kind, position: p, ...a });
          if (a.verdict === 'over_constraint') {
            note('P8', fam, id, c.kind + ' removed boundary after line ' + p
              + ', legal on BOTH channels (' + a.oracle + ' seal, ' + a.channel + ')');
          }
        }
      }
      // P4
      for (const c of res.chain) {
        if (c.kind !== 'canonical_realization') continue;
        if ((c.removed_positions || []).length || c.gain_bits > 0) note('P4', fam, id, 'style narrowed or claimed gain');
      }
      // P5
      const accounted = new Set([
        ...res.requirement_resolution.resolved.map((r) => r.symbol),
        ...res.requirement_resolution.unresolved.map((r) => r.symbol)]);
      for (const s of facts.requires_immediate) {
        if (!accounted.has(s)) note('P5', fam, id, 'immediate requirement `' + s + '` appears in neither resolved nor unresolved');
      }
      // P6
      const bound = (sym) => new RegExp('^(?:def\\s+' + sym + '\\b|class\\s+' + sym + '\\b|' + sym + '\\s*=(?!=))', 'm').test(base);
      const mentioned = (sym) => new RegExp('\\b' + sym + '\\b').test(code);
      for (const s of STOPLIST) {
        if (mentioned(s) && bound(s)) {
          note('P6', fam, id, '`' + s + '` is on the builtin stoplist AND bound in this program - a real requirement is being dropped with nothing reporting it');
        }
      }
      // P7
      const unsup = UNSUPPORTED.filter((u) => u.re.test(base)).map((u) => u.id);
      if (unsup.length && res.constraint_status.requirement_complete
        && facts.requires_immediate.length) {
        // Only a violation if a requirement actually could come from the unsupported form: if every
        // requirement resolved to a binding the program really contains, completeness is honest.
        const allLocal = res.requirement_resolution.resolved.every((r) => r.line >= 0);
        if (!allLocal) note('P7', fam, id, 'declares requirement_complete with unsupported forms present: ' + unsup.join(', '));
      }
    }
  }
}

const byProp = new Map();
for (const p of problems) byProp.set(p.property, (byProp.get(p.property) || 0) + 1);

console.log('  CONFORMANCE AUDIT against legasus/SUPPORTED.md');
console.log('  families ' + famAudited + '   operations audited ' + opsAudited);
console.log('');
const NAMES = {
  P1: 'WITNESSED           every narrowing carries a witness',
  P2: 'REPLAYABLE          every witness re-derives its own claim',
  P3: 'NO OVER-CONSTRAINT  every removed boundary genuinely fails',
  P4: 'STYLE ZERO          style never narrows and never claims gain',
  P5: 'ACCOUNTED           every immediate requirement is resolved or declared unresolved',
  P6: 'NO SHADOWED LOSS    no stoplisted token is actually bound in the program',
  P7: 'UNSUPPORTED VISIBLE unsupported forms never report a complete account',
  P8: 'CHANNEL COMPLETE    every removed boundary fails on at least one channel',
  ALIGNMENT: 'ALIGNMENT           ground truth and derivation share one text',
};
for (const key of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'ALIGNMENT']) {
  const n = byProp.get(key) || 0;
  console.log('  ' + (n ? 'FAIL  ' : 'ok    ') + NAMES[key] + (n ? '   ' + n + ' violation(s)' : ''));
}
if (problems.length) {
  console.log('');
  for (const p of problems.slice(0, 30)) {
    console.log('    ' + p.property + '  ' + p.family + '/' + p.op + '  ' + p.detail);
  }
  if (problems.length > 30) console.log('    ... ' + (problems.length - 30) + ' more');
  process.exitCode = 1;
}
if (adjudications.length) {
  console.log('');
  console.log('  ADJUDICATION of every P3 removal, on both channels. A V1 seal could not see');
  console.log('  structural destruction, so the structural channel is run live for those - and the');
  console.log('  verdict carries the witness it produced, never a bare assertion.');
  for (const a of adjudications) {
    console.log('    ' + a.fam + '/' + a.id + '  ' + a.kind + ' after line ' + a.position);
    console.log('      ' + a.verdict.toUpperCase() + '  via ' + a.channel + ' (' + a.oracle + ' seal): ' + a.why);
    for (const w of (a.witness || [])) {
      console.log('      witness: ' + w.kind + '  `' + w.statement + '`'
        + (w.was ? '  was under ' + JSON.stringify(w.was) + ' now ' + JSON.stringify(w.now) : ''));
    }
  }
}
console.log('');
console.log('  A standard that is only written down is a reminder. This runs it.');
