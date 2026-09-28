// ACTION-GOVERNANCE-1 BEHAVIOURAL BASELINE. Read-only probe: calls the calculus, changes nothing.
//
// WHY THIS EXISTS. Amendment 1 established its baseline by GREPPING for the words scope, budget, expiry
// and revoke, found zero, and recorded six bindings as ABSENT. That is search evidence, not proof of
// absent enforcement — and it was wrong at least once: context monotonicity IS enforced, under the names
// `context` and `widened`, from composition attack W3-c. The decisive baseline is a behavioural case
// showing the undesired permission actually SUCCEEDS.
//
// Each probe declares what it EXPECTS and prints whether the calculus permits or refuses. A probe that
// SUCCEEDS where it should be refused is a real gap. A probe that is refused is a binding already held.
import { delegate, commit, observe, isAuthority, KIND } from '../../legaknow/calculus.mjs';

const line = (s) => console.log(s);
const verdict = (r) => (r && r.minted === false) ? 'REFUSED  — ' + String(r.why).slice(0, 96)
  : (isAuthority(r) ? 'PERMITTED (token minted)' : 'PERMITTED/other: ' + JSON.stringify(r).slice(0, 96));

const OWNER_GRANT = ['edit:fixture'];
const CTX = { repository: 'S1', implementation: 'fixture.js' };

const root = delegate({ from: 'OWNER', grant: OWNER_GRANT, to: 'controller', context: CTX });
line('root token minted: ' + isAuthority(root) + '   kind=' + (root && root.kind));
line('');

// ---------------------------------------------------------------- already-held bindings, re-confirmed
line('=== BINDINGS EXPECTED TO BE ALREADY HELD (a refusal here is good) ===');

line('B1 widen the GRANT beyond the grantor');
line('   ' + verdict(delegate({ from: root, grant: ['edit:fixture', 'deploy:prod'], to: 'sub', context: CTX })));

line('B2 DROP a context dimension the grantor pins (grant over every world)');
line('   ' + verdict(delegate({ from: root, grant: OWNER_GRANT, to: 'sub', context: {} })));

line('B3 CHANGE a pinned context dimension (different repository)');
line('   ' + verdict(delegate({ from: root, grant: OWNER_GRANT, to: 'sub',
  context: { repository: 'S2', implementation: 'fixture.js' } })));

const ev = observe({ observation: { subject: 'fixture.js' }, procedure: 'probe', context: CTX });
line('B4 delegate FROM an epistemic token (belief laundered into permission)');
line('   ' + verdict(delegate({ from: ev, grant: OWNER_GRANT, to: 'sub', context: CTX })));

line('B5 commit with a bare EPISTEMIC token');
line('   ' + verdict(commit({ authority: ev, action: 'edit fixture.js', requires: OWNER_GRANT })));

line('B6 CONTROLLER-HELD but legitimately issued: exercise it (MUST be permitted — holding is not creating)');
line('   ' + verdict(commit({ authority: root, action: 'edit fixture.js', requires: OWNER_GRANT })));
line('');

// ---------------------------------------------------------------- suspected gaps
line('=== SUSPECTED GAPS (a PERMITTED here is the gap, measured not grepped) ===');

line('G1 SIBLING BUDGET: parent holds one grant; give TWO children the FULL grant each');
const c1 = delegate({ from: root, grant: OWNER_GRANT, to: 'childA', context: CTX });
const c2 = delegate({ from: root, grant: OWNER_GRANT, to: 'childB', context: CTX });
line('   childA: ' + verdict(c1));
line('   childB: ' + verdict(c2));
line('   both minted => no shared accounting: ' + (isAuthority(c1) && isAuthority(c2)));

line('G2 REPLAY: consume the same token for two separate actions');
const u1 = commit({ authority: root, action: 'edit fixture.js #1', requires: OWNER_GRANT });
const u2 = commit({ authority: root, action: 'edit fixture.js #2', requires: OWNER_GRANT });
line('   use #1: ' + verdict(u1));
line('   use #2: ' + verdict(u2));
line('   same token consumed twice: ' + (!!(u1 && u1.committed) && !!(u2 && u2.committed)));

line('G3 EXECUTION-TIME TARGET BINDING: context pins implementation=fixture.js;');
line('   commit an action against a DIFFERENT file');
line('   ' + verdict(commit({ authority: root, action: 'edit OTHER.js', requires: OWNER_GRANT })));

line('G4 EVIDENCE PRECONDITION: commit with NO admitted evidence at all');
line('   ' + verdict(commit({ authority: root, action: 'edit fixture.js', requires: OWNER_GRANT })));

line('G5 REVOCATION: is there any revoke/expire surface on a token?');
const keys = root && Object.keys(root);
line('   token fields: ' + JSON.stringify(keys));
line('   any expiry/revocation field: '
  + (keys || []).some((k) => /expir|revok|ttl|until|issuedAt|budget/i.test(k)));
