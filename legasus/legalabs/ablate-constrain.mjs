// ABLATING CONSTRAIN — is the authority envelope redundant with the verifier?
//
// The ordering ablation cost nothing and produced the largest separation in the project: 105 verified
// under the derived order, 0 under presentation order. `CONSTRAIN` has never had that treatment. Its
// value has only ever been shown by ACCIDENT - an envelope defect that refused `elif` and suppressed
// yield across every model at once.
//
// THE DIRECT QUESTION: for every output the envelope REFUSED, what would have happened if it had not?
//
//   PROVE_WOULD_CATCH   a permissive envelope admits it, the contract probes reject it
//                       -> CONSTRAIN is redundant but cheap: it catches early what PROVE catches late
//   PROVE_WOULD_MISS    a permissive envelope admits it, the contract probes ACCEPT it
//                       -> CONSTRAIN refused a SEMANTICALLY CORRECT program. This is the
//                          over-constraint signal, hazard 3e with data rather than an anecdote
//   UNASSEMBLABLE       no guard and return can be extracted at all
//                       -> CONSTRAIN is catching something PROVE cannot even be run on
//
// WHAT THIS IS NOT. Extracting a fragment from inside a returned function is not a proposal to REPAIR
// unauthorized output - this project refuses repair, because repairing moves authority back to the
// apparatus and makes the measurement unreadable. It is a measurement of what the refused outputs
// CONTAINED, which is a different question from what should be done with them.
//
// THE SHAPES ARE RE-DECLARED HERE ON PURPOSE. If this audit imported them from the harness, a change to
// the harness would move the audit in the same direction and the audit could never disagree with it -
// the same reasoning that keeps the conformance stoplist re-declared.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existingBehaviours, requestedBehaviour } from '../legacore/predicates.mjs';
import { overlap } from '../legacore/overlap.mjs';
import { derivePrecedence } from '../legacore/precedence.mjs';
import { contractProbes, checkProbes } from '../legaverify/probes.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);
const FILES = process.argv.slice(2);
if (!FILES.length) { console.log('usage: ablate-constrain.mjs <RESULT json> [...]'); process.exit(1); }

const SHAPES = {
  S_UPPER: { lines: ['def classify(n):', '    if n == 3:', '        return "three"',
    '    if n > 100000:', '        return "vast"', '    return "other"'],
  preservedCond: 'n == 3', domainPhrase: 'below 10', result: '"small"' },
  S_LOWER: { lines: ['def classify(n):', '    if n == 200:', '        return "twohundred"',
    '    if n < 0:', '        return "negative"', '    return "other"'],
  preservedCond: 'n == 200', domainPhrase: 'above 100', result: '"big"' },
  S_IVAL: { lines: ['def classify(n):', '    if n < 0:', '        return "negative"',
    '    if n > 100000:', '        return "vast"', '    return "other"'],
  preservedCond: 'n < 0', domainPhrase: 'below 10', result: '"small"' },
  S_STRADDLE: { lines: ['def classify(n):', '    if n > 5:', '        return "big"', '    return "other"'],
  preservedCond: 'n > 5', domainPhrase: 'below 10', result: '"small"' },
};

function planShape(key) {
  const s = SHAPES[key];
  const src = s.lines.join(NL);
  const preserved = existingBehaviours(src, 'classify').find((b) => b.condition === s.preservedCond);
  const delta = 'For values ' + s.domainPhrase + ', return ' + s.result + '.';
  const req = requestedBehaviour(delta, 'n', { soleParameter: true });
  const prec = derivePrecedence({ preservation_text: 'Preserve the existing special handling.',
    delta_text: delta, existing: { condition: preserved.condition, result: preserved.result },
    requested: { condition: req.condition, result: req.result } }, overlap(preserved.domain, req.domain));
  const before = prec.winner === 'requested';
  return { s, src, lines: s.lines, preserved, req, prec,
    insertAfter: before ? preserved.line - 1 : preserved.line + 1 };
}

// THE PERMISSIVE ENVELOPE. Everything the real one refuses is allowed: a guard and a return are taken
// from anywhere in the output, including from inside a returned function, and a repeated fixed line is
// not an objection. This is the ablation - CONSTRAIN with its rules removed.
function permissiveExtract(raw) {
  const fence = String(raw).match(/```(?:python)?\s*([\s\S]*?)```/);
  const lines = (fence ? fence[1] : String(raw)).split(NL);
  let guard = null;
  for (const line of lines) {
    const one = line.match(/^\s*((?:el)?if\s[^:]*:)\s*(return\s.*)$/);
    if (one) return { guard: one[1].replace(/^elif\b/, 'if'), ret: one[2].trim() };
    if (!guard) {
      const g = line.match(/^\s*((?:el)?if\s.*:)\s*$/);
      if (g) { guard = g[1].replace(/^elif\b/, 'if'); continue; }
    } else {
      const r = line.match(/^\s*(return\s.*?)\s*$/);
      if (r) return { guard, ret: r[1] };
    }
  }
  return null;
}

function runProgram(program, inputs) {
  const ws = mkdtempSync(join(tmpdir(), 'abc-'));
  writeFileSync(join(ws, 'impl.py'), program + NL, 'utf8');
  writeFileSync(join(ws, 'p.py'), L('import impl',
    ...inputs.map((v, i) => 'print("r' + i + '=" + str(impl.classify(' + v + ')))')), 'utf8');
  try {
    const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 15000 });
    const m = new Map();
    inputs.forEach((v, i) => {
      const mm = out.match(new RegExp('^r' + i + '=(.*)$', 'm'));
      m.set(v, mm ? mm[1].trim() : 'MISSING');
    });
    return m;
  } catch (e) { return null; }
}

const origCache = new Map();
function originalFor(p) {
  return (v) => {
    const k = p.s.preservedCond + '|' + v;
    if (!origCache.has(k)) {
      const m = runProgram(p.src, [v]);
      origCache.set(k, m ? m.get(v) : 'ERROR');
    }
    return origCache.get(k);
  };
}

const probeCache = new Map();
function probesFor(key, p) {
  if (!probeCache.has(key)) {
    probeCache.set(key, contractProbes({ requested: p.req.domain,
      requestedResult: p.req.result.replace(/"/g, ''), preserved: p.preserved.domain,
      preservedWins: p.prec.winner === 'existing',
      existing: existingBehaviours(p.src, 'classify') }, originalFor(p)));
  }
  return probeCache.get(key);
}

const tally = {};
const examples = {};
for (const f of FILES) {
  const data = JSON.parse(readFileSync(f, 'utf8'));
  for (const [cellKey, cell] of Object.entries(data.cells)) {
    const shape = cell.shape;
    if (!shape || !SHAPES[shape]) continue;
    const p = planShape(shape);
    const probes = probesFor(shape, p);
    for (const row of cell.rows || []) {
      if (row.authorized !== false) continue;
      const reason = row.reason || 'unknown';
      const t = tally[reason] = tally[reason] || { total: 0, catch: 0, miss: 0, unassemblable: 0, truncated: 0 };
      t.total++;
      // A raw stored at exactly the truncation limit may be unassemblable BECAUSE it was truncated.
      // Counting those as "CONSTRAIN caught something PROVE cannot run" would credit the envelope for
      // an artifact of the recording, so they are held out and reported rather than classified.
      const raw = row.raw || '';
      const ex = permissiveExtract(raw);
      if (!ex) {
        if (raw.length >= 139) { t.truncated++; continue; }
        t.unassemblable++;
        continue;
      }
      const code = '    ' + ex.guard + NL + '        ' + ex.ret;
      const program = L(...p.lines.slice(0, p.insertAfter + 1), ...code.split(NL),
        ...p.lines.slice(p.insertAfter + 1));
      const res = runProgram(program, probes.map((x) => x.input));
      const ok = res ? checkProbes(probes, (v) => res.get(v)).passed : false;
      if (ok) {
        t.miss++;
        const k = reason + ' :: ' + ex.guard + ' ' + ex.ret;
        examples[k] = (examples[k] || 0) + 1;
      } else t.catch++;
    }
  }
}

console.log('  ABLATING CONSTRAIN - what would have happened if the envelope had not refused?');
console.log('  no GPU time: every refused output replayed is already on disk');
console.log('');
let T = 0; let C = 0; let M = 0; let U = 0; let TR = 0;
for (const [reason, t] of Object.entries(tally).sort((a, b) => b[1].total - a[1].total)) {
  console.log('  ' + reason);
  console.log('      refused ' + String(t.total).padStart(3)
    + '   PROVE would CATCH ' + String(t.catch).padStart(3)
    + '   PROVE would MISS ' + String(t.miss).padStart(3)
    + '   unassemblable ' + String(t.unassemblable).padStart(3)
    + '   raw truncated ' + t.truncated);
  T += t.total; C += t.catch; M += t.miss; U += t.unassemblable; TR += t.truncated;
}
console.log('');
console.log('  TOTAL refused ' + T + '   PROVE would catch ' + C + '   PROVE would MISS ' + M
  + '   unassemblable ' + U + '   held out as truncated ' + TR);
if (M) {
  console.log('');
  console.log('  REFUSED OUTPUTS THAT WOULD HAVE VERIFIED - the over-constraint signal:');
  for (const [k, n] of Object.entries(examples).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log('      ' + String(n).padStart(3) + 'x  ' + k);
  }
}
console.log('');
console.log('  MISS means the envelope discarded a semantically correct program. CATCH means it merely');
console.log('  saved the verifier a run. UNASSEMBLABLE means it caught something the verifier could not');
console.log('  have been pointed at. Those are three different justifications and only one of them is');
console.log('  a defect.');
