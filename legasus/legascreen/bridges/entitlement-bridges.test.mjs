// STEP 3/4 — the four entitlement bridges run through bridge.mjs against the six frozen certificates.
//
// Production is Python, read ONLY through the certificate fixtures. The calculus is passed INTO each
// bridge's toSpecification by this test; no bridge file imports it. Both endpoints are pinned by digest.
//
// Every WIDE bridge is PARTIAL and must yield UNMAPPABLE on every certificate - that is the framework's
// guarantee, asserted here so a bridge cannot quietly convict through its wide form. RESTRICTED bridges
// are applied ONLY inside their declared domain, decided on the certificate before any comparison.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { bridge, compare, digestOf, RELATION, COMPARISON } from '../bridge.mjs';
import * as C from '../../legaknow/calculus.mjs';
import * as Obs from '../../legaknow/observation.mjs';
import * as J from '../../legaknow/justification.mjs';
import * as MO from './measurement-observe.mjs';
import * as DD from './derivation-derive.mjs';
import * as OC from './obligation-covers.mjs';
import * as LN from './licensed-narrowing.mjs';

const load = (n) => JSON.parse(readFileSync(new URL('./fixtures/' + n + '.json', import.meta.url), 'utf8'));
const NAMES = ['F1', 'F2', 'F3', 'F3p', 'F4', 'F5'];
const CERTS = Object.fromEntries(NAMES.map((n) => [n, load(n)]));

const SPEC = {
  calculus: digestOf(new URL('../../legaknow/calculus.mjs', import.meta.url)),
  justification: digestOf(new URL('../../legaknow/justification.mjs', import.meta.url)),
};
const prodDigest = (cert) => cert.provenance.producer_digest.slice(0, 16);

// Each bridge, with the reader/translator plumbing this test owns.
const BRIDGES = {
  'measurement-observe': {
    mod: MO, spec: SPEC.calculus,
    unrep: (c) => MO.unrepresentable(c.measurement),
    inDomain: (c) => MO.inDomain(c.measurement),
    prod: (c) => MO.readProduction(c.measurement),
    spec_: (c) => MO.readSpecification(MO.toSpecification(C, Obs, c)),
  },
  'derivation-derive': {
    mod: DD, spec: SPEC.justification,
    unrep: (c) => DD.unrepresentable(c.derivation),
    inDomain: (c) => DD.inDomain(c.derivation),
    prod: (c) => DD.readProduction(c.derivation),
    spec_: (c) => DD.readSpecification(DD.toSpecification(J, c)),
  },
  'obligation-covers': {
    mod: OC, spec: SPEC.justification,
    unrep: (c) => OC.unrepresentable(c),
    inDomain: (c) => OC.inDomain(c),
    prod: (c) => OC.readProduction(c),
    spec_: (c) => OC.readSpecification(OC.toSpecification(J, c)),
  },
  'licensed-narrowing': {
    mod: LN, spec: SPEC.justification,
    unrep: (c) => LN.unrepresentable(c),
    inDomain: (c) => LN.inDomain(c),
    prod: (c) => LN.readProduction(c),
    spec_: (c) => LN.readSpecification(LN.toSpecification(J, c)),
  },
};

const mk = (B, which, cert) => bridge({ ...B.mod[which],
  valid_against: { production: prodDigest(cert), specification: B.spec } });

// One (bridge, certificate) evaluation. Representability and domain are decided BEFORE comparing.
function evaluate(name, cert) {
  const B = BRIDGES[name];
  const digests = { production: prodDigest(cert), specification: B.spec };
  const gap = B.unrep(cert);
  const wide = compare({ bridge: mk(B, 'WIDE', cert), digests,
    production: gap ? { result: null } : B.prod(cert),
    specification: gap ? { result: null } : B.spec_(cert) });
  if (gap) return { wide: wide.comparison, restricted: 'UNMAPPABLE', gap };
  if (!B.inDomain(cert)) return { wide: wide.comparison, restricted: 'OUT_OF_DOMAIN' };
  const r = compare({ bridge: mk(B, 'RESTRICTED', cert), digests,
    production: B.prod(cert), specification: B.spec_(cert) });
  return { wide: wide.comparison, restricted: r.comparison, why: r.why };
}

const MATRIX = {};
for (const name of Object.keys(BRIDGES)) {
  MATRIX[name] = {};
  for (const n of NAMES) MATRIX[name][n] = evaluate(name, CERTS[n]);
}

test('the matrix, printed so the record carries it', () => {
  console.log('\n' + 'bridge \\ cert'.padEnd(22) + ' ' + NAMES.map((n) => n.padEnd(15)).join(''));
  for (const [name, row] of Object.entries(MATRIX)) {
    console.log(name.padEnd(22) + ' ' + NAMES.map((n) => row[n].restricted.padEnd(15)).join(''));
  }
  console.log();
});

test('construction — every bridge pins BOTH endpoints; a bridge without them is refused', () => {
  for (const [name, B] of Object.entries(BRIDGES)) {
    for (const which of ['WIDE', 'RESTRICTED']) {
      assert.ok(mk(B, which, CERTS.F4), name + ' ' + which);
      assert.throws(() => bridge({ ...B.mod[which] }), /valid_against/, name + ' ' + which + ' unpinned');
    }
  }
});

test('WIDE is PARTIAL and licenses NO verdict on any certificate, for every bridge', () => {
  for (const [name, row] of Object.entries(MATRIX)) {
    for (const n of NAMES) {
      assert.equal(row[n].wide, COMPARISON.UNMAPPABLE, name + '/' + n + ' wide must not convict');
    }
  }
});

test('measurement-observe — the RESTRICTED domain is EMPTY on contract v1.0.0: attribution is missing', () => {
  for (const n of NAMES) {
    const r = MATRIX['measurement-observe'][n];
    assert.equal(r.restricted, 'UNMAPPABLE', n);
    assert.match(r.gap, /attribution/, n + ' must name the missing provenance field');
    assert.match(r.gap, /gap in the CONTRACT/, n + ' must locate the gap in the contract, not production');
  }
  // and observe() itself refuses for the same reason when the field is passed as null
  const tok = MO.toSpecification(C, Obs, CERTS.F4);
  assert.equal(tok.minted, false);
  assert.equal(tok.reason, 'PROVENANCE_INCOMPLETE');
});

test('derivation-derive — an UNDECIDABLE premise is UNMAPPABLE; decidable ones AGREE on both answers', () => {
  const row = MATRIX['derivation-derive'];
  assert.equal(row.F2.restricted, 'UNMAPPABLE', 'F2 carries the undecidable premise (site #7)');
  assert.match(row.F2.gap, /UNDECIDABLE/);
  assert.match(row.F2.gap, /H-DEFINED/);
  for (const n of ['F1', 'F3', 'F3p', 'F4']) {
    assert.equal(row[n].restricted, COMPARISON.AGREE, n + ' both PERMITTED for corresponding reasons');
  }
  // F5: decidable but unsettled - both must REFUSE, and for CORRESPONDING reasons, not merely the same answer
  assert.equal(row.F5.restricted, COMPARISON.AGREE, 'F5 ' + (row.F5.why || ''));
  assert.match(row.F5.why, /justifications correspond/);
});

test('obligation-covers — EXISTS/POINTWISE are UNMAPPABLE; FOR_ALL and NONE AGREE', () => {
  const row = MATRIX['obligation-covers'];
  for (const n of ['F1', 'F2', 'F3', 'F5']) {
    assert.equal(row[n].restricted, 'UNMAPPABLE', n + ' has a quantifier covers() cannot express');
    assert.match(row[n].gap, /no counterpart in covers/);
  }
  assert.equal(row.F4.restricted, COMPARISON.AGREE, 'F4 FOR_ALL over an exhaustively covered sample');
  assert.equal(row.F3p.restricted, COMPARISON.AGREE, 'F3p ABSENCE over an uncovered repository');
  assert.match(row.F3p.why, /justifications correspond/, 'both refuse for NOT_ESTABLISHED');
});

test('licensed-narrowing — no real certificate is in the RESTRICTED domain after REPAIR-LATERAL', () => {
  const row = MATRIX['licensed-narrowing'];
  for (const n of NAMES) {
    assert.equal(row[n].restricted, 'OUT_OF_DOMAIN', n + ' has licensed_relation NONE or EQUIVALENT');
  }
});

test('licensed-narrowing — the DEMOTION, with the disagreement that forced it kept in the test', () => {
  // PREDICTED before the first run and OBSERVED: on a synthetic LICENSES certificate inside the domain
  // as first declared, production PERMITTED and the calculus REFUSED ("stated for THIS_RUN from a
  // premise established at SAMPLE"). The calculus has no domain containment. The bridge was demoted by
  // making containment UNREPRESENTABLE; the raw disagreement is reproduced here through the readers
  // directly so the record carries WHY, not only the demoted result.
  const synthetic = structuredClone(CERTS.F4);
  synthetic.licensed_claim = { domain: { name: 'THIS_RUN', contained_in: ['SAMPLE', 'REPOSITORY'] },
    quantifier: 'FOR_ALL', predicate: synthetic.requested_claim.predicate };
  synthetic.licensed_relation = 'LICENSES';

  // (a) the raw disagreement, readers only, bypassing the vocabulary check
  const B = BRIDGES['licensed-narrowing'];
  const raw = compare({ bridge: mk(B, 'RESTRICTED', synthetic),
    digests: { production: prodDigest(synthetic), specification: B.spec },
    production: B.prod(synthetic), specification: B.spec_(synthetic) });
  console.log('   raw (readers only):  ', raw.comparison, '-', raw.why.slice(0, 90));
  assert.equal(raw.comparison, COMPARISON.RESULT_DISAGREEMENT, 'the finding that forced the demotion');

  // (b) the demoted bridge: containment is UNMAPPABLE, located in the specification's vocabulary
  const gap = LN.unrepresentable(synthetic);
  assert.match(gap, /CONTAINED in requested .* but differs/);
  assert.match(gap, /no domain containment/);
  assert.match(gap, /Gap in the SPECIFICATION vocabulary/);
  assert.equal(LN.inDomain(synthetic), false, 'the demoted domain excludes it');
  const r = evaluate('licensed-narrowing', synthetic);
  console.log('   demoted bridge:      ', r.restricted);
  assert.equal(r.restricted, 'UNMAPPABLE');
});

test('endpoint drift — either digest moving makes every bridge UNKNOWN, unable to convict or absolve', () => {
  for (const [name, B] of Object.entries(BRIDGES)) {
    const cert = CERTS.F4;
    const b = mk(B, 'RESTRICTED', cert);
    for (const side of ['production', 'specification']) {
      const digests = { production: prodDigest(cert), specification: B.spec, [side]: 'moved' };
      const r = compare({ bridge: b, digests, production: { result: 'PERMITTED', reasonClass: 'x' },
        specification: { result: 'PERMITTED', reasonClass: 'x' } });
      assert.equal(r.comparison, COMPARISON.UNKNOWN, name + ' ' + side);
      assert.equal(r.stale, side);
    }
  }
});

test('the specification is never imported by a bridge file', () => {
  for (const f of ['measurement-observe', 'derivation-derive', 'obligation-covers', 'licensed-narrowing']) {
    const src = readFileSync(new URL('./' + f + '.mjs', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /from ['"]\.\.\/\.\.\/legaknow/, f + ' must not import the calculus');
    assert.match(src, /import \{ RELATION \} from '\.\.\/bridge\.mjs'/, f + ' imports only the framework');
  }
});
