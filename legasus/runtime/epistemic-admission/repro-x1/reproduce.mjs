// INDEPENDENT REPRODUCTION OF X1.  Run: `node repro-x1/reproduce.mjs`
//
// It uses the PRODUCTION entry point (`replayMerged`) only. It imports no test helper, no specimen,
// and no test entry point. Everything it prints is evidence; the conclusions are at the end and are
// separated from the observations.
//
// The two histories are established by CONSTRUCTION and by PRIOR GOVERNOR SELECTION:
//   * construction   - each is produced by its own `node build-history.mjs` process
//   * prior selection - phase 1 records the governor's authorization attaching to A, before B exists
// "A !== B" is NOT what this rests on.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { merge, replayMerged, contentOf, occurrenceOf, MODE, UNATTACHED,
  CONTINUITY_CONTRACT } from '../merge.mjs';
import { store } from '../authority-store.mjs';

const line = (s) => process.stdout.write(s + '\n');
const rule = () => line('='.repeat(78));
const child = new URL('./build-history.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const buildInFreshProcess = () => JSON.parse(execFileSync(process.execPath, [child], { encoding: 'utf8' }));

rule();
line('STEP 1  build two histories, each in its own process');
rule();
const A = buildInFreshProcess();
const B = buildInFreshProcess();
line('  A built by process 1, B built by process 2 (separate OS processes)');
line('  byte-identical                 : ' + (JSON.stringify(A) === JSON.stringify(B)));
line('  same object in memory          : ' + (A === B) + '   <- NOT the basis of this reproduction');
line('  contentOf(A) === contentOf(B)  : ' + (contentOf(A) === contentOf(B)));
line("  occurrence under origin 'S'    : " + (occurrenceOf('S', A) === occurrenceOf('S', B)
  ? 'identical' : 'DIFFERENT'));

const PRED = A.continuity.predecessor;
const GOVERNANCE = { [PRED]: MODE.DESIGNATED };
const AUTHORIZATION = { [PRED]: { successorOrigin: 'S', successorContent: contentOf(A),
  transferGovernance: true } };
const src = (e) => ({ origin: 'S', journal: { entries: [e] } });
const run = (entry, opts) => replayMerged(merge([src(entry)]).merged,
  { authorityStore: store(), governingByOccurrence: GOVERNANCE, continuity: AUTHORIZATION,
    unattachedPolicy: UNATTACHED.DIAGNOSE, ...opts });
const report = (r, label) => {
  const o = r.outcomes[0] || {};
  const ob = o.obligation || (o.supply && o.supply[0] && o.supply[0].obligation) || {};
  line('  ' + label);
  line('    contract          ' + r.continuityContract.contract
    + '  (chosenBy ' + r.continuityContract.chosenBy + ')');
  line('    continuity kind   ' + (r.continuity[0] || {}).kind);
  line('    run ok            ' + r.ok);
  line('    obligation.mode   ' + ob.mode);
  line('    governedBy        ' + ob.governedBy);
  line('    unresolved        ' + JSON.stringify(r.unresolvedGovernance.map((u) => u.by)));
  return { kind: (r.continuity[0] || {}).kind, mode: ob.mode };
};

rule();
line('STEP 2  PRIOR GOVERNOR SELECTION: the authorization is exercised while A is present');
rule();
const phase1 = report(run(A, { continuityContract: CONTINUITY_CONTRACT.CONTENT_MATCH }),
  'A present, CONTENT_MATCH chosen:');
const dir = mkdtempSync(join(tmpdir(), 'legasus-repro-'));
writeFileSync(join(dir, 'phase1-selected.json'), JSON.stringify({ selected: 'A', at: dir }), 'utf8');
line('  recorded: the governor authorization attached while A, and only A, existed.');
line('  record written to ' + join(dir, 'phase1-selected.json'));

rule();
line('STEP 3  THE SUBSTITUTION: A is removed; B is presented in its place');
rule();
line('  the authorization is UNCHANGED from step 2 (same object, not rebuilt)');
const phase2 = report(run(B, { continuityContract: CONTINUITY_CONTRACT.CONTENT_MATCH }),
  'B present, CONTENT_MATCH chosen:');
const phase3 = report(run(B, {}), 'B present, DEFAULT contract (HISTORY_SPECIFIC):');

rule();
line('OBSERVATIONS');
rule();
line('  under CONTENT_MATCH, A and B produce the SAME outcome : '
  + (phase1.kind === phase2.kind && phase1.mode === phase2.mode));
line('  under the DEFAULT, the transfer is refused            : '
  + (phase3.kind === 'INDISTINGUISHABLE_FROM_REPLACEMENT' && phase3.mode == null));

rule();
line('CONCLUSIONS, separated from the observations above');
rule();
line('  1. Two histories built by separate processes are indistinguishable to the runtime. The');
line('     governor selected A in step 2; in step 3 the same authorization attached to B under');
line('     CONTENT_MATCH, and nothing in the run reported a substitution.');
line('  2. That is CORRECT for CONTENT_MATCH, which asserts "whichever record carries exactly this');
line('     content may continue". It is what X1 showed happening under a HISTORY-SPECIFIC contract,');
line('     where it was wrong.');
line('  3. The default contract now refuses, so the wrong reading is no longer reachable by');
line('     accident - at the cost of refusing every history-specific transfer, including legitimate');
line('     ones. That cost is measured in CONTINUITY-CONTRACT_RESULT.md, not solved.');
line('');
line('  TO CHALLENGE THIS: change B so it is not byte-identical (edit any field) and re-run. Step 3');
line('  should then report UNAUTHORIZED rather than CONTINUED under CONTENT_MATCH. If it does not,');
line('  the content check is not doing what this reproduction claims.');
