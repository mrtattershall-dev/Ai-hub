// REGISTRY ADEQUACY — three frozen rules against derivations authored before the registry existed.
//
// Predictions frozen in REGISTRY-ADEQUACY_PREREG.md. The registry is NOT expanded, whatever the
// coverage turns out to be; UNKNOWN RULE is a legitimate result and is preserved.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { ADMITTED_RULES, DIGESTS, resolveRule } from './rules.mjs';
import { adapt } from './adapter.mjs';
import { derive, observe, isAuthority } from '../../legaknow/calculus.mjs';
import { observation, OBSERVABILITY } from '../../legaknow/observation.mjs';

const KNOWN_DIR = new URL('../../legaknow/', import.meta.url);

// ---- extract pre-registry derivations mechanically from the legaknow tests ----
// A declaration is { file, name, requires | null }. `null` means the rule stated no requirements at
// all, which derive() treats as [] - a distinction worth keeping, since "declared none" and "declared
// empty" are different authorial acts even where the calculus reads them the same.
function preRegistryRules() {
  const out = [];
  for (const f of readdirSync(KNOWN_DIR).filter((x) => x.endsWith('.test.mjs'))) {
    const src = readFileSync(new URL(f, KNOWN_DIR), 'utf8');
    for (const m of src.matchAll(/rule:\s*(\{[^}]*\})/g)) {
      const text = m[1];
      const name = (text.match(/name:\s*'([^']*)'/) || [])[1] || '(unnamed)';
      const reqM = text.match(/requires:\s*\[([^\]]*)\]/);
      const requires = reqM
        ? reqM[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean)
        : null;
      out.push({ file: f, name, requires });
    }
    // rules bound to a const and passed by reference (the causal one)
    for (const m of src.matchAll(/const\s+\w+\s*=\s*\{\s*name:\s*'([^']*)',\s*requires:\s*\[([^\]]*)\]/g)) {
      out.push({ file: f, name: m[1],
        requires: m[2].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean) });
    }
  }
  return out;
}

const CORPUS = preRegistryRules();
const eq = (a, b) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);
const subset = (a, b) => a.every((x) => b.includes(x));

// FROZEN CLASSIFICATION. Requirement SETS, never names.
function classify(decl) {
  if (decl.requires === null) return { klass: 'UNDECLARED', matches: [] };
  const matches = [];
  for (const [id, r] of Object.entries(ADMITTED_RULES)) {
    const reg = [...r.requires];
    if (eq(reg, decl.requires)) matches.push({ id, rel: 'ADEQUATE' });
    else if (subset(reg, decl.requires)) matches.push({ id, rel: 'UNDER' });
    else if (subset(decl.requires, reg)) matches.push({ id, rel: 'OVER' });
  }
  if (!matches.length) return { klass: 'UNKNOWN_RULE', matches: [] };
  const adequate = matches.filter((m) => m.rel === 'ADEQUATE');
  if (adequate.length > 1) return { klass: 'AMBIGUOUS', matches };
  if (adequate.length === 1) return { klass: 'KNOWN_ADEQUATE', matches };
  const under = matches.filter((m) => m.rel === 'UNDER');
  return { klass: under.length ? 'KNOWN_UNDER' : 'KNOWN_OVER', matches };
}

const TALLY = {};
const ROWS = CORPUS.map((d) => {
  const c = classify(d);
  TALLY[c.klass] = (TALLY[c.klass] || 0) + 1;
  return { ...d, ...c };
});

test('the adequacy table, printed so the record carries it', () => {
  console.log('\n' + 'rule (pre-registry)'.padEnd(24) + 'requires'.padEnd(26) + 'classification');
  const seen = new Set();
  for (const r of ROWS) {
    const key = r.name + '|' + JSON.stringify(r.requires);
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(r.name.padEnd(24)
      + (r.requires === null ? '(none declared)' : JSON.stringify(r.requires)).padEnd(26) + r.klass);
  }
  console.log('\ntally over ' + CORPUS.length + ' declarations: ' + JSON.stringify(TALLY) + '\n');
});

test('A-1 — coverage over pre-registry inference is LOW, and that is the finding', () => {
  const known = (TALLY.KNOWN_ADEQUATE || 0) + (TALLY.KNOWN_UNDER || 0) + (TALLY.KNOWN_OVER || 0);
  const unknownOrUndeclared = (TALLY.UNKNOWN_RULE || 0) + (TALLY.UNDECLARED || 0);
  console.log('   semantically-reaching matches: ' + known + ' / ' + CORPUS.length
    + '   unknown-or-undeclared: ' + unknownOrUndeclared);
  assert.ok(CORPUS.length >= 14, 'the corpus was surveyed at 14+ declarations');
  // the registry was built for quantifier-shaped domain claims; general inference is not that
  assert.ok(unknownOrUndeclared > 0, 'some pre-registry inference must be outside the registry');
});

test('A-2 FAILED, and the reality is WORSE than the prediction it failed against', () => {
  // PREDICTED: requires:[] would match the one empty registry rule, a mechanical ADEQUATE.
  // OBSERVED: it matches ALL THREE. The empty set is a subset of every requirement set, so the
  // empty rule is OVER-matched by every declaration and the other two are matched as well.
  const empties = ROWS.filter((r) => r.requires !== null && r.requires.length === 0);
  assert.ok(empties.length, 'there are derivations declaring requires: []');
  for (const r of empties) {
    assert.equal(r.klass, 'KNOWN_ADEQUATE');
    assert.equal(r.matches.length, 3,
      'PREDICTION FAILED: expected 1 match, got every rule in the registry');
  }
  const names = new Set(empties.map((r) => r.name));
  assert.ok(names.size > 1, 'and several DIFFERENT inferences all match: ' + [...names].join(', '));
});

test('A-3 FAILED — my own frozen classification fabricated the correspondence it forbade', () => {
  // PREDICTED: causal transfer would be UNKNOWN_RULE, because the registry has no vocabulary for it.
  // OBSERVED: KNOWN_UNDER. `claim-from-direct-observation` requires [], and [] is a subset of
  // ['BEFORE','FLOWS_TO'], so the classification reports that the registry "demands less" than the
  // causal rule - a correspondence where there is none.
  //
  // The falsifier I wrote for A-3 was "it maps onto a registry rule, which would mean the mapping is
  // fabricating correspondence". It does, and the mapping was mine.
  const causal = ROWS.find((r) => r.name === 'causal transfer');
  assert.ok(causal, 'the pre-registry causal rule was extracted');
  assert.deepEqual([...causal.requires].sort(), ['BEFORE', 'FLOWS_TO']);
  assert.equal(causal.klass, 'KNOWN_UNDER', 'PREDICTION FAILED: expected UNKNOWN_RULE');
  assert.deepEqual(causal.matches.map((m) => m.id), ['claim-from-direct-observation']);

  // The substance of A-3 is nonetheless true, and is checked directly rather than through the
  // contaminated classification: the registry has no vocabulary for either relation.
  const vocab = new Set(Object.values(ADMITTED_RULES).flatMap((r) => [...r.requires]));
  assert.ok(!vocab.has('BEFORE') && !vocab.has('FLOWS_TO'),
    'neither relation appears anywhere in the registry');
});

test('POST-HOC, labelled as such — what the corrected criterion would have said', () => {
  // NOT the frozen classification, NOT scored, and NOT applied to the registry. Recorded only so the
  // correction the data demands is visible: a rule requiring NOTHING is not evidence of
  // correspondence, because an empty obligation is compatible with any inference whatsoever.
  const corrected = (decl) => {
    if (decl.requires === null) return 'UNDECLARED';
    const usable = Object.entries(ADMITTED_RULES).filter(([, r]) => r.requires.length > 0);
    const hits = usable.filter(([, r]) => r.requires.some((x) => decl.requires.includes(x)));
    if (!hits.length) return 'UNKNOWN_RULE';
    const exact = usable.filter(([, r]) => eq([...r.requires], decl.requires));
    return exact.length === 1 ? 'KNOWN_ADEQUATE' : 'PARTIAL_OVERLAP';
  };
  const tally = {};
  for (const r of ROWS) { const k = corrected(r); tally[k] = (tally[k] || 0) + 1; }
  console.log('   corrected tally: ' + JSON.stringify(tally));
  assert.equal(corrected(ROWS.find((r) => r.name === 'causal transfer')), 'UNKNOWN_RULE',
    'under the corrected criterion causal transfer is unknown, as A-3 predicted');
  assert.equal(corrected(ROWS.find((r) => r.name === 'conjunction')), 'UNKNOWN_RULE',
    'and an empty declaration corresponds to nothing, rather than to everything');
});

const obsToken = () => observe({
  observation: observation({ status: OBSERVABILITY.OBSERVED, value: 'v', subject: 's',
    producer: 'p', procedure: 'proc', attribution: 'a', context: { repository: 'R' } }),
  procedure: 'proc', context: { repository: 'R' } });

test('A-4 NECESSITY — every non-empty registry requirement is load-bearing', () => {
  for (const [id, rule] of Object.entries(ADMITTED_RULES)) {
    if (!rule.requires.length) continue;
    for (const relation of rule.requires) {
      const without = rule.requires.filter((r) => r !== relation).map((r) => ({ relation: r }));
      const out = derive({ premises: [obsToken()], rule: { name: rule.name, requires: [...rule.requires] },
        relationWitnesses: without, claim: 'c' });
      assert.equal(out.minted, false, id + ' still minted without ' + relation
        + ' - that requirement is not load-bearing and is over-specification');
      assert.deepEqual(out.missing, [relation]);
    }
  }
});

test('A-5 SPECIFICITY IS WEAK — the right relation NAME with the wrong content still mints', () => {
  // derive() matches witnesses by `relation` string. A COVERAGE witness that is about a different
  // domain than the claim, or carries no content at all, satisfies the registry mechanically.
  const rule = ADMITTED_RULES['universal-from-exhaustive-coverage'];
  const bogus = derive({ premises: [obsToken()],
    rule: { name: rule.name, requires: [...rule.requires] },
    relationWitnesses: [{ relation: 'COVERAGE', of: 'a completely different domain', evidence: null }],
    claim: 'everything in THIS domain holds' });
  assert.equal(isAuthority(bogus), true,
    'PREDICTED: a name-shaped witness satisfies the requirement AT THE CALCULUS LEVEL; derive()'
    + ' constrains the RELATION NAME and not the relation CONTENT. This is still true and is not'
    + ' repaired by v1.3, because legaknow is not modified to accommodate the consumer.');

  // THE SPECIMEN THIS TEST RECORDED WAS SUBSEQUENTLY REPAIRED, and the repair is asserted here so the
  // finding keeps its history. In v1.2 the same mutation through the adapter still minted; v1.3 gives
  // each obligation a matcher owned by the RULE, so an unbound candidate is never forwarded to
  // derive() and the calculus refuses on a missing witness. See WITNESS-BINDING_PREREG.md, W2.
  const f4 = JSON.parse(readFileSync(new URL('./fixtures/F4.json', import.meta.url), 'utf8'));
  const c = structuredClone(f4);
  c.requested_claim.domain.name = 'A_DOMAIN_NEVER_COVERED';
  const out = adapt(c);
  assert.equal(out.minted, false,
    'REPAIRED IN v1.3: the COVERAGE witness is now re-checked against the claim domain');
  assert.deepEqual(out.missing, ['COVERAGE']);
});

test('the registry was NOT expanded for this experiment', () => {
  assert.deepEqual(Object.keys(ADMITTED_RULES).sort(),
    ['claim-from-direct-observation', 'existential-from-established-member',
      'universal-from-exhaustive-coverage']);
  assert.equal(Object.keys(DIGESTS).length, 3);
});
