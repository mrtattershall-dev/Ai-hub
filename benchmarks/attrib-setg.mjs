// Step 4 route attribution over replay results.
//
//     node benchmarks/attrib-setg.mjs <results.jsonl>
//
// Classifies each scenario by what the replay can ESTABLISH, and says plainly which of the owner's
// five classes this instrument cannot reach. A replay reports hub BEHAVIOUR given fixed model
// output; it runs no end-state symbol checks, so DETECTOR_BLIND is not decidable here.
import { readFileSync } from 'node:fs';

const CLASS = {
  ROUTE_BYPASS: 'ROUTE_BYPASS',                 // loss DETECTED, refusal did NOT fire
  REFUSED: 'REFUSED',                           // the mechanism participated and stopped it
  NO_LOSS_SIGNAL: 'NO_LOSS_SIGNAL',             // nothing detected and nothing refused
  UNMEASURED_DETECTOR_BLIND: 'UNMEASURED_DETECTOR_BLIND',
  UNMEASURED_OVERRIDE: 'UNMEASURED_OVERRIDE',
  UNMEASURED_TIMING: 'UNMEASURED_TIMING',
};

const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n')
  .filter(Boolean).map((l) => JSON.parse(l));

const named = (r) => [...(r.defLossNamed || []), ...(r.exportLossNamed || [])];
const warned = (r) => (r.defLossWarnings || 0) + (r.exportLossWarnings || 0);

const classify = (r) => {
  const lost = named(r), w = warned(r), refused = r.destructiveRefused || 0;
  if ((lost.length || w) && refused === 0) return CLASS.ROUTE_BYPASS;
  if (refused > 0) return CLASS.REFUSED;
  return CLASS.NO_LOSS_SIGNAL;
};

const by = {};
for (const r of rows) { const c = classify(r); (by[c] = by[c] || []).push(r); }

const say = (...a) => console.log(...a);
say('======================================================================');
say('STEP 4 ROUTE ATTRIBUTION — set G replies through CURRENT code');
say('  scenarios replayed: ' + rows.length);
say('  errored: ' + rows.filter((r) => r.error).length
  + '   diverged from recording (sameAsOriginal false): ' + rows.filter((r) => r.sameAsOriginal === false).length
  + '   exhausted > 0: ' + rows.filter((r) => (r.exhausted || 0) > 0).length);
say('');
say('  WHAT THE REPLAY ESTABLISHES');
for (const k of [CLASS.ROUTE_BYPASS, CLASS.REFUSED, CLASS.NO_LOSS_SIGNAL]) {
  say('      ' + k.padEnd(16) + String((by[k] || []).length).padStart(4));
}
say('');

const bypass = by[CLASS.ROUTE_BYPASS] || [];
say('  ROUTE_BYPASS — DETECTED AND NOT REFUSED (' + bypass.length + '):');
for (const r of bypass) {
  say('      ' + r.id.replace('setG-coder30b-setg-', '') + '  warnings ' + warned(r)
    + '  refused ' + (r.destructiveRefused || 0)
    + '  named: ' + JSON.stringify(named(r)).slice(0, 84));
}
if (!bypass.length) say('      none');
say('');

const refused = by[CLASS.REFUSED] || [];
say('  REFUSED — the mechanism participated (' + refused.length + '), sample:');
for (const r of refused.slice(0, 8)) {
  say('      ' + r.id.replace('setG-coder30b-setg-', '') + '  refused ' + r.destructiveRefused
    + '  ' + JSON.stringify(r.refusedNamed || []).slice(0, 78));
}
say('');
say('  ROLLBACK (end-of-run repair) fired in: '
  + rows.filter((r) => (r.rollbackNotes || []).length).length + ' scenarios');
say('  shell route decisions seen: '
  + JSON.stringify([...new Set(rows.flatMap((r) => r.approvals || []))]).slice(0, 110));
say('');
say('  NOT DECIDABLE BY THIS INSTRUMENT, and not guessed:');
say('      DETECTOR_BLIND   needs END-STATE symbol checks; a replay runs none. A scenario in');
say('                       NO_LOSS_SIGNAL may have destroyed behaviour silently, or nothing.');
say('      OVERRIDE         needs the tool args (REMOVE: <names>); carried in run records, not');
say('                       in this summary.');
say('      TIMING           needs observation BETWEEN write and restore; not instrumented.');
say('  A count of destroyed work is NOT produced here. This is route attribution only.');
say('======================================================================');
