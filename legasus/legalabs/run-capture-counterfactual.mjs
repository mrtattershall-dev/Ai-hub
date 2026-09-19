// RENDERING THE SIBLING FACTS — is DECIDE substitutable if the model is simply TOLD what it is missing?
//
// The specificity family established that no realization ever defended against a sibling operation:
// 0 of 648 guards, flat across 1.5B, 7B and 14B, while defence against the PRESERVED fact - which every
// prompt names - rose 48% -> 78% -> 96% over the same models. The law proposed from that:
//
//     A realization can defend itself only against facts its own prompt names.
//
// That law is cheap to state and risky to test, because it predicts the zero is about INFORMATION and
// not about capability. So this family names the sibling facts and re-runs.
//
// WHAT IS GIVEN, AND WHAT IS WITHHELD. The model is told the other requested behaviours exist and what
// their domains and results are. It is NOT told the order, and it is NOT told which one wins on overlap.
// That is the whole point: DECIDE's INPUTS are handed over, DECIDE's CONCLUSION is not. Handing over the
// conclusion would measure whether a model can follow an instruction, which is not in doubt.
//
// BOTH OUTCOMES ARE FINDINGS, and they say opposite things about the architecture:
//
//   rescue appears      the zero was about information. Given the facts, a realization CAN absorb what
//                       DECIDE does - and the dose-response gradient should appear with it, since
//                       surviving 3 violated edges needs more self-defence than surviving 1.
//   rescue stays zero   the law as stated is incomplete. The models do not reason about cross-operation
//                       composition even when handed the facts, and DECIDE's necessity is deeper than
//                       information access.
//
// THE COST MUST BE COUNTED, NOT HIDDEN. Naming the siblings invites the model to write them - scope
// creep that CONSTRAIN refuses. Operation yield and refusal reasons are reported per condition, because
// a rendering that buys self-defence by destroying yield has not bought anything.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existingBehaviours, requestedBehaviour } from '../legacore/predicates.mjs';
import { overlap } from '../legacore/overlap.mjs';
import { derivePrecedence } from '../legacore/precedence.mjs';
import { orderTransaction } from '../legacore/ordering.mjs';
import { leakageScan } from '../legacore/assemble.mjs';
import { promptSufficiency } from './sufficiency.mjs';
import { authorize, guardConditionOf } from '../legagate/envelope.mjs';
import { transactionProbes, reachability, reachabilityExecuted, auditResultLabels }
  from '../legaverify/transaction.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

const BASE = process.argv[2];
const SAMPLES = Number(process.argv[3] || 20);
const OUT = process.argv[4] || './RESULT.rendering.json';
const MODELS = (process.argv[5] || 'qwen2.5-coder:1.5b').split(',');
const TEMPERATURE = 0.6;
const CONTROL_ONLY = process.argv.includes('--control');
const MARKER = '    # >>> YOUR LINES GO HERE <<<';

const SRC_LINES = ['def classify(n):', '    if n == 3:', '        return "three"', '    return "other"'];
const SRC = SRC_LINES.join(NL);
const FIXED = new Set(SRC_LINES.map((l) => l.trim()));
const PRESERVED_COND = 'n == 3';

// EXTENT rendering throughout - the open end stated relationally, which three capacities have now shown
// is the strongest single lever available at RENDER.
// RESULT WORDS ARE CHOSEN SO THAT NONE IS A SUBSTRING OF ANOTHER, AND NONE APPEARS IN AN EXTENT
// PHRASE. The first draft used "small" and "tiny" with the extent phrase "however small", so the
// isolation control - which asserts a prompt never mentions the OTHER operation's result - fired on
// the adverb. That was a false positive in the control, but the collision was a real design smell:
// an experiment about whether the model is told about the other operation should not have to argue
// about whether an English adverb counts.
const OPS = {
  micro: { delta: 'For every value below 0, however small, return "micro".',
    result: 'micro', correct: 'if n < 0:', alt: 'if n <= -1:' },
  low: { delta: 'For every value below 10, however small, where n is not 3, return "low".',
    result: 'low', correct: 'if n < 10:', alt: 'if n < 10 and n != 3:' },
  mid: { delta: 'For every value below 100, however small, where n is not 3, return "mid".',
    result: 'mid', correct: 'if n < 100:', alt: 'if n < 100 and n != 3:' },
  five: { delta: 'For values exactly 5, return "five".',
    result: 'five', correct: 'if n == 5:', alt: 'if 5 == n:' },
  fifty: { delta: 'For values exactly 50, return "fifty".',
    result: 'fifty', correct: 'if n == 50:', alt: 'if 50 == n:' },
  high: { delta: 'For every value above 100, however large, return "high".',
    result: 'high', correct: 'if n > 100:', alt: 'if n >= 101:' },
  plus: { delta: 'For every value above 0, however large, where n is not 3, return "plus".',
    result: 'plus', correct: 'if n > 0:', alt: 'if n >= 1:' },
};

// Each presented order violates every derived edge the case has, so violated-constraint count is the
// dose: 0, 1, 2, 3.
const CASES = {
  E0: { ops: ['micro', 'fifty', 'high'], expect: 'ORDERED', edges: 0 },
  E1: { ops: ['low', 'micro', 'high'], expect: 'ORDERED', edges: 1 },
  E2: { ops: ['low', 'micro', 'five'], expect: 'ORDERED', edges: 2 },
  E3: { ops: ['mid', 'low', 'micro'], expect: 'ORDERED', edges: 3 },
  UND: { ops: ['low', 'plus', 'high'], expect: 'UNDETERMINED', edges: 0, generate: false,
    why: 'low and plus intersect without containment, so no order over the transaction is derivable'
      + ' and the whole transaction must be refused rather than partly committed' },
};

const preserved = existingBehaviours(SRC, 'classify').find((b) => b.condition === PRESERVED_COND);
const INSERT_AFTER = preserved.line + 1;      // the preserved behaviour wins, so the new guards follow it

function planCase(key) {
  const c = CASES[key];
  const reqs = c.ops.map((id) => {
    const o = OPS[id];
    const r = requestedBehaviour(o.delta, 'n', { soleParameter: true });
    return { id, domain: r.domain, result: o.result, condition: r.condition, delta: o.delta };
  });
  // Precedence against the PRESERVED behaviour, per operation, exactly as the single-operation families
  // derived it. Ordering BETWEEN the two requested behaviours is a separate derivation.
  const prec = reqs.map((r) => derivePrecedence({
    preservation_text: 'Preserve the existing special handling of three.', delta_text: r.delta,
    existing: { condition: preserved.condition, result: preserved.result },
    requested: { condition: r.condition, result: r.result } }, overlap(preserved.domain, r.domain)));
  const ord = orderTransaction(reqs);
  return { key, c, reqs, prec, ord, order: ord.order, orderBasis: ord.orderBasis || null };
}

// The sibling paragraph states the other requested behaviours as FACTS. It does not state an order and
// does not say which wins where they overlap - those are DECIDE's output, not its input.
function siblingParagraph(p, opId) {
  const others = p.c.ops.filter((id) => id !== opId);
  return L('These other behaviours are requested for the same function. They are being written',
    'separately and will be added to this same chain of conditions:',
    ...others.map((id) => '    ' + OPS[id].delta),
    'You are writing ONLY the behaviour requested above. Do not write these.');
}

// Says other behaviours are coming, and names NONE of them. If the collapse needs the specific domain
// to copy, this condition cannot produce it - which is what makes it the control that separates
// "another operation exists" from "another operation covers n < 0".
function existsParagraph(p, opId) {
  const others = p.c.ops.filter((id) => id !== opId);
  return L('There are ' + others.length + ' other behaviours requested for the same function. They are',
    'being written separately and will be added to this same chain of conditions.',
    'You are writing ONLY the behaviour requested above.');
}

// Names the siblings AND states the RESOLUTION: which of them is already handled before this line.
//
// This condition deliberately hands over DECIDE's CONCLUSION, which SIBLING_NAMED withheld. It is
// therefore NOT a test of substitutability - that question was already answered, and answered badly.
// It asks a different one: IS THE DAMAGE REPAIRABLE BY RENDERING? If stating the resolution restores
// correctness, DOMAIN COLLAPSE is caused by an ambiguity and RENDER has a rule. If the damage survives,
// sibling information is harmful in itself and RENDER has a stricter rule.
function resolvedParagraph(p, opId) {
  const others = p.c.ops.filter((id) => id !== opId);
  const earlier = others.filter((id) => p.order.indexOf(id) < p.order.indexOf(opId));
  const later = others.filter((id) => p.order.indexOf(id) > p.order.indexOf(opId));
  const lines = ['These other behaviours are requested for the same function and are being written',
    'separately:', ...others.map((id) => '    ' + OPS[id].delta), ''];
  if (earlier.length) {
    lines.push('Of those, the following are placed BEFORE your line and have already answered for',
      'their values by the time your condition is reached, so you do not need to exclude them:',
      ...earlier.map((id) => '    ' + OPS[id].delta));
  }
  if (later.length) {
    lines.push('The following are placed AFTER your line:', ...later.map((id) => '    ' + OPS[id].delta));
  }
  lines.push('Write your own condition exactly as requested above. Do not narrow it to match another',
    'behaviour, and do not write these other behaviours.');
  return L(...lines);
}

// THE COUNTERFACTUAL. Identical domain text, identical shape, identical narrowness, identical position,
// nearly identical length. The ONLY thing removed is the sibling's relevance to this function.
//
// Under IN_CHAIN a model that narrowed itself could at least be telling a wrong story about precedence:
// the sibling really is in the chain and really is inside its domain. Under ELSEWHERE there is no such
// story available - the sibling is in a different function and cannot constrain this line at all.
function elsewhereParagraph(p, opId) {
  const others = p.c.ops.filter((id) => id !== opId);
  return L('These behaviours are handled by a DIFFERENT function elsewhere in the codebase. They are',
    'not part of this function and do not affect your condition:',
    ...others.map((id) => '    ' + OPS[id].delta),
    'You are writing ONLY the behaviour requested above. Do not write these.');
}

function promptFor(p, opId, render) {
  const shown = L(...SRC_LINES.slice(0, INSERT_AFTER + 1), MARKER, ...SRC_LINES.slice(INSERT_AFTER + 1));
  const para = render === 'IN_CHAIN' ? siblingParagraph(p, opId)
    : render === 'ELSEWHERE' ? elsewhereParagraph(p, opId)
      : render === 'SIBLING_EXISTS' ? existsParagraph(p, opId)
        : render === 'SIBLING_RESOLVED' ? resolvedParagraph(p, opId) : null;
  const sib = para ? [para, ''] : [];
  return L('Here is a Python function. Every line shown is FIXED: you may not change, repeat',
    'or remove any of it.', '', shown, '',
    'A new behaviour is requested:', '    ' + OPS[opId].delta, '',
    ...sib,
    'Write ONLY the lines that take the place of the marker. Keep the same indentation.',
    'Do NOT repeat any fixed line. Do NOT write the whole function. Do NOT explain.');
}

// IS CAPTURE COMPOSITION REASONING, OR SURFACE COPYING?
//
// Capture is relational: a sibling INSIDE the operation's domain and of the same shape is adopted 31.6%
// of the time, one that CONTAINS it 6.0%, one of a different shape 4.2%, a DISJOINT one 0 of 119. That
// ordering is at least consistent with the model doing something defensible and getting it backwards -
// narrowing itself because it was shown a narrower bound that genuinely constrains it.
//
// This family breaks that link while holding the text almost fixed:
//
//   ISOLATED    no sibling paragraph                                   replication control, expect 0
//   IN_CHAIN    same function, same chain of conditions                replication, expect ~32%
//   ELSEWHERE   SAME DOMAINS, different function, cannot constrain     the discriminator
//
// If capture is composition reasoning, however wrong, ELSEWHERE must be far lower - there is no
// precedence story to get backwards when the sibling is not in the chain. If capture is surface copying
// of a narrower same-shape bound, ELSEWHERE will match IN_CHAIN.
const RENDERS = ['ISOLATED', 'IN_CHAIN', 'ELSEWHERE'];

// Split a realized guard into clauses and drop the one matching the operation's OWN requested domain.
// Whatever is left is a defence, and the question this family asks is what it defends against.
const OWN_COND = { micro: 'n < 0', low: 'n < 10', mid: 'n < 100', five: 'n == 5',
  fifty: 'n == 50', high: 'n > 100', plus: 'n > 0' };
const isNamedFact = (clause) => /!=\s*3/.test(clause);

// WHICH OPERATIONS HAVE SOMETHING TO LOSE: those whose own domain strictly CONTAINS a sibling's. Only
// they can either defend against the sibling or collapse onto it, so they are the denominator.
const CONTAINS = { E0: {}, E1: { low: ['micro'] }, E2: { low: ['micro', 'five'] },
  E3: { mid: ['low', 'micro'], low: ['micro'] } };

// THE DISTINCTION THE FIRST VERSION OF THIS METRIC MISSED. It counted any clause that was not the
// canonical own-domain as "sibling defence", so a simply WRONG guard - an operation that wrote n == 3 -
// was scored as defending. That is not a defence metric at all. The two things that can actually happen
// are opposite, and only one of them is what this family predicted:
//
//   EXCLUDED   the guard carves the sibling's domain OUT of its own      n < 10 and n >= 0
//   ADOPTED    the guard REPLACES its own domain with the sibling's      n < 0, when n < 10 was asked
//
// An EXCLUSION carves something out: a lower bound, or a point removed. Word boundaries are written as
// explicit digit lookaheads rather than the word-boundary escape, because this file was rewritten
// through a shell twice and both times that escape arrived as a raw control character - hazard 1,
// occurrences ten and eleven. This line is only ever edited with a file editor, never through a shell.
const RE_EXCLUDES = />=\s*0|>\s*-1|!=\s*5(?![0-9])|!=\s*50(?![0-9])|n\s*>=?\s*[0-9]/;

function siblingRelation(caseKey, id, condition) {
  const owned = (CONTAINS[caseKey] || {})[id];
  if (!owned || !condition) return null;
  for (const sib of owned) {
    const d = OWN_COND[sib];
    if (condition === d || condition.startsWith(d + ' and')) return 'ADOPTED';
  }
  if (RE_EXCLUDES.test(condition)) return 'EXCLUDED';
  return null;
}

function relationCounts(rows, caseKey, which) {
  let n = 0;
  for (const r of rows) {
    for (const [id, o] of Object.entries(r.perOp || {})) {
      if (!o || !o.condition) continue;
      if (siblingRelation(caseKey, id, o.condition) === which) n++;
    }
  }
  return n;
}

function eligibleGuards(rows, caseKey) {
  let n = 0;
  for (const r of rows) {
    for (const [id, o] of Object.entries(r.perOp || {})) {
      if (o && o.condition && (CONTAINS[caseKey] || {})[id]) n++;
    }
  }
  return n;
}

function extraClauses(row) {
  const out = [];
  for (const [id, o] of Object.entries(row.perOp || {})) {
    if (!o || !o.condition) continue;
    for (const c of o.condition.split(/\s+and\s+/).map((x) => x.trim())) {
      if (c !== OWN_COND[id]) out.push(c);
    }
  }
  return out;
}

// Assemble the transaction: the committed order decides which fragment goes first.
function build(p, codeById) {
  const body = p.order.flatMap((id) => codeById[id].split(NL));
  return L(...SRC_LINES.slice(0, INSERT_AFTER + 1), ...body, ...SRC_LINES.slice(INSERT_AFTER + 1));
}

function runProgram(program, inputs) {
  const ws = mkdtempSync(join(tmpdir(), 'r4-'));
  writeFileSync(join(ws, 'impl.py'), program + NL, 'utf8');
  writeFileSync(join(ws, 'p.py'), L('import impl',
    ...inputs.map((v, i) => 'print("r' + i + '=" + str(impl.classify(' + v + ')))')), 'utf8');
  try {
    const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 15000 });
    const map = new Map();
    inputs.forEach((v, i) => {
      const m = out.match(new RegExp('^r' + i + '=(.*)$', 'm'));
      map.set(v, m ? m[1].trim() : 'MISSING');
    });
    return map;
  } catch (e) { return null; }
}

const originalCache = new Map();
function original(v) {
  if (!originalCache.has(v)) {
    const m = runProgram(SRC, [v]);
    originalCache.set(v, m ? m.get(v) : 'ERROR');
  }
  return originalCache.get(v);
}

function probesFor(p) {
  return transactionProbes({ requested: p.reqs, order: p.order,
    preserved: preserved.domain, preservedWins: true,
    existing: [{ domain: preserved.domain }] }, original);
}

// A sweep dense enough that any live branch fires somewhere, with the bounds named explicitly rather
// than left to a stride.
const SWEEP = (() => {
  const vs = new Set();
  for (let v = -100000; v <= 100000; v += 1) { vs.add(v); if (Math.abs(v) > 300) v += 97; }
  for (const b of [-2, -1, 0, 1, 2, 3, 4, 5, 9, 10, 11, 49, 50, 51, 99, 100, 101]) vs.add(b);
  return [...vs];
})();

// Deadness is asked of the EMITTED PROGRAM, not of the plan. The planned verdict is computed too and
// carried alongside, because the gap between them is what a self-defending realization looks like -
// and measuring the rescue rate is the whole reason this family can show a gradient at all.
// THE EXPECTATIONS DO NOT MOVE WITH THE TREATMENT.
//
// `probesFor` is ALWAYS given the derived order, even when the program is assembled in the presented
// one. That is not grading the planner with the planner's own answers - it is grading against the
// CONTRACT. Two requested behaviours whose domains are nested can only both be satisfied if the
// narrower wins where they overlap; "below 0 -> micro" and "below 10 -> low" jointly determine the
// answer at n=-5 no matter how the file is laid out. The derived order is the unique assembly that
// realizes that, which is precisely what makes it derivable.
//
// Recomputing the expectation from the PRESENTED order instead makes the ablation self-consistent: the
// broken program is graded against a broken expectation, the probes agree by construction, and the only
// thing left that can fire is the deadness term. That is exactly the 105 dead / 0 probe split the
// original DECIDE ablation produced, and it is an ablation that moves the goalposts with the treatment.
function verifyTransaction(p, codeById, assemblyOrder) {
  const probes = probesFor(p);
  const program = build({ ...p, order: assemblyOrder || p.order }, codeById);
  const res = runProgram(program, probes.map((x) => x.input));
  if (!res) return { verified: false, loaded: false, failures: [{ why: 'did not load' }], dead: [] };
  const failures = probes.filter((x) => res.get(x.input) !== x.expected);

  const swept = runProgram(program, SWEEP);
  const observed = swept ? new Set([...swept.values()]) : new Set();
  const executed = reachabilityExecuted({ requested: p.reqs, observed });
  const planned = reachability({ requested: p.reqs, order: assemblyOrder || p.order,
    preserved: preserved.domain, preservedWins: true });

  return { verified: failures.length === 0 && executed.allReachable, loaded: true,
    failures: failures.slice(0, 3), dead: executed.dead, plannedDead: planned.dead,
    rescued: planned.dead.length > 0 && executed.dead.length === 0, probes: probes.length };
}

const CELLS = Object.keys(CASES).filter((k) => CASES[k].generate !== false);

function control() {
  let bad = 0;
  for (const key of Object.keys(CASES)) {
    const p = planCase(key);
    const c = CASES[key];
    if (p.ord.status !== c.expect) {
      console.log('  ORDER STATUS ' + key + ': got ' + p.ord.status + ', expected ' + c.expect); bad++;
    }
    if (c.expectOrder && String(p.order) !== String(c.expectOrder)) {
      console.log('  ORDER ' + key + ': got ' + p.order + ', expected ' + c.expectOrder); bad++;
    }
    // Where the order is only PARTLY derived, assert the derived constraints rather than a full order:
    // demanding one particular total order would be asserting an ENGINEERING CHOICE as a derivation.
    if (p.order) {
      for (const pr of p.ord.pairs.filter((x) => x.status === 'ORDERED')) {
        const inner = pr.first; const outer = pr.a === inner ? pr.b : pr.a;
        if (p.order.indexOf(inner) > p.order.indexOf(outer)) {
          console.log('  ORDER CONSTRAINT ' + key + ': ' + inner + ' must precede ' + outer); bad++;
        }
      }
    }
    console.log('  ' + key.padEnd(15) + p.ord.status.padEnd(13)
      + (p.order ? 'order ' + p.order.join(' then ') + '   basis ' + p.orderBasis : 'NO GENERATION')
      + (p.ord.blocking ? '   blocked by ' + p.ord.blocking.a + '/' + p.ord.blocking.b
        + ' at n=' + p.ord.blocking.witness.input : ''));
    if (c.generate === false) continue;

    for (const id of c.ops) {
      const prompt = promptFor(p, id);
      const hits = leakageScan(prompt.split(NL).filter((l) => l !== MARKER).join(NL));
      if (hits.length) { console.log('  LEAKAGE ' + key + '/' + id + ': ' + hits.join('; ')); bad++; }
      const perfect = L('    ' + OPS[id].correct, '        return "' + OPS[id].result + '"');
      if (!promptSufficiency(prompt, perfect).sufficient) { console.log('  SUFFICIENCY FAIL ' + key + '/' + id); bad++; }
      // The prompt must not disclose the OTHER operation, or the composition is not Legasus's.
      for (const other of c.ops) {
        if (other === id) continue;
        // The QUOTED result literal, not the bare word: "however small" is an adverb and the
        // operation's result is `"low"`. Checking the bare word made the control fire on English.
        if (prompt.includes('"' + OPS[other].result + '"')) {
          console.log('  ISOLATION FAIL ' + key + '/' + id + ' mentions ' + other); bad++;
        }
      }
    }

    // ADMITS: canonical and alternative realizations must both verify, per operation.
    for (const which of ['correct', 'alt']) {
      const codeById = {};
      for (const id of c.ops) {
        const a = authorize(L(OPS[id][which], '    return "' + OPS[id].result + '"'), FIXED);
        if (!a.ok) { console.log('  ANTI-ORACLE FAIL ' + key + '/' + id + '/' + which + ': ' + a.reason); bad++; }
        codeById[id] = a.ok ? a.code : '';
      }
      const v = verifyTransaction(p, codeById);
      if (!v.verified) {
        console.log('  ANTI-ORACLE FAIL ' + key + ' ' + which + ' transaction rejected: '
          + JSON.stringify(v.failures) + ' dead=' + JSON.stringify(v.dead)); bad++;
      }
    }

    // THE R4 CONTROL: both fragments perfect, order reversed. Must fail where ordering matters and
    // must PASS where both orders are legal.
    const codeById = {};
    for (const id of c.ops) codeById[id] = authorize(L(OPS[id].correct, '    return "' + OPS[id].result + '"'), FIXED).code;
    const flipped = { ...p, order: p.order.slice().reverse() };
    const vf = verifyTransaction(p, codeById, p.order.slice().reverse());
    if (p.ord.status === 'ORDERED' && p.ord.orderBasis === 'DERIVED' && vf.verified) {
      console.log('  R4 CONTROL FAIL ' + key + ': the reversed composition verified, so ordering is'
        + ' not being tested'); bad++;
    }
    // Where a tie was broken by ENGINEERING CHOICE the reversal may be legal or not depending on which
    // constraint it crosses, so it is not asserted either way - it is reported.
    if (p.ord.orderBasis === 'DERIVED_WITH_ENGINEERING_CHOICE') {
      console.log('  ' + key + ' NOTE: reversed order ' + (vf.verified ? 'verifies' : 'fails')
        + ', which is expected to depend on which constraint the reversal crosses');
    }
  }
  // THE ABLATION INSTRUMENT'S OWN CONTROL, on hand-assembled PERFECT fragments.
  //
  // The dose-response is only meaningful if the measuring arm can register BOTH outcomes. A DECIDE-OFF
  // arm that fails everything would "confirm" the prediction at 3 edges while making the 0-edge cell
  // unfalsifiable; one that passes everything could never show damage at 3. So both are witnessed here
  // BEFORE any tokens are spent, and the expected value comes from the EDGE COUNT, not from whatever
  // the run happens to produce.
  console.log('');
  console.log('  ABLATION INSTRUMENT (perfect fragments, presented order):');
  for (const key of CELLS) {
    const c = CASES[key];
    if (c.generate === false) continue;
    const p = planCase(key);
    const codeById = {};
    for (const id of c.ops) codeById[id] = authorize(L(OPS[id].correct, '    return "' + OPS[id].result + '"'), FIXED).code;
    const on = verifyTransaction(p, codeById);
    const off = verifyTransaction(p, codeById, c.ops.slice());
    const mustHold = c.edges === 0;
    console.log('    ' + key.padEnd(4) + ' edges ' + c.edges
      + '   DECIDE ON ' + (on.verified ? 'verified' : 'FAILED')
      + '   DECIDE OFF ' + (off.verified ? 'verified' : 'failed: ' + ((off.dead || []).join(',') || 'probe'))
      + '   expected OFF ' + (mustHold ? 'verified' : 'failed'));
    if (!on.verified) { console.log('      INSTRUMENT FAIL: perfect fragments must verify under the derived order'); bad++; }
    if (off.verified !== mustHold) {
      console.log('      INSTRUMENT FAIL: the ablation arm did not register the expected outcome at '
        + c.edges + ' violated edges'); bad++;
    }
  }
  // THE RENDERING CONTROL. The two conditions must actually differ, and must NOT change the plan -
  // if naming the siblings altered the derived order, this family would be varying two things at once.
  console.log('');
  console.log('  RENDERING CONTROL:');
  for (const key of CELLS) {
    const p = planCase(key);
    let differ = 0;
    for (const id of CASES[key].ops) {
      // Every condition must be pairwise distinct, or a level that silently renders the same text as
      // its neighbour gets reported as a separate condition.
      const texts = RENDERS.map((R) => promptFor(p, id, R));
      if (new Set(texts).size === RENDERS.length) differ++;
      else {
        console.log('      CONTROL FAIL ' + key + '/' + id + ': two conditions render identical text');
        bad++;
      }
      // THE CRITICAL CONTROL FOR THIS FAMILY: IN_CHAIN and ELSEWHERE must state EXACTLY the same
      // sibling domains. If they differ in what they say the siblings ARE, the comparison measures
      // content rather than relevance and the family is void.
      for (const R of ['IN_CHAIN', 'ELSEWHERE']) {
        const txt = promptFor(p, id, R);
        for (const other of CASES[key].ops) {
          if (other === id) continue;
          if (!txt.includes(OPS[other].delta)) {
            console.log('      CONTROL FAIL ' + key + '/' + id + '/' + R + ': sibling ' + other
              + ' not named'); bad++;
          }
        }
      }
      // and they must differ ONLY in the framing lines, not in length by more than a little - a large
      // length difference would reintroduce "more text" as a rival explanation.
      const a = promptFor(p, id, 'IN_CHAIN');
      const b = promptFor(p, id, 'ELSEWHERE');
      const delta = Math.abs(a.length - b.length);
      if (delta > 60) {
        console.log('      CONTROL FAIL ' + key + '/' + id + ': IN_CHAIN and ELSEWHERE differ by '
          + delta + ' characters, enough for length to be a rival explanation'); bad++;
      }
    }
    // the plan is derived from the deltas, which the rendering does not touch
    const p2 = planCase(key);
    if (String(p.order) !== String(p2.order)) {
      console.log('      CONTROL FAIL ' + key + ': the plan is not stable'); bad++;
    }
    console.log('    ' + key.padEnd(4) + ' prompts differing between conditions ' + differ + '/'
      + CASES[key].ops.length + '   derived order unchanged [' + p.order.join(' ') + ']');
    if (differ !== CASES[key].ops.length) {
      console.log('      CONTROL FAIL ' + key + ': a condition that does not change the text'); bad++;
    }
  }
  console.log('');
  console.log(bad ? '  CONTROLS FAILED: ' + bad
    : '  controls ok: orders derived as expected, each prompt isolated from the other operation,'
      + ' both realizations verify, the reversed composition fails where ordering is derived and'
      + ' passes where both orders are legal');
  return bad === 0;
}

// IS THE RESCUE PATH REAL? A dose-response endpoint is only measurable if a realization CAN survive the
// presented order. If nothing can, the endpoint is void by construction - the same defect as the W0 rung
// whose prompt never named the parameter. So the surviving realization is CONSTRUCTED here, per case,
// before the endpoint is preregistered.
if (process.argv.includes('--rescue')) {
  console.log('  RESCUE PATH (does a self-defending realization survive the PRESENTED order?)');
  const DEF = { // a guard that carves out the domains it would otherwise shadow
    E1: { low: 'if n < 10 and n >= 0:' },
    E2: { low: 'if n < 10 and n >= 0 and n != 5:' },
    E3: { mid: 'if n < 100 and n >= 10:', low: 'if n < 10 and n >= 0:' },
  };
  for (const key of CELLS) {
    const c = CASES[key]; if (!DEF[key]) { console.log('    ' + key + ' edges 0 - nothing to rescue'); continue; }
    const p = planCase(key);
    const codeById = {};
    for (const id of c.ops) {
      const cond = (DEF[key] && DEF[key][id]) || OPS[id].correct;
      codeById[id] = authorize(L(cond, '    return "' + OPS[id].result + '"'), FIXED).code;
    }
    const off = verifyTransaction(p, codeById, c.ops.slice());
    const on = verifyTransaction(p, codeById);
    console.log('    ' + key.padEnd(4) + ' edges ' + c.edges
      + '   guards needing self-defence ' + Object.keys(DEF[key]).length
      + '   DECIDE OFF ' + (off.verified ? 'RESCUED' : 'still fails: ' + ((off.dead || []).join(',') || 'probe'))
      + '   (same code under DECIDE ON ' + (on.verified ? 'verified' : 'FAILS') + ')');
    if (!off.verified) {
      console.log('         program:');
      for (const ln of build({ ...p, order: c.ops.slice() }, codeById).split(NL)) console.log('           ' + ln);
      for (const fx of (off.failures || [])) console.log('         probe n=' + fx.input
        + ' expected ' + fx.expected + ' why ' + fx.why);
    }
  }
  process.exit(0);
}

if (process.argv.includes('--prompts')) {
  for (const key of CELLS) { const p = planCase(key);
    for (const id of CASES[key].ops) {
      for (const R of RENDERS) {
        console.log('===== ' + key + ' / ' + id + ' / ' + R + ' =====');
        console.log(promptFor(p, id, R)); console.log('');
      } } }
  process.exit(0);
}
if (!control()) process.exit(1);
if (CONTROL_ONLY) process.exit(0);

async function generate(prompt, model) {
  const r = await fetch(BASE.replace(/\/$/, '') + '/api/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false,
      options: { temperature: TEMPERATURE, num_predict: 160 } }),
  });
  if (!r.ok) throw new Error('generate ' + r.status);
  return (await r.json()).response || '';
}

const tags = await (await fetch(BASE.replace(/\/$/, '') + '/api/tags')).json();
const served = (tags.models || []).map((m) => m.name);
for (const m of MODELS) if (!served.includes(m)) { console.log('  RULE 3 FAILED: ' + m); process.exit(1); }
console.log('  RULE 3 ok: ' + MODELS.join(', '));
console.log('  ' + CELLS.length + ' transaction cases x ' + MODELS.length + ' models   samples ' + SAMPLES);
console.log('');

const results = { models: MODELS, samples: SAMPLES, temperature: TEMPERATURE,
  // Named by lookup rather than hard-coded: the first version carried R4's case name into T3 and
  // crashed at results construction, after Rule 3 and before any generation. No tokens were spent, and
  // the fix is to stop spelling a case name twice.
  undetermined_not_generated: Object.entries(CASES).filter(([, c]) => c.generate === false)
    .map(([k, c]) => k + ': ' + c.why), cells: {} };
for (const MODEL of MODELS) {
 for (const RENDER of RENDERS) {
  for (const key of CELLS) {
    const p = planCase(key);
    const rows = [];
    const t0 = Date.now();
    for (let i = 0; i < SAMPLES; i++) {
      const codeById = {}; const perOp = {};
      let allAuthorized = true;
      for (const id of CASES[key].ops) {
        let raw = '';
        try { raw = await generate(promptFor(p, id, RENDER), MODEL); } catch (e) { raw = ''; }
        const a = authorize(raw, FIXED);
        perOp[id] = { authorized: a.ok, reason: a.reason || null, condition: guardConditionOf(raw) };
        if (!a.ok) { allAuthorized = false; continue; }
        codeById[id] = a.code;
      }
      if (!allAuthorized) { rows.push({ assembled: false, perOp }); continue; }
      // THE ABLATION, PAIRED ON IDENTICAL FRAGMENTS. Same generated code, assembled twice.
      //   DECIDE ON   the derived order
      //   DECIDE OFF  the order the request was PRESENTED in
      // OFF is a task-independent policy with no access to the domain relation, exactly as OBSERVE OFF
      // was frozen. It is NOT "choose a wrong order", which would fail by construction and prove nothing.
      const v = verifyTransaction(p, codeById);
      const off = verifyTransaction(p, codeById, CASES[key].ops.slice());
      rows.push({ assembled: true, perOp, verified: v.verified, dead: v.dead,
        off_verified: off.verified, off_dead: off.dead, off_failures: off.failures,
        failures: v.failures, codes: Object.fromEntries(Object.entries(codeById).map(([k2, v2]) => [k2, v2.replace(/\s+/g, ' ').trim()])) });
    }
    const n = (f) => rows.filter(f).length;
    const assembled = n((r) => r.assembled);
    const verified = n((r) => r.verified);
    const opsTried = SAMPLES * CASES[key].ops.length;
    const opsAuth = rows.reduce((a, r) => a + Object.values(r.perOp).filter((o) => o.authorized).length, 0);
    results.cells[MODEL + '|' + RENDER + '|' + key] = { of: SAMPLES, model: MODEL, render: RENDER, case: key,
      order: p.order, orderBasis: p.orderBasis, seconds: (Date.now() - t0) / 1000,
      op_yield: opsAuth / opsTried, assembled, verified,
      transaction_precision: assembled ? verified / assembled : null,
      dead_ops: n((r) => r.dead && r.dead.length > 0),
      probe_failures: n((r) => r.assembled && !r.verified && (!r.dead || !r.dead.length)),
      // THE PRIMARY ENDPOINT OF THIS FAMILY: clauses beyond the operation's own requested domain,
      // split by WHAT THEY DEFEND AGAINST. n != 3 defends the preserved fact every prompt names; a
      // clause carving out a sibling's domain is the thing that was never once observed under ISOLATED.
      defence_named: rows.reduce((a, r) => a + extraClauses(r).filter(isNamedFact).length, 0),
      // Only guards whose domain CONTAINS a sibling can defend or collapse; they are the denominator.
      eligible_guards: eligibleGuards(rows, key),
      sibling_excluded: relationCounts(rows, key, 'EXCLUDED'),
      sibling_adopted: relationCounts(rows, key, 'ADOPTED'),
      sibling_clauses: [...new Set(rows.flatMap((r) => extraClauses(r).filter((x) => !isNamedFact(x))))],
      rescued: n((r) => r.rescued),
      refusals: rows.flatMap((r) => Object.values(r.perOp).filter((o) => !o.authorized).map((o) => o.reason)),
      // THE ABLATION ARM, on the identical fragments.
      violated_edges: CASES[key].edges,
      off_verified: n((r) => r.off_verified),
      off_dead_ops: n((r) => r.off_dead && r.off_dead.length > 0),
      off_probe_failures: n((r) => r.assembled && !r.off_verified && (!r.off_dead || !r.off_dead.length)),
      // The PAIRED quantity, which is the primary endpoint: of the transactions DECIDE got right,
      // how many did the presented order break? Anything else confounds ablation cost with yield.
      broken_by_ablation: n((r) => r.verified && !r.off_verified),
      rows };
    const s = results.cells[MODEL + '|' + RENDER + '|' + key];
    console.log('  ' + MODEL.padEnd(19) + RENDER.padEnd(15) + key.padEnd(5)
      + ' op-yield ' + s.op_yield.toFixed(3)
      + '   assembled ' + String(assembled).padStart(2) + '/' + SAMPLES
      + '   verified ' + String(verified).padStart(2)
      + '   P(correct|assembled) ' + (s.transaction_precision === null ? ' n/a' : s.transaction_precision.toFixed(3))
      + '   dead-op ' + s.dead_ops + '   probe-fail ' + s.probe_failures
      + '  ||  edges ' + s.violated_edges
      + '   DECIDE-OFF verified ' + String(s.off_verified).padStart(2)
      + '   broken ' + String(s.broken_by_ablation).padStart(2) + '/' + verified);
  }
 }
}
writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');
console.log('');
for (const m of MODELS) {
  const ks = Object.keys(results.cells).filter((k) => k.startsWith(m + '|'));
  const S = (f) => ks.reduce((a, k) => a + f(results.cells[k]), 0);
  // One cell per (render, case). Dividing by cases alone reported a yield of 2.000 in revision 1.
  const N = SAMPLES * ks.length;
  console.log('  ' + m.padEnd(21) + ' transaction yield ' + (S((x) => x.assembled) / N).toFixed(3)
    + '   P(correct|assembled) ' + (S((x) => x.verified) / S((x) => x.assembled)).toFixed(3)
    + '   verified end-to-end ' + (S((x) => x.verified) / N).toFixed(3)
    + '   sec/verified ' + (S((x) => x.verified) ? (S((x) => x.seconds) / S((x) => x.verified)).toFixed(1) : 'n/a'));
}
console.log('');
console.log('  THE PRIMARY ENDPOINT: does naming the sibling facts produce sibling defence?');
for (const m of MODELS) {
  for (const R of RENDERS) {
    const ks = Object.keys(results.cells).filter((k) => k.startsWith(m + '|' + R + '|'));
    const S = (f2) => ks.reduce((a, k) => a + f2(results.cells[k]), 0);
    const sibs = [...new Set(ks.flatMap((k) => results.cells[k].sibling_clauses))];
    console.log('    ' + m.padEnd(19) + R.padEnd(15)
      + ' guards that CONTAIN a sibling ' + String(S((x) => x.eligible_guards)).padStart(3)
      + '   EXCLUDED it ' + String(S((x) => x.sibling_excluded)).padStart(3)
      + '   ADOPTED it ' + String(S((x) => x.sibling_adopted)).padStart(3)
      + '   RESCUED ' + String(S((x) => x.rescued)).padStart(3)
      + '   op-yield ' + (S((x) => x.op_yield) / ks.length).toFixed(3)
      + (sibs.length ? '   clauses: ' + sibs.join(' | ') : ''));
  }
}
console.log('');
console.log('  DOSE-RESPONSE by rendering  (of the transactions DECIDE got right, how many broke)');
for (const R of RENDERS) {
  for (const key of CELLS) {
    const ks = Object.keys(results.cells).filter((k) => k.includes('|' + R + '|') && k.endsWith('|' + key));
    const S = (f2) => ks.reduce((a, k) => a + f2(results.cells[k]), 0);
    const on = S((x) => x.verified); const broke = S((x) => x.broken_by_ablation);
    console.log('    ' + R.padEnd(15) + key.padEnd(4) + ' edges ' + CASES[key].edges
      + '   DECIDE ON ' + String(on).padStart(3)
      + '   DECIDE OFF ' + String(S((x) => x.off_verified)).padStart(3)
      + '   broken ' + String(broke).padStart(3) + '/' + on
      + '   ' + (on ? (100 * broke / on).toFixed(0) + '%' : 'n/a'));
  }
}
console.log('');
console.log('  THE COST OF THE RENDERING: refusal reasons, so a yield loss cannot hide');
for (const R of RENDERS) {
  const ks = Object.keys(results.cells).filter((k) => k.includes('|' + R + '|'));
  const rs = {};
  for (const k of ks) for (const r of results.cells[k].refusals) rs[r] = (rs[r] || 0) + 1;
  const tot = Object.values(rs).reduce((a, b) => a + b, 0);
  console.log('    ' + R.padEnd(15) + ' refusals ' + String(tot).padStart(3) + '   '
    + (Object.entries(rs).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' x' + n).join(', ') || 'none'));
}
console.log('');
console.log('  written -> ' + OUT);
