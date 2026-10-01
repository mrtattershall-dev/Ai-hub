/**
 * reconcile1r5.probe.mjs - D-ID-1 RECONCILE, R5. POST HOC: NOT in the frozen plan (0d4ec46f).
 *
 * R4 showed candidateIdentity.mjs returning an identity for {lone-surrogate name, its U+FFFD
 * lookalike}. If that identity is built from the lookalike read twice, then changing ONLY the
 * lone-surrogate file's bytes cannot change it: two distinguishable states, one identity. This
 * probe tests that consequence directly, for both implementations. Reported as post hoc.
 *
 *   node server/reconcile1r5.probe.mjs
 */
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';
import { cid1 } from './cid1.mjs';
import { candidateIdentity } from './candidateIdentity.mjs';

const REPO = process.cwd();
const run = openRun({ root: join(REPO, 'legasus', 'evidence-runs'), label: 'D-ID-1-RECONCILE-R5-POSTHOC', command: 'node server/reconcile1r5.probe.mjs',
  repo: REPO, evidenceClass: EVIDENCE_CLASS.ORIGINAL, note: 'POST HOC, not frozen: does the R4 lookalike case collapse distinguishable states?' });
const log = []; const say = (s) => { console.log(s); log.push(s); };
const temps = [];

/** .NET writes the names (Node cannot create a lone surrogate); PowerShell reports the code points. */
function build(loneBytes) {
  const d = resolve(mkdtempSync(join(tmpdir(), 'r5-'))); temps.push(d);
  const ps = `[IO.File]::WriteAllText('${d}\\' + 'bad' + [char]0xD800 + 'name', '${loneBytes}'); `
    + `[IO.File]::WriteAllText('${d}\\' + 'bad' + [char]0xFFFD + [char]0xFFFD + [char]0xFFFD + 'name', 'LOOKALIKE'); `
    + `Get-ChildItem -LiteralPath '${d}' | ForEach-Object { (($_.Name.ToCharArray() | ForEach-Object { '{0:X4}' -f [int]$_ }) -join ' ') + ' = ' + [IO.File]::ReadAllText($_.FullName) }`;
  const listing = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/);
  return { d, listing };
}

try {
  say(`R5 (POST HOC)  EH1 ${run.id}`);
  const X = build('LONE VERSION ONE'), Y = build('LONE VERSION TWO');
  say(`  X on disk: ${X.listing.join(' | ')}`);
  say(`  Y on disk: ${Y.listing.join(' | ')}`);
  const distinguishable = X.listing.join() !== Y.listing.join();
  say(`  X and Y distinguishable on disk (per .NET): ${distinguishable}`);
  const ci = [candidateIdentity(X.d), candidateIdentity(Y.d)], c = [cid1(X.d), cid1(Y.d)];
  const ciCollapse = ci[0].available && ci[1].available && ci[0].identity === ci[1].identity;
  say(`  candidateIdentity.mjs: X ${ci[0].available ? ci[0].identity.slice(0, 21) : 'refused'}  Y ${ci[1].available ? ci[1].identity.slice(0, 21) : 'refused'}  -> ${ciCollapse ? 'COLLAPSE: distinguishable states share one identity' : 'no collapse'}`);
  say(`  cid1.mjs:              X ${c[0].ok ? c[0].id.slice(0, 21) : 'refused (' + c[0].reason + ')'}  Y ${c[1].ok ? c[1].id.slice(0, 21) : 'refused (' + c[1].reason + ')'}`);
  run.artifact('r5.log', log.join('\n') + '\n');
  run.artifact('result.json', { X: X.listing, Y: Y.listing, distinguishable, candidateIdentity: ci, cid1: c, ciCollapse });
  const s = run.seal({ exitStatus: 0 }); console.log(`EH1 sealed: ${s.state}`);
} catch (e) {
  say(`APPARATUS FAILURE: ${e.stack || e}`); try { run.artifact('r5.log', log.join('\n') + '\n'); run.abandon({ reason: String(e.message).slice(0, 300) }); } catch {}
  process.exitCode = 1;
} finally { for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch {} } }
