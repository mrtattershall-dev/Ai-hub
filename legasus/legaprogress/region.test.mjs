// THE EXECUTION REGION AND ITS BOUNDARY.
//
// The property that matters most here is the one that is easiest to fake: the boundary must be DERIVED
// from surviving evidence, which means it must be able to be EMPTY. A boundary generator that always
// finds something is indistinguishable from a planner inventing work, and over two months it would keep
// the system permanently busy without the project ever being finished with anything.
import test from 'node:test';
import assert from 'node:assert';
import { buildRegion, boundaryOf, regionDelta, regionDensity, BOUNDARY } from './region.mjs';

// Two functions in one module. `handle` has five sites; the region only ever takes one of its branches.
const SITEMAP = {
  'handle': { module: 'app', lines: [10, 11, 12, 13, 14] },
  'helper': { module: 'app', lines: [20, 21] },
  'never_called': { module: 'app', lines: [30, 31] },
};

const W_A = { id: 'wA', rootSubject: 'app.main', entered: ['app.main', 'app.handle', 'app.helper'],
  lines: ['app:10', 'app:11', 'app:12', 'app:20', 'app:21'] };
const W_B = { id: 'wB', rootSubject: 'app.main', entered: ['app.main', 'app.handle'],
  lines: ['app:10', 'app:13'] };

test('the region is built at SITE granularity and retains WHICH witness established each site', () => {
  const r = buildRegion({ witnesses: [W_A, W_B], roots: ['app.main'], siteMap: SITEMAP });
  assert.ok(r.subjects.has('app.handle'));
  assert.ok(r.subjects.has('app.helper'));
  assert.deepEqual(r.sites.get('app:10'), ['wA', 'wB'], 'attribution is what makes it re-checkable');
  assert.deepEqual(r.sites.get('app:13'), ['wB']);
  assert.equal(r.sites.has('app:14'), false, 'a site nothing executed is NOT in the region');
});

test('UNEXERCISED BRANCH — the boundary is inside a function the region genuinely runs', () => {
  const r = buildRegion({ witnesses: [W_A, W_B], roots: ['app.main'], siteMap: SITEMAP });
  const b = boundaryOf(r);
  const branch = b.filter((x) => x.kind === BOUNDARY.UNEXERCISED_BRANCH);
  assert.equal(branch.length, 1, JSON.stringify(b));
  assert.equal(branch[0].subject, 'handle');
  assert.deepEqual(branch[0].missing, [14]);
  assert.equal(branch[0].established, 4);
  // `helper` is fully established, so it is INTERIOR and must not appear as a boundary.
  assert.equal(b.some((x) => x.subject === 'helper'), false);
  // `never_called` has no established site at all, so it is not part of THIS region and is not its
  // boundary either - it would be reached, if ever, as an UNREACHED_CALLEE with a real call edge.
  assert.equal(b.some((x) => x.subject === 'never_called'), false);
});

test('THE BOUNDARY CAN BE EMPTY — or it is a work generator wearing a graph', () => {
  const full = { id: 'wF', rootSubject: 'app.main', entered: ['app.main', 'app.handle', 'app.helper'],
    lines: ['app:10', 'app:11', 'app:12', 'app:13', 'app:14', 'app:20', 'app:21'] };
  const r = buildRegion({ witnesses: [full], roots: ['app.main'], siteMap: SITEMAP });
  assert.deepEqual(boundaryOf(r), [],
    'a fully established region owes no work, and the system must be able to say so');
});

test('MEMBERSHIP IS DECIDED BY SITES, NOT NAMES', () => {
  // The traced frame is `app.handle`; the site map is keyed `handle`. If the boundary detector matched
  // names it would silently find nothing here, and report a fully-explored project forever.
  const r = buildRegion({ witnesses: [W_B], roots: ['app.main'], siteMap: SITEMAP });
  const branch = boundaryOf(r).filter((x) => x.kind === BOUNDARY.UNEXERCISED_BRANCH);
  assert.equal(branch.length, 1);
  assert.equal(branch[0].established, 2, 'app:10 and app:13');
  assert.equal(branch[0].total, 5);
});

test('UNREACHED CALLEE — region code calls it, the region has never run it', () => {
  const r = buildRegion({ witnesses: [W_A], roots: ['app.main'], siteMap: SITEMAP });
  const b = boundaryOf(r, { calls: { 'app.handle': ['app.helper', 'app.never_called'] } });
  const callees = b.filter((x) => x.kind === BOUNDARY.UNREACHED_CALLEE);
  assert.deepEqual(callees.map((c) => c.subject), ['app.never_called']);
  assert.equal(callees[0].from, 'app.handle');
});

test('STALE EDGE — a boundary that used to be interior, when its witness expires', () => {
  const r = buildRegion({ witnesses: [W_A, W_B], roots: ['app.main'], siteMap: SITEMAP });
  const clean = boundaryOf(r).filter((x) => x.kind === BOUNDARY.STALE_EDGE);
  assert.equal(clean.length, 0);
  const b = boundaryOf(r, { staleWitnessIds: new Set(['wB']) });
  const stale = b.filter((x) => x.kind === BOUNDARY.STALE_EDGE);
  assert.equal(stale.length, 1, 'evidence expiring must reopen territory the project thought it held');
});

test('UNOBSERVABLE EDGE is surfaced, never omitted, and never counted as a negative', () => {
  const r = buildRegion({ witnesses: [W_A], roots: ['app.main'], siteMap: SITEMAP });
  const b = boundaryOf(r, { unobservable: [{ subject: 'app.native_ext',
    why: 'execution leaves Python here' }] });
  const u = b.filter((x) => x.kind === BOUNDARY.UNOBSERVABLE_EDGE);
  assert.equal(u.length, 1);
  assert.match(u[0].why, /leaves Python/);
  assert.notEqual(u[0].kind, BOUNDARY.ABSENT_CAPABILITY,
    'not knowing is a different fact from not having');
});

test('REGION DELTA keeps expansion, strengthening and loss as THREE facts, never one number', () => {
  const before = buildRegion({ witnesses: [W_B], roots: ['app.main'], siteMap: SITEMAP });
  const after = buildRegion({ witnesses: [W_A, W_B], roots: ['app.main'], siteMap: SITEMAP });

  const grew = regionDelta(before, after);
  assert.equal(grew.expanded, true, 'app.helper is new territory');
  assert.deepEqual(grew.gainedSubjects, ['app.helper']);
  assert.equal(grew.lost, false);
  assert.ok(grew.territoryAfter > grew.territoryBefore);

  // STRENGTHENING is not expansion: the same subjects, established more thoroughly.
  const deeper = buildRegion({ witnesses: [W_B,
    { id: 'wC', rootSubject: 'app.main', entered: ['app.main', 'app.handle'], lines: ['app:11'] }],
  roots: ['app.main'], siteMap: SITEMAP });
  const s = regionDelta(before, deeper);
  assert.equal(s.expanded, false);
  assert.equal(s.strengthened, true, 'more sites in the same functions is a real, different kind of gain');

  // And LOSS is reported even when something else grew alongside it.
  const lost = regionDelta(after, before);
  assert.equal(lost.lost, true);
  assert.deepEqual(lost.lostSubjects, ['app.helper']);
});

test('REGION DENSITY reports what was measured on real code, rather than assuming it', () => {
  const r = buildRegion({ witnesses: [W_A, W_B], roots: ['app.main'], siteMap: SITEMAP });
  const d = regionDensity(r);
  assert.equal(d.full, 1, 'helper');
  assert.equal(d.partial, 1, 'handle');
  assert.equal(d.established, 6);
  assert.equal(d.total, 7);
  assert.ok(d.density > 0.8 && d.density < 1);
});
