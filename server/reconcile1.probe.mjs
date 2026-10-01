/**
 * reconcile1.probe.mjs - D-ID-1 RECONCILE rows R1-R3 (frozen in legasus/screen/D-ID-1_RECONCILE.md
 * at 0d4ec46f before this file existed). Measures; repairs nothing. R4 is the suite run in
 * DID1_IDENTITY=ci mode.
 *
 *   node server/reconcile1.probe.mjs
 */
import { mkdtempSync, writeFileSync, readFileSync, lstatSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';
import { evaluate } from './evaluator.js';
import { cid1 } from './cid1.mjs';
import { candidateIdentity } from './candidateIdentity.mjs';

const REPO = process.cwd();
const run = openRun({ root: join(REPO, 'legasus', 'evidence-runs'), label: 'D-ID-1-RECONCILE', command: 'node server/reconcile1.probe.mjs',
  repo: REPO, evidenceClass: EVIDENCE_CLASS.ORIGINAL, note: 'R1-R3 of D-ID-1_RECONCILE.md (0d4ec46f). Measurement only.' });
const log = []; const say = (s) => { console.log(s); log.push(s); };
const temps = []; const mk = (p) => { const d = mkdtempSync(join(tmpdir(), `rec-${p}-`)); temps.push(d); return d; };
const PFX = '\\\\?\\';
const attempt = (f) => { try { return { ok: true, v: f() }; } catch (e) { return { ok: false, code: e.code || e.message }; } };
const out = {};

try {
  say(`D-ID-1 RECONCILE R1-R3   EH1 ${run.id}   platform ${process.platform}`);

  // R1: lstat through the prefix on an ORDINARY file, three constructions
  { const d = resolve(mk('r1')); writeFileSync(join(d, 'plain.txt'), 'ordinary\n');
    const back = PFX + d + '\\plain.txt';
    const fwd = PFX + d.split('\\').join('/') + '/plain.txt';
    const rel = PFX + relative(process.cwd(), join(d, 'plain.txt'));
    const joined = join(PFX + d, 'plain.txt');   // what join() makes of a prefixed root
    out.R1 = {};
    for (const [name, p] of [['absolute + backslashes', back], ['absolute + forward slashes', fwd], ['relative', rel], ['join(prefix+root, name)', joined]]) {
      const r = attempt(() => lstatSync(p).isFile());
      out.R1[name] = { path: p, ...r };
      say(`  R1  ${name.padEnd(26)} ${r.ok ? 'OK (isFile=' + r.v + ')' : 'FAILS ' + r.code}   ${JSON.stringify(p).slice(0, 90)}`);
    } }

  // R2: create odd. through a correct prefix; prove it from independent listers
  { const d = resolve(mk('r2')); writeFileSync(join(d, 'keep.txt'), 'k\n');
    const w = attempt(() => writeFileSync(PFX + d + '\\odd.', 'TRAILING DOT\n'));
    const node = readdirSync(d);
    const ps = attempt(() => execFileSync('powershell', ['-NoProfile', '-Command', `Get-ChildItem -LiteralPath '${PFX}${d}' | ForEach-Object { $_.Name }`], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/));
    git(d, ['init', '-q']); git(d, ['add', 'keep.txt']); git(d, ['-c', 'user.email=r@r', '-c', 'user.name=r', 'commit', '-q', '-m', 'r2']);
    const v = await evaluate(d, { id: 'r2', requested: { script: 'ls -A /candidate' }, protected: { script: 'true' } });
    const worker = String(v.requested?.out || '').split('\n').map((s) => s.trim()).filter(Boolean);
    out.R2 = { prefixWrite: w, node, powershell: ps.ok ? ps.v : ps.code, worker, workerVerdict: v.requested?.verdict };
    say(`  R2  prefixed write: ${w.ok ? 'OK' : 'FAILS ' + w.code}`);
    say(`  R2  node readdir   [${node.join(', ')}]`);
    say(`  R2  powershell     [${ps.ok ? ps.v.join(', ') : 'FAILS ' + ps.code}]`);
    say(`  R2  worker ls -A   [${worker.filter((n) => n !== '.git').join(', ')}]  (${v.requested?.verdict})`); }

  // R3: MISREAD - odd (A) and odd. (B) side by side
  { const d = resolve(mk('r3')); writeFileSync(join(d, 'odd'), 'BYTES A (odd)\n'); writeFileSync(PFX + d + '\\odd.', 'BYTES B (odd.)\n');
    const ordinary = attempt(() => readFileSync(join(d, 'odd.'), 'utf8').trim());
    const prefixed = attempt(() => readFileSync(PFX + d + '\\odd.', 'utf8').trim());
    const c = cid1(d), ci = candidateIdentity(d);
    out.R3 = { names: readdirSync(d), ordinary, prefixed, cid1: c, candidateIdentity: ci };
    say(`  R3  names [${readdirSync(d).join(', ')}]`);
    say(`  R3  ordinary read of "odd."  -> ${ordinary.ok ? JSON.stringify(ordinary.v) : 'FAILS ' + ordinary.code}`);
    say(`  R3  prefixed read of "odd."  -> ${prefixed.ok ? JSON.stringify(prefixed.v) : 'FAILS ' + prefixed.code}`);
    say(`  R3  cid1.mjs               -> ${c.ok ? 'identity, ' + c.entries + ' entries' : 'REFUSED: ' + c.reason}`);
    say(`  R3  candidateIdentity.mjs  -> ${ci.available ? 'identity, ' + ci.entries + ' entries' : 'REFUSED: ' + ci.reason + ' @ ' + ci.at}`);
    // does either implementation distinguish {odd, odd.} from {odd} alone?
    const d2 = resolve(mk('r3b')); writeFileSync(join(d2, 'odd'), 'BYTES A (odd)\n');
    const c2 = cid1(d2), ci2 = candidateIdentity(d2);
    out.R3.distinguish = { cid1: c.ok && c2.ok ? c.id !== c2.id : null, candidateIdentity: ci.available && ci2.available ? ci.identity !== ci2.identity : null };
    say(`  R3  {odd,odd.} vs {odd}: cid1.mjs ${out.R3.distinguish.cid1 === null ? 'n/a (refused)' : out.R3.distinguish.cid1 ? 'DIFFERENT' : 'SAME (collapse!)'}; candidateIdentity.mjs ${out.R3.distinguish.candidateIdentity === null ? 'n/a (refused)' : out.R3.distinguish.candidateIdentity ? 'DIFFERENT' : 'SAME (collapse!)'}`); }

  run.artifact('reconcile1.log', log.join('\n') + '\n');
  run.artifact('result.json', out);
  const s = run.seal({ exitStatus: 0 });
  console.log(`\nEH1 sealed: ${s.state}  run dir: ${run.dir}`);
} catch (e) {
  say(`APPARATUS FAILURE: ${e.stack || e}`);
  try { run.artifact('reconcile1.log', log.join('\n') + '\n'); run.abandon({ reason: String(e.message).slice(0, 300) }); } catch {}
  process.exitCode = 1;
} finally {
  for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
}

function git(at, a) { try { return execFileSync('git', ['-C', at, ...a], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } }
