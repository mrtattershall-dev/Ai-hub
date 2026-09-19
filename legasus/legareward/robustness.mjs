// LEGAREWARD — PLACEMENT ROBUSTNESS, revision 2, measured over the variation that actually exists.
//
// REVISION 1 WAS MIS-SPECIFIED AND ITS OWN EVIDENCE CONVICTED IT. It permuted the ORDER OF THE NEW
// OPERATIONS and called that robustness. The asymmetry it was built to capture lives in a different
// variation entirely - the INSERTION POINT RELATIVE TO EXISTING CODE - so it reported
// `n < 10 and n != 3` and `n < 10` as equally robust and then demoted the self-defending guard, while the
// middle family had already measured 0.651 against 0.470 the other way.
//
// THE ADMISSIBILITY RULE THIS MODULE NOW ANSWERS TO:
//
//     A quality dimension is admissible only when the environmental variation it measures corresponds to
//     a REAL DEPLOYMENT VARIATION or an independently justified objective.
//
// The variation here is real: files get edited, and a guard's neighbours move. So the measure is
//
//     of all the positions this guard could sit at in the unit, at how many does the WHOLE CONTRACT
//     still hold?
//
// which is a statement about how much freedom the rest of the system retains. A realization correct at
// more positions constrains future arrangement less. That is robustness to AUTHORIZED variation.
//
// IT IS NOT DEFENSIVENESS AGAINST ARBITRARY MUTATION, and the distinction is enforced by a negative
// control rather than by intention: a clause excluding a value no behaviour in the unit ever claims
// (`n != 999`) buys no additional position, so it must score exactly the same. Without that control this
// dimension would degenerate into REWARD EXTRA GUARDS and bloat every candidate it touched.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

function runProgram(program, inputs) {
  const ws = mkdtempSync(join(tmpdir(), 'robust-'));
  writeFileSync(join(ws, 'impl.py'), program + NL, 'utf8');
  writeFileSync(join(ws, 'p.py'), L('import impl',
    ...inputs.map((v, i) => 'print("r' + i + '=" + str(impl.classify(' + JSON.stringify(v) + ')))')), 'utf8');
  const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 20000 });
  const m = new Map();
  inputs.forEach((v, i) => {
    const mm = out.match(new RegExp('^r' + i + '=(.*)$', 'm'));
    m.set(v, mm ? mm[1].trim() : 'MISSING');
  });
  return m;
}

// Every position the guard could occupy inside the unit body: before the first statement, between any two,
// and after the last. The signature line is not a position.
export function insertionPositions(srcLines) {
  const body = srcLines.slice(1);
  const out = [];
  for (let i = 0; i <= body.length; i++) out.push(i);
  return out;
}

function assembleAt(srcLines, guardLines, position) {
  const head = srcLines.slice(0, 1);
  const body = srcLines.slice(1);
  return L(...head, ...body.slice(0, position), ...guardLines, ...body.slice(position));
}

// `expected` is the ground truth from the CONTRACT: a Map from input to required answer. It is supplied by
// the caller, never derived from the candidate - a robustness measure that read its answers off the
// candidate would report every candidate perfectly robust.
export function placementRobustness({ srcLines, guardLines, inputs, expected }) {
  const positions = insertionPositions(srcLines);
  let correct = 0;
  const detail = [];
  for (const p of positions) {
    const program = assembleAt(srcLines, guardLines, p);
    let ok = false;
    try {
      const got = runProgram(program, inputs);
      ok = inputs.every((v) => got.get(v) === expected.get(v));
    } catch (e) { ok = false; }
    if (ok) correct++;
    detail.push({ position: p, ok });
  }
  return { correct, legal: positions.length, fraction: correct / positions.length, detail };
}

export { NL, L };
