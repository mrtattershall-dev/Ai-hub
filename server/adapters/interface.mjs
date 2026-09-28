#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// adapters/interface.mjs — what an adapter is, and the registry that holds them.
//
// An ADAPTER knows how to interact with one KIND of software and how to observe the result. The manager
// does not know about kinds: it asks the registry which adapters PROPOSE themselves given the evidence
// found in the application, runs their probes, and keeps the ones whose probes produced an observable
// effect. Nothing routes on a task name, a filename, a benchmark id, or a human saying "this is a filter".
//
// THE FIVE OUTCOMES an observation attempt can have. They are distinct on purpose, because BATCH-1
// collapsed two of them and reported a working input-driven filter as an application with no behaviour:
//
//   BASELINE_ERROR            the application itself failed - it threw while loading
//   PROBE_ERROR               our probe failed - the interaction could not be performed
//   UNSUPPORTED_OBSERVATION   no registered adapter can observe this application at all
//   NO_CHANGE_OBSERVED        probes ran and nothing changed UNDER THE PROBES ATTEMPTED. This is NOT
//                             "the application does nothing" and must never be reported as one.
//   CONFIRMED_BEHAVIOUR       an interaction produced an observable effect
//
// AN ADAPTER IMPLEMENTS:
//
//   id            stable string, e.g. 'browser.input'
//   domain        'browser' today; 'cli' and 'warehouse' are future domains and are NOT implemented
//   propose(ev)   given the evidence gathered from the application, return candidate PLANS:
//                   { id, adapterId, what, interactions, evidence[], uncertainty[], priority }
//                 A plan is a HYPOTHESIS. It says "this interaction might do something here, and here is
//                 why I think so". It is never a classification of the application.
//   probe(ctx,p)  perform the plan's interactions in an isolated page and return STRUCTURED
//                 observations - values, not messages. Never parse an assertion string to recover state.
//
// WHAT AN ADAPTER MAY NOT DO: decide that a change should be retained, define what the correct result
// is, or relax a check. Identifying an interaction establishes RESPONSIVENESS, never CORRECTNESS: an
// input that changes a list shows the list responds, not that it filters correctly. Expected behaviour
// comes from requirements and independently defined checks.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export const OUTCOME = {
  BASELINE_ERROR: 'BASELINE_ERROR',
  PROBE_ERROR: 'PROBE_ERROR',
  UNSUPPORTED_OBSERVATION: 'UNSUPPORTED_OBSERVATION',
  NO_CHANGE_OBSERVED: 'NO_CHANGE_OBSERVED',
  CONFIRMED_BEHAVIOUR: 'CONFIRMED_BEHAVIOUR',
};

/** Domains that exist. Only `browser` has adapters; the others are declared so the shape is fixed. */
export const DOMAINS = ['browser', 'cli', 'warehouse'];

const registry = new Map();

export function register(adapter) {
  for (const k of ['id', 'domain', 'propose', 'probe']) {
    if (!adapter || adapter[k] === undefined) throw new Error(`an adapter needs ${k}`);
  }
  if (!DOMAINS.includes(adapter.domain)) throw new Error(`unknown domain ${adapter.domain}`);
  registry.set(adapter.id, adapter);
  return adapter;
}

export function adaptersFor(domain) {
  return [...registry.values()].filter((a) => a.domain === domain);
}

export function allAdapters() { return [...registry.values()]; }

export function getAdapter(id) { return registry.get(id) || null; }

/** For the record: which domains have adapters and which are declared but unimplemented. */
export function coverage() {
  const byDomain = {};
  for (const d of DOMAINS) byDomain[d] = adaptersFor(d).map((a) => a.id);
  return {
    byDomain,
    implemented: DOMAINS.filter((d) => byDomain[d].length),
    declaredButNotImplemented: DOMAINS.filter((d) => !byDomain[d].length),
  };
}
