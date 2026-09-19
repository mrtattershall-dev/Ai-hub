// SURVEY — build a CAPABILITY FRONTIER for a repository out of nothing but its own authored evidence.
//
// This is the bridge that lets the upper architecture touch real code. LegaProgress compares two
// frontiers; this is where a frontier comes from when nobody has written one by hand.
//
// A doctest is not merely a runnable example. It is an ASSERTION ABOUT BEHAVIOUR written by someone with
// the authority to make it, which is exactly what separates REACHABLE from VERIFIED:
//
//     reached, no assertion attached       REACHABLE   reality touches the code; nothing is claimed
//     reached, assertion held              VERIFIED    witness + assertion
//     reached, assertion did NOT hold      FALSIFIED   a counterexample, scoped to this source
//     never reached                        (absent)    no claim of any kind
import { mineDoctests } from './mine.mjs';
import { observe } from './witness.mjs';
import { STATE, BASIS, assertClaim } from '../legaknow/ledger.mjs';

const lastSeg = (s) => String(s).split('.').filter(Boolean).pop() || '<module>';

// Did the authored assertion hold? Doctests assert two different kinds of thing and conflating them
// would silently mark every documented exception as a failure.
export function assertionHeld({ wants, status, value }) {
  if (!wants) return null;                                   // nothing was asserted
  if (/^Traceback/.test(wants)) {
    if (!String(status).startsWith('RAISED:')) return false;
    const exc = String(status).slice('RAISED:'.length);
    return wants.includes(exc);
  }
  if (String(status).startsWith('RAISED:')) return false;     // it was supposed to return something
  return String(value) === String(wants);
}

export function surveyFrontier({ rootDir, packageName, filterModule = null }) {
  const mined = mineDoctests({ rootDir, packageName })
    .filter((m) => !filterModule || m.module === filterModule);
  const bySubject = new Map();
  const witnesses = [];
  const runs = [];

  for (const ex of mined) {
    const mod = ex.module.replace(/\.py$/, '');
    const subject = mod + '.' + lastSeg(ex.owner);
    const r = observe({ rootDir, packageName, setup: ex.setup, invocation: ex.invocation,
      namespaceModule: ex.dotted });
    const rec = { subject, invocation: ex.invocation, wants: ex.wants,
      status: r ? r.status : 'UNOBSERVABLE', value: r ? r.value : null,
      entered: r ? (r.entered || []) : [] };
    rec.held = r ? assertionHeld({ wants: ex.wants, status: r.status, value: r.value }) : null;
    runs.push(rec);
    if (r && (r.entered || []).length) {
      witnesses.push({ rootSubject: subject, entered: r.entered });
    }
    const agg = bySubject.get(subject)
      || { subject, reached: 0, held: 0, failed: 0, files: new Set(), counterexamples: [] };
    if (r && (r.entered || []).length) agg.reached++;
    if (rec.held === true) agg.held++;
    if (rec.held === false) {
      agg.failed++;
      agg.counterexamples.push(ex.invocation + ' -> ' + rec.value + ' (documented: ' + ex.wants + ')');
    }
    agg.files.add(packageName + '/' + ex.module);
    bySubject.set(subject, agg);
  }

  const frontier = {};
  for (const a of bySubject.values()) {
    const invalidationSet = [...a.files];
    let state;
    if (a.failed > 0) state = STATE.FALSIFIED;
    else if (a.held > 0) state = STATE.VERIFIED;
    else if (a.reached > 0) state = STATE.REACHABLE;
    else state = STATE.CLAIMED;
    frontier[a.subject] = { subject: a.subject, state, invalidationSet,
      held: a.held, failed: a.failed, reached: a.reached, counterexamples: a.counterexamples };
  }
  return { frontier, witnesses, runs, minedCount: mined.length };
}

// Frontier entries as ledger claims, so the epistemic ratchet applies to them like anything else.
export function claimsFromFrontier(frontier, world) {
  const out = [];
  for (const f of Object.values(frontier)) {
    const basis = f.state === STATE.FALSIFIED ? BASIS.PROOF : BASIS.EXECUTION_WITNESS;
    const evidence = f.state === STATE.FALSIFIED ? f.counterexamples
      : ['doctest witness: ' + f.held + ' assertion(s) held, ' + f.reached + ' execution(s)'];
    out.push(assertClaim({ subject: f.subject, predicate: 'behaves as its own documentation says',
      state: f.state, basis, world, evidence, invalidationSet: f.invalidationSet }));
  }
  return out;
}
