// M-1..M-4 — what is the minimum world identity for an observation's authority to transfer?
//
// Frozen in WORLD-IDENTITY_PREREG.md. This is a MEASUREMENT: adapter.mjs, rules.mjs and the contract
// are not modified here. It searches every subset of the candidate coordinates and reports which
// minimally satisfy the arms.
import test from 'node:test';
import assert from 'node:assert';

const COORDS = ['repository', 'claim_domain', 'evidence_extent', 'procedure'];

// A world, as a token might carry it. `evidence_extent` is a NUMBER: the portion of the domain
// actually examined, so it can be ordered rather than only compared for equality.
const W = (over = {}) => ({ repository: 'R', claim_domain: 'D', evidence_extent: 100,
  procedure: 'enumerate', ...over });

// THE CHECK UNDER TEST, parameterised by which coordinates count as identity. Equality for identity
// coordinates; extent, when included as identity, is compared for equality like the rest - which is
// precisely what M-3 predicts will break legitimate narrowing.
function transfers(tokenWorld, neededWorld, C) {
  for (const c of C) {
    if (tokenWorld[c] !== neededWorld[c]) return false;
  }
  return true;
}

// The arms. Each is [name, tokenWorld, neededWorld, mustTransfer].
const ARMS = [
  ['D1  different repository', W({ repository: 'OTHER' }), W(), false],
  ['D2  different claim domain', W({ claim_domain: 'OTHER' }), W(), false],
  ['D3a token examined MORE than needed', W({ evidence_extent: 100 }), W({ evidence_extent: 50 }), true],
  ['D3b token examined LESS than needed', W({ evidence_extent: 50 }), W({ evidence_extent: 100 }), false],
  ['D4  every coordinate identical', W(), W(), true],
];

const subsets = (xs) => xs.reduce((acc, x) => acc.concat(acc.map((s) => [...s, x])), [[]]);

// A subset qualifies if it gives the required verdict on every arm. Extent is handled by an ORDERING
// when it is NOT an identity coordinate: a token that examined at least what is needed may transfer.
function evaluate(C) {
  const usesExtentAsIdentity = C.includes('evidence_extent');
  const failures = [];
  for (const [name, tok, need, must] of ARMS) {
    let got = transfers(tok, need, C);
    if (!usesExtentAsIdentity) {
      // the ordering rule, applied only when extent is not an equality coordinate
      got = got && tok.evidence_extent >= need.evidence_extent;
    }
    if (got !== must) failures.push(name);
  }
  return { ok: failures.length === 0, failures };
}

const ALL = subsets(COORDS).map((C) => ({ C, ...evaluate(C) }));
const QUALIFYING = ALL.filter((r) => r.ok);
const MINIMAL = QUALIFYING.filter((r) => !QUALIFYING.some((o) => o !== r
  && o.C.length < r.C.length && o.C.every((c) => r.C.includes(c))));

test('the search, printed so the record carries it', () => {
  console.log('\n' + 'coordinate subset'.padEnd(52) + 'verdict');
  for (const r of ALL) {
    const label = r.C.length ? r.C.join(' + ') : '(none)';
    console.log(label.padEnd(52) + (r.ok ? 'QUALIFIES' : 'fails: ' + r.failures[0].trim()));
  }
  console.log('\nminimal qualifying: '
    + MINIMAL.map((r) => '{' + r.C.join(', ') + '}').join('  |  ') + '\n');
});

test('M-1 — no single coordinate qualifies', () => {
  const singles = ALL.filter((r) => r.C.length === 1);
  for (const s of singles) {
    assert.equal(s.ok, false, s.C[0] + ' alone must not qualify');
  }
  assert.ok(ALL.find((r) => r.C.length === 1 && r.C[0] === 'repository').failures
    .some((f) => f.startsWith('D2')), 'repository alone fails on a changed claim domain');
  assert.ok(ALL.find((r) => r.C.length === 1 && r.C[0] === 'claim_domain').failures
    .some((f) => f.startsWith('D1')), 'claim_domain alone fails on a changed repository');
});

test('M-2 — the unique minimal qualifying subset is {repository, claim_domain}', () => {
  assert.equal(MINIMAL.length, 1, 'expected exactly one minimal subset, got '
    + MINIMAL.map((r) => r.C.join('+')).join(' | '));
  assert.deepEqual([...MINIMAL[0].C].sort(), ['claim_domain', 'repository']);
});

test('M-3 — extent as an EQUALITY coordinate fails D3a specifically', () => {
  const withExtent = ALL.find((r) => r.C.length === 3
    && ['repository', 'claim_domain', 'evidence_extent'].every((c) => r.C.includes(c)));
  assert.equal(withExtent.ok, false);
  assert.deepEqual(withExtent.failures.map((f) => f.slice(0, 3)), ['D3a'],
    'it refuses a legitimate narrowing, and nothing else');
});

test('M-4 — procedure is not necessary for transfer', () => {
  const minimal = MINIMAL[0].C;
  assert.ok(!minimal.includes('procedure'), 'procedure is not in the minimal identity');
  // two observations of the same relation, same domain, same repository, different procedures
  const a = W({ procedure: 'enumerate' });
  const b = W({ procedure: 'sample-and-bound' });
  assert.equal(transfers(a, b, minimal), true,
    'a relation established by another procedure in the same world still transfers');
});

test('the answer governs what goes in the token context, and nothing more', () => {
  const minimal = MINIMAL[0].C;
  const notIdentity = COORDS.filter((c) => !minimal.includes(c));
  assert.deepEqual(notIdentity.sort(), ['evidence_extent', 'procedure']);
  // these are recorded PROVENANCE, not identity - the dimension/UNADMITTED distinction the
  // justification graph already draws.
  console.log('   identity  : ' + minimal.join(', '));
  console.log('   provenance: ' + notIdentity.join(', ') + '  (extent additionally ORDERED)');
});
