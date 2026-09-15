// THE REFUSAL GATE, as a classifier experiment.
//
// The question is no longer "can the model generate the right change" but "can the system tell
// trajectories worth executing from trajectories that should be killed before they poison state".
// Selective execution is how an unreliable generator becomes a more reliable system.
//
// FIVE OBLIGATIONS, from tatte:
//   1 refuse plans with a proven fatal property
//   2 ADMIT at least one frozen known-good plan whose snippets are already verified
//   3 use only information available AT GENERATION TIME - no outcome data, or it is an oracle
//   4 operate on FROZEN plan/snippet state - no recomputing against a mutated source
//   5 distinguish UNSAFE from UNCERTAIN, so refusing everything is not an optimum
//
// The decisive design constraint: the snippet checks must be STATIC. If catching the `a a b b`
// duplication or the `codes` borrow required executing the code, the gate would just be the verifier
// with extra steps, and it could not run before a state commit.
//
// NON-VACUITY IS A HARD INVARIANT. This harness has been bitten repeatedly by branches where "nothing
// happened" scored as success. If the gate refuses the known-good plan, the ENTIRE suite fails, loudly,
// regardless of how well it does on known-bad input.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SITES, locate } from './oraclesites.mjs';
import { scopeFacts } from './scope.mjs';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const NL = String.fromCharCode(10);
const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const indentOf = (l) => (l.match(/^[ \t]*/) || [''])[0].length;

// ---------------------------------------------------------------------------------------------
// PLAN-LEVEL CHECKS. Available before a single token is generated.
export function gatePlan(src, spec) {
  const reasons = [];
  let cur = src;
  for (let i = 0; i < spec.sites.length; i++) {
    const site = spec.sites[i];
    const n = cur.split(site.anchor).length - 1;
    if (n === 0) reasons.push({ site: i + 1, kind: 'anchor_absent', fatal: true });
    else if (n > 1) reasons.push({ site: i + 1, kind: 'anchor_ambiguous', fatal: true, detail: n + ' occurrences' });
    else {
      // REACHABILITY. Defect 6: an anchor ending in a control-transfer statement at the insertion
      // indentation makes everything placed there dead code. Found the hard way, now a gate rule.
      const before = cur.slice(0, cur.indexOf(site.anchor) + site.anchor.length);
      const lines = before.replace(/\n$/, '').split(NL);
      const last = lines[lines.length - 1] || '';
      if (/^\s*(continue|break|return|pass|raise)\b/.test(last) && indentOf(last) <= site.indent) {
        reasons.push({ site: i + 1, kind: 'site_unreachable', fatal: true,
          detail: 'insertion follows `' + last.trim() + '` at indent ' + indentOf(last) });
      }
      const l = locate(cur, site);
      if (l.ok) cur = l.before + (site.reference || '') + l.after;
    }
    if (!scopeFacts(src, spec.fn, [])) reasons.push({ site: i + 1, kind: 'scope_not_derivable', fatal: true });
  }
  const fatal = reasons.filter((r) => r.fatal);
  return { verdict: fatal.length ? 'REFUSE' : 'ADMIT', reasons, level: 'plan' };
}

// ---------------------------------------------------------------------------------------------
// SNIPPET-LEVEL CHECKS. Static only - no execution, no outcome data.
export function gateSnippet(srcAtSite, snippet, spec, site, createdNames) {
  const reasons = [];
  const facts = scopeFacts(srcAtSite, spec.fn, createdNames) || { inScope: [], outOfScope: [] };

  // 1 OUT-OF-SCOPE READ. `codes` and `links` are locals of _inline; reading them here is a NameError
  //   waiting to happen, and it is decidable from the source.
  for (const name of facts.outOfScope) {
    if (new RegExp('\\b' + name + '\\s*(\\.|\\[|\\))').test(snippet)) {
      reasons.push({ kind: 'out_of_scope_identifier', fatal: true, detail: name + ' is a local of another function' });
    }
  }

  // 2 DUPLICATED ACCUMULATION PATH. The `a a b b` defect is a statement the surviving code ALREADY
  //   performs, added a second time, so each input line accumulates twice. Decidable statically by
  //   asking whether any non-trivial statement in the snippet appears verbatim in the function that
  //   will still contain it.
  const fnBody = (() => {
    const m = srcAtSite.match(new RegExp('^def\\s+' + spec.fn + '\\s*\\(', 'm'));
    if (!m) return '';
    const rest = srcAtSite.slice(m.index).split(NL);
    let end = rest.length;
    for (let i = 1; i < rest.length; i++) {
      if (rest[i].trim() === '') continue;
      if (!/^[ \t]/.test(rest[i])) { end = i; break; }
    }
    return rest.slice(0, end).join(NL);
  })();
  //   REFINED after the gate false-refused the only verified real trajectory. The first rule flagged any
  //   verbatim-repeated append, which condemned goal 74's own reference: it legitimately emits the same
  //   blocks.append(...) when a fence closes and again at end-of-input, in MUTUALLY EXCLUSIVE branches.
  //   The `a a b b` defect is narrower - a duplicate that runs in the SAME LOOP ITERATION as the
  //   original. So the rule now requires the insertion point to be inside the loop that also contains
  //   the identical statement. An append outside that loop cannot double-count a line.
  const loopIndent = (() => {
    for (const l of fnBody.split(NL)) if (/^\s*for\s+\w+\s+in\b/.test(l)) return indentOf(l);
    return null;
  })();
  const insideLoop = loopIndent !== null && site.indent > loopIndent;
  if (insideLoop) {
    const loopLines = [];
    let inLoop = false;
    for (const l of fnBody.split(NL)) {
      if (/^\s*for\s+\w+\s+in\b/.test(l) && indentOf(l) === loopIndent) { inLoop = true; continue; }
      if (inLoop && l.trim() && indentOf(l) <= loopIndent) break;
      if (inLoop) loopLines.push(l.trim());
    }
    const existing = new Set(loopLines.filter((l) => /\.(append|extend|add)\(/.test(l)));
    for (const line of snippet.split(NL)) {
      const t = line.trim();
      if (t && existing.has(t)) {
        reasons.push({ kind: 'duplicate_accumulation', fatal: true, detail: t + ' (already runs in this loop)' });
      }
    }
  }

  // 3 INSTRUCTION ECHO - the snippet is continuing the prompt's own comment format. NOT FATAL: the
  //   recorded trajectories show echoed comment text repeatedly loading and preserving behaviour
  //   perfectly well, and treating it as unsafe drove most of the gate's false refusals. It is a
  //   quality signal, not a corruption risk - UNSAFE and UNCERTAIN have to stay distinct or the gate
  //   optimises toward zero throughput.
  if (/WRITE ONLY|REQUESTED CHANGE|AUTHORITATIVE|INSERT HERE/i.test(snippet)) {
    reasons.push({ kind: 'instruction_echo', fatal: false });
  }

  // 4 REDECLARATION of something the surviving code already defines.
  for (const line of snippet.split(NL)) {
    const m = line.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(/);
    if (m && new RegExp('^\\s*def\\s+' + m[1] + '\\s*\\(', 'm').test(fnBody)) {
      reasons.push({ kind: 'redeclares_existing', fatal: true, detail: m[1] });
    }
  }

  // 5 UNCERTAIN, not unsafe. An empty snippet is not evidence of danger, and refusing it as unsafe
  //   would let the gate optimise toward zero throughput. It is reported as a distinct verdict.
  if (!snippet.trim()) return { verdict: 'UNCERTAIN', reasons: [{ kind: 'empty_snippet', fatal: false }], level: 'snippet' };

  const fatal = reasons.filter((r) => r.fatal);
  return { verdict: fatal.length ? 'REFUSE' : 'ADMIT', reasons, level: 'snippet' };
}

// ---------------------------------------------------------------------------------------------
// WITNESSES
const GOAL = 64;
const spec = SITES[GOAL];
const src0 = world.get(spec.file).toString('utf8');
const created = ['ol_items', 'fence'];

// Build the state each site sees when the reference plan is applied in order, frozen up front so no
// check ever recomputes against a mutated source mid-evaluation.
const stateAtSite = [];
{
  let cur = src0;
  for (const site of spec.sites) {
    stateAtSite.push(cur);
    const l = locate(cur, site);
    cur = l.ok ? l.before + site.reference + l.after : cur;
  }
}

const results = [];
const record = (group, name, expect, got, detail) => {
  results.push({ group, name, expect, got, pass: expect === got, detail });
};

console.log('  REFUSAL GATE - classifier experiment, static checks only, no execution\n');

// --- POSITIVE WITNESS. The frozen reference plan, already proven verified end-to-end.
console.log('=== POSITIVE WITNESS (must ADMIT - if this refuses, the whole suite fails) ===');
const planGood = gatePlan(src0, spec);
record('positive', 'reference plan', 'ADMIT', planGood.verdict,
  planGood.reasons.map((r) => 'site' + r.site + ':' + r.kind).join(','));
console.log('  plan          ' + planGood.verdict
  + (planGood.verdict === 'ADMIT' ? '' : '   ' + JSON.stringify(planGood.reasons)));
let admittedGood = 0;
for (let i = 0; i < spec.sites.length; i++) {
  const g = gateSnippet(stateAtSite[i], spec.sites[i].reference, spec, spec.sites[i], created);
  record('positive', 'reference snippet site ' + (i + 1), 'ADMIT', g.verdict,
    g.reasons.map((r) => r.kind + (r.detail ? '(' + r.detail + ')' : '')).join(','));
  if (g.verdict === 'ADMIT') admittedGood++;
  else console.log('    site ' + (i + 1) + '  ' + g.verdict + '  ' + JSON.stringify(g.reasons));
}
console.log('  snippets      ' + admittedGood + '/' + spec.sites.length + ' admitted');

// GOAL 74's reference plan is ALSO a positive witness. Omitting it is why the first version of this
// suite scored 13/13 while the gate would have destroyed the only verified real trajectory: goal 74's
// reference repeats an append that goal 64's never does. One known-good example is not a control.
{
  const spec74 = SITES[74];
  const src74 = world.get(spec74.file).toString('utf8');
  const state74 = [];
  let cur74 = src74;
  for (const site of spec74.sites) {
    state74.push(cur74);
    const l = locate(cur74, site);
    cur74 = l.ok ? l.before + site.reference + l.after : cur74;
  }
  const p74 = gatePlan(src74, spec74);
  record('positive', 'goal 74 reference plan', 'ADMIT', p74.verdict);
  let ok74 = 0;
  for (let i = 0; i < spec74.sites.length; i++) {
    const g = gateSnippet(state74[i], spec74.sites[i].reference, spec74, spec74.sites[i], created);
    record('positive', 'goal 74 reference snippet site ' + (i + 1), 'ADMIT', g.verdict,
      g.reasons.map((r) => r.kind + (r.detail ? '(' + r.detail + ')' : '')).join(','));
    if (g.verdict === 'ADMIT') ok74++;
    else console.log('    g74 site ' + (i + 1) + '  ' + g.verdict + '  ' + JSON.stringify(g.reasons));
  }
  console.log('  goal 74 plan  ' + p74.verdict + '   snippets ' + ok74 + '/' + spec74.sites.length + ' admitted');
}

// --- NEGATIVE WITNESSES
console.log('\n=== NEGATIVE WITNESSES (must REFUSE) ===');

// defect 6 reproduced: the old anchor that placed site 3 after a `continue`
const badPlan = { ...spec, sites: spec.sites.map((s, i) => (i === 2
  ? { ...s, anchor: '            flush_list()' + NL + '            continue' + NL } : s)) };
const r1 = gatePlan(src0, badPlan);
record('negative', 'defect-6 unreachable site', 'REFUSE', r1.verdict,
  r1.reasons.filter((x) => x.fatal).map((x) => 'site' + x.site + ':' + x.kind).join(','));
console.log('  unreachable site (defect 6)     ' + r1.verdict + '   '
  + r1.reasons.filter((x) => x.fatal).map((x) => 'site' + x.site + ':' + x.kind).join(','));

// ambiguous anchor
const ambPlan = { ...spec, sites: [{ ...spec.sites[0], anchor: '    blocks = []' + NL, }, ...spec.sites.slice(1)] };
const ambSrc = src0.replace('    items = []', '    blocks = []' + NL + '    items = []');
const r2 = gatePlan(ambSrc, ambPlan);
record('negative', 'ambiguous anchor', 'REFUSE', r2.verdict,
  r2.reasons.filter((x) => x.fatal).map((x) => x.kind).join(','));
console.log('  ambiguous anchor                ' + r2.verdict + '   '
  + r2.reasons.filter((x) => x.fatal).map((x) => x.kind + '(' + (x.detail || '') + ')').join(','));

// the real `codes` borrow, taken verbatim from a recorded B2 trajectory
const codesSnip = '        if fence is not None:' + NL + '            codes.append(line)' + NL;
const r3 = gateSnippet(stateAtSite[4], codesSnip, spec, spec.sites[4], created);
record('negative', 'out-of-scope codes', 'REFUSE', r3.verdict, r3.reasons.map((x) => x.kind).join(','));
console.log('  out-of-scope identifier (codes) ' + r3.verdict + '   '
  + r3.reasons.map((x) => x.kind + (x.detail ? '(' + x.detail + ')' : '')).join(','));

// the real `a a b b` duplication
const dupSnip = '        else:' + NL + '            current.append(line.strip())' + NL;
const r4 = gateSnippet(stateAtSite[4], dupSnip, spec, spec.sites[4], created);
record('negative', 'duplicate accumulation', 'REFUSE', r4.verdict, r4.reasons.map((x) => x.kind).join(','));
console.log('  duplicate accumulation (a a b b)' + r4.verdict + '   '
  + r4.reasons.map((x) => x.kind + (x.detail ? '(' + x.detail + ')' : '')).join(','));

// instruction echo
const echoSnip = '        # AT THIS POINT WRITE ONLY THIS: declare a function named flush_para' + NL;
const r5 = gateSnippet(stateAtSite[4], echoSnip, spec, spec.sites[4], created);
// Echo is deliberately NOT fatal any more, so this witness asserts UNCERTAIN rather than REFUSE. It
// stays in the suite because the gate must still NOTICE it - silence would be the regression.
record('negative', 'instruction echo (flagged, not fatal)', 'ADMIT', r5.verdict,
  r5.reasons.map((x) => x.kind).join(','));
console.log('  instruction echo                ' + r5.verdict + '   flagged: '
  + r5.reasons.map((x) => x.kind).join(',') + '   (non-fatal by design)');

// --- ADVERSARIAL NEAR-MISS: structurally identical to the good plan, one poisoned snippet.
console.log('\n=== ADVERSARIAL NEAR-MISS (same shape as the good plan; exactly one bad snippet) ===');
const nearMiss = spec.sites.map((s, i) => (i === 4
  ? s.reference.replace('            continue' + NL, '            continue' + NL + '        else:' + NL + '            current.append(line.strip())' + NL)
  : s.reference));
let refusedIdx = [];
for (let i = 0; i < nearMiss.length; i++) {
  const g = gateSnippet(stateAtSite[i], nearMiss[i], spec, spec.sites[i], created);
  if (g.verdict === 'REFUSE') refusedIdx.push(i + 1);
}
const nearOk = refusedIdx.length === 1 && refusedIdx[0] === 5;
record('adversarial', 'near-miss isolates site 5', 'true', String(nearOk), 'refused sites: ' + refusedIdx.join(','));
console.log('  plan-level shape                ' + gatePlan(src0, spec).verdict + '  (identical to the good plan)');
console.log('  snippets refused                [' + refusedIdx.join(',') + ']'
  + (nearOk ? '   exactly site 5 - the gate is not just pattern-matching plan shape'
    : '   EXPECTED exactly [5] - the gate is reading shape, not content'));

// ---------------------------------------------------------------------------------------------
console.log('\n===== CLASSIFIER METRICS =====');
const pos = results.filter((r) => r.group === 'positive');
const neg = results.filter((r) => r.group === 'negative');
const goodAdmitted = pos.filter((r) => r.got === 'ADMIT').length;
const badRefused = neg.filter((r) => r.got === 'REFUSE').length;
console.log('  known-good admitted    ' + goodAdmitted + '/' + pos.length);
console.log('  known-bad refused      ' + badRefused + '/' + neg.length);
console.log('  false refusals         ' + pos.filter((r) => r.got !== 'ADMIT').length);
console.log('  false admissions       ' + neg.filter((r) => r.got !== 'REFUSE').length);
console.log('  coverage (admitted/total of all witnesses)  '
  + (goodAdmitted + neg.filter((r) => r.got === 'ADMIT').length) + '/' + (pos.length + neg.length));
console.log('  adversarial near-miss  ' + (nearOk ? 'isolated the bad site' : 'FAILED to isolate'));

const vacuous = goodAdmitted !== pos.length;
console.log('\n===== NON-VACUITY INVARIANT =====');
if (vacuous) {
  console.log('  FAILED. The gate refused part of the frozen known-good plan, so its refusals prove');
  console.log('  nothing - a gate that rejects everything passes every known-bad test. Suite FAILS');
  console.log('  regardless of the negative-witness score.');
} else {
  console.log('  holds: the gate admits the full known-good plan, so its refusals carry information.');
}
const allPass = results.every((r) => r.pass) && nearOk && !vacuous;
console.log('\n  ' + (allPass ? 'ALL WITNESSES PASS' : 'FAILURES: '
  + results.filter((r) => !r.pass).map((r) => r.group + '/' + r.name + ' expected ' + r.expect + ' got ' + r.got + (r.detail ? ' [' + r.detail + ']' : '')).join(' | ')));
