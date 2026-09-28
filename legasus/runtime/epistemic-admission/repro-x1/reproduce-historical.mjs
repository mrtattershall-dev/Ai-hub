// OBSERVATION A — THE ORIGINAL SAFETY FAILURE, reproduced against the PRESERVED SPECIMEN.
//
// READ THIS FIRST: this script does NOT use the production path. It drives the pre-containment
// continuity resolver, kept byte-unchanged in _specimen-support.mjs, through the testing entry
// point. That resolver WAS production behaviour at the pinned revision:
//
//     fd1389e  P1..P5: positional origin reassignment authorizes the WRONG history
//
// To reproduce against the original code rather than the specimen:
//     git worktree add /tmp/legasus-x1 fd1389e     (then run the P-suite there)
import { execFileSync } from 'node:child_process';
import { merge, contentOf, MODE, UNATTACHED } from '../merge.mjs';
import { store } from '../authority-store.mjs';
import { resolveContinuityUNCONTAINED } from '../_specimen-support.mjs';
import { replayMergedForTests } from '../_test-entry.mjs';

const line = (s) => process.stdout.write(s + '\n');
const child = new URL('./build-history.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const build = () => JSON.parse(execFileSync(process.execPath, [child], { encoding: 'utf8' }));

line('='.repeat(78));
line('OBSERVATION A — the original safety failure (PRESERVED SPECIMEN, not production)');
line('='.repeat(78));
const A = build(), B = build();
const PRED = A.continuity.predecessor;
const r = replayMergedForTests(merge([{ origin: 'S', journal: { entries: [B] } }]).merged,
  { authorityStore: store(),
    governingByOccurrence: { [PRED]: MODE.DESIGNATED },
    continuity: { [PRED]: { successorOrigin: 'S', successorContent: contentOf(A),
      transferGovernance: true } },
    unattachedPolicy: UNATTACHED.DIAGNOSE },
  resolveContinuityUNCONTAINED);
const o = r.outcomes[0] || {};
const ob = o.obligation || (o.supply && o.supply[0] && o.supply[0].obligation) || {};
line('  A authorized; A absent; byte-identical B presented in its place.');
line('  NO contract was chosen: the specimen predates the contract distinction entirely.');
line('');
line('    continuity kind   ' + (r.continuity[0] || {}).kind);
line('    obligation.mode   ' + ob.mode);
line('    governedBy        ' + ob.governedBy);
line('    unresolved        ' + JSON.stringify(r.unresolvedGovernance));
line('');
line('  THE FAILURE: a history-specific authorization transferred to a replacement, reported as');
line('  authorized continuity, with nothing flagged. That is what was wrong. Production no longer');
line('  behaves this way - see repro-x1/reproduce.mjs for observations B and C.');
