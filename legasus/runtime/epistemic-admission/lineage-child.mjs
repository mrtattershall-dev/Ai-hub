// THE OTHER SIDE OF A FRESH PROCESS BOUNDARY, for the decisive continuity pair.
//
// L2 and L3 are both about what a replacement can and cannot inherit. In one process, object
// identity, a shared store, a live WeakSet and the module graph are all available to make two
// things distinguishable for reasons that have nothing to do with the contract. Only bytes cross
// here: this file is run as `node lineage-child.mjs <case.json>` and prints one JSON object.
import { readFileSync } from 'node:fs';
import { merge, replayMerged } from './merge.mjs';
import { store } from './authority-store.mjs';

const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const m = merge(input.sources);
if (!m.ok) {
  process.stdout.write(JSON.stringify({ ok: false, why: m.why, pid: process.pid }));
} else {
  const r = replayMerged(m.merged, { authorityStore: store(), ...(input.opts || {}) });
  process.stdout.write(JSON.stringify({
    pid: process.pid,
    ok: r.ok,
    why: r.why || null,
    continuity: r.continuity || [],
    unresolvedGovernance: r.unresolvedGovernance || [],
    outcomes: (r.outcomes || []).map((o) => ({
      origin: o.origin, ref: o.ref, occurrence: o.occurrence, state: o.state, minted: o.minted,
      mode: (o.obligation || (o.supply && o.supply[0] && o.supply[0].obligation) || {}).mode || null,
      governedBy: (o.obligation || (o.supply && o.supply[0] && o.supply[0].obligation) || {})
        .governedBy || null,
    })),
  }));
}
