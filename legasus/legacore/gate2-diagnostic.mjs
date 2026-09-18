// GATE 2 — find every case where the SUPPORTED core is not perfect.
//
// Two classes are sought, and the second is the one that hides:
//
//   A  expected supported behaviour != observed behaviour
//   B  the correct result reached with an INCOMPLETE account
//
// Class B is what h07 was: a correct region derived while a requirement was silently dropped. A suite
// that only checks outcomes cannot see it.
//
// INTENTIONALLY UNSUPPORTED cases are NOT counted as failures of supported capability. An operation
// whose requirement is import-reachable, and which says so, is the architecture behaving correctly.
// They are listed separately so the distinction stays visible rather than being buried in a total.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { constrain, verify } from './constraints6.mjs';
import { buildContext } from './opcontext.mjs';
import { reconstruct, baseFor } from '../legalabs/substrate/narrowability.mjs';

const NL = String.fromCharCode(10);
const ROOT = 'C:/Users/tatte/Projects/ai-coding-hub-indent/legasus/legalabs/substrate/';
const FAMS = ['provenance', 'generalization', 'requirements', 'unresolved'];

// DECLARED SEMANTIC-INTENT CASES. Read from one committed register rather than hard-coded here, so
// the justification travels with the classification. A residual listed there is NOT a structural
// defect and must not be counted as one - and an entry without a stated reason is an excuse.
const SI = JSON.parse(readFileSync(
  'C:/Users/tatte/Projects/ai-coding-hub-indent/legasus/SEMANTIC_INTENT.json', 'utf8'));
const isSemanticIntent = (fam, op) => SI.cases.find((c) => c.family === fam && c.op === op);

const findings = [];
const add = (cls, fam, op, detail, extra) => findings.push({ class: cls, fam, op, detail, ...extra });

for (const fam of FAMS) {
  const dir = ROOT + fam;
  if (!existsSync(join(dir, 'GROUNDTRUTH.json'))) continue;
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
      const ctx = buildContext(recon, k, base, row, t.task);
      const res = constrain(ctx, row.candidate_positions);
      const rep = verify(ctx, res.chain);
      const id = t.task + ':' + row.op;
      const complete = res.constraint_status.requirement_complete;
      const unresolvedSyms = res.requirement_resolution.unresolved.map((u) => u.symbol);

      // ---- A: outcome disagreements
      const failing = new Set(row.failing_positions || []);
      const removed = res.chain.flatMap((c) => c.removed_positions || []);
      const wrongly = removed.filter((p) => !failing.has(p));
      if (wrongly.length) {
        add('A-OVER-CONSTRAINT', fam, id, wrongly.length + ' boundary(ies) removed that execute fine');
      }
      if (row.narrowable && !removed.length) {
        // A miss is only a SUPPORTED failure if nothing was declared unsupported. If a requirement is
        // unresolved, the architecture has correctly said it cannot account for this.
        if (complete) {
          add('A-MISSED-SUPPORTED', fam, id,
            'narrowable, nothing derived, and the account claims to be complete',
            { available_bits: row.max_gain_bits });
        } else {
          add('U-DECLARED-UNSUPPORTED', fam, id,
            'narrowable and nothing derived, but declared incomplete: ' + unresolvedSyms.join(', '),
            { available_bits: row.max_gain_bits });
        }
      }
      if (!rep.all_replayed) {
        add('A-REPLAY', fam, id, rep.results.filter((r) => !r.replayed).map((r) => r.kind).join(', '));
      }

      // ---- B: right answer, incomplete account.
      //
      // An incomplete account is only a SUPPORTED failure when the unresolved symbol is something the
      // declared universe covers. A name bound by the ENCLOSING FUNCTION - a parameter or a local of
      // the unit the operation is inserted into - is squarely inside the supported scope model, so
      // failing to resolve it is a real defect. A name reachable only through an import is declared
      // unsupported and its incompleteness is the architecture working.
      const encl = (sym) => {
        const pr = ctx.parentRange;
        if (!pr) return false;
        const lines = base.split(NL);
        // the unit header sits just above its body range
        for (let i = pr.lo - 1; i >= 0 && i >= pr.lo - 2; i--) {
          const m = (lines[i] || '').match(/^\s*def\s+\w+\s*\(([^)]*)\)/);
          if (m && new RegExp('\\b' + sym + '\\b').test(m[1])) return 'parameter of the enclosing unit';
        }
        for (let i = pr.lo; i <= pr.hi && i < lines.length; i++) {
          if (new RegExp('^\\s*' + sym + '\\s*=(?!=)').test(lines[i] || '')) return 'local of the enclosing unit';
        }
        return false;
      };
      const exact = res.constrained === row.passing;
      if (exact && !complete) {
        const supportedMisses = unresolvedSyms.map((s) => [s, encl(s)]).filter(([, w]) => w);
        if (supportedMisses.length) {
          add('B-SUPPORTED-INCOMPLETE', fam, id,
            'correct region, but unresolved symbols the supported scope model should have found: '
            + supportedMisses.map(([s, w]) => '`' + s + '` (' + w + ')').join(', '));
        } else {
          add('U-INCOMPLETE-BY-DESIGN', fam, id,
            'correct region, incomplete for a DECLARED-UNSUPPORTED reason: ' + unresolvedSyms.join(', '));
        }
      }
      // Partial narrowing that is nonetheless honest: recovered some, left some, account complete.
      if (row.narrowable && removed.length && !exact && !wrongly.length && complete) {
        const got = Math.log2(row.candidates / res.constrained);
        // Name the surviving positions so the residual can be diagnosed rather than guessed at. A
        // residual is not automatically a structural defect - g03's was semantic intent.
        const survivors = res.region.filter((p) => failing.has(p));
        const lines = base.split(NL);
        const si = isSemanticIntent(fam, id);
        add(si ? 'S-SEMANTIC-INTENT' : 'A-UNDER-NARROWED', fam, id,
          (si ? 'residual is ' + si.kind + ': ' + si.ambiguous_input + '. '
            : 'narrowed honestly but incompletely while claiming completeness; ')
          + 'survivors that really fail: '
          + survivors.map((p) => p + ' ' + JSON.stringify((lines[p] || '').trim().slice(0, 34))).join('  '),
          { got_bits: +got.toFixed(2), available_bits: +row.max_gain_bits.toFixed(2) });
      }
    }
  }
}

const byClass = new Map();
for (const f of findings) byClass.set(f.class, (byClass.get(f.class) || 0) + 1);

console.log('  GATE 2 DIAGNOSTIC - supported-core imperfections');
console.log('');
for (const [k, v] of [...byClass].sort()) console.log('  ' + String(v).padStart(3) + '  ' + k);
if (!findings.length) console.log('  none');
console.log('');
for (const f of findings) {
  console.log('  ' + f.class.padEnd(24) + (f.fam + '/' + f.op).padEnd(28) + f.detail
    + (f.available_bits !== undefined ? '   [' + (f.got_bits !== undefined ? f.got_bits + ' of ' : '')
      + f.available_bits + ' bits available]' : ''));
}
console.log('');
console.log('  A-* are supported-capability failures. S-* sit at the semantic-intent boundary and are');
console.log('  NOT structural defects. U-* are the architecture correctly declaring a');
console.log('  gap and are NOT counted against supported capability. B-* are correct outcomes resting');
console.log('  on an incomplete proof - the class a suite checking only outcomes cannot see.');
