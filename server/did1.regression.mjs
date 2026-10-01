/**
 * did1.regression.mjs - D-ID-1 metamorphic regression suite, run against the UNREPAIRED identity.
 *
 *   node server/did1.regression.mjs
 *
 * Frozen in legasus/screen/D-ID-1_PREREG.md (1c3a2b1c) + Amendment 1 (3e14f827) before this file
 * existed. cid1 is NOT implemented and nothing is repaired. The identity under test is the shipped
 * one, measured through the shipped path: evaluate(dir, trivial).candidateTree (null = UNAVAILABLE).
 *
 * The milestone is not green. It is a sealed record of WHERE the old identity violates the contract,
 * each result reported against the boundary responsible for it - never as a total.
 *
 * The oracle below is TEST APPARATUS, deliberately not cid1: a direct entry-by-entry comparison of
 * two directories, no digest, no canonical form. It only establishes each row's PRECONDITION.
 */
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync, readdirSync, lstatSync,
  readlinkSync, renameSync, unlinkSync, symlinkSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, sep, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';
import { evaluate } from './evaluator.js';
import { runBatch } from './batch.js';
import { WORKER_IMAGE } from './worker.js';
import { cid1 } from './cid1.mjs';
import { candidateIdentity } from './candidateIdentity.mjs';

const REPO = process.cwd();
// DID1_IDENTITY=head (default, the original run 53222095) or cid1 (Amendment 2, a69aaddd).
// In cid1 mode ONLY the identity rows change what they measure. M17/M18/M19 still run through the
// shipped, unrepaired paths - they belong to D-COPY / D-CONS / D-BIND and must stay red.
// DID1_IDENTITY=ci (D-ID-1_RECONCILE R4, 0d4ec46f): the same rows on candidateIdentity.mjs.
const MODE = process.env.DID1_IDENTITY || 'head';
if (!['head', 'cid1', 'ci'].includes(MODE)) throw new Error(`DID1_IDENTITY must be head, cid1 or ci, not ${MODE}`);
const run = openRun({
  root: process.env.DID1_RUNS || join(REPO, 'legasus', 'evidence-runs'), label: { cid1: 'D-ID-1-CID1', ci: 'D-ID-1-CI', head: 'D-ID-1-REGRESSION' }[MODE],
  command: `DID1_IDENTITY=${MODE} node server/did1.regression.mjs`, repo: REPO, evidenceClass: EVIDENCE_CLASS.ORIGINAL,
  note: MODE !== 'head'
    ? `D-ID-1 suite, identity rows measured on ${MODE === 'ci' ? 'candidateIdentity.mjs' : 'cid1.mjs'} directly; M17-M19 on the unrepaired shipped paths. Prereg 1c3a2b1c + A1 3e14f827 + A2 a69aaddd; reconcile 0d4ec46f.`
    : 'D-ID-1 metamorphic suite vs the UNREPAIRED HEAD^{tree} identity. Prereg 1c3a2b1c + A1 3e14f827. cid1 not written.',
});
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const git = (at, a) => { try { return execFileSync('git', ['-C', at, ...a], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return `ERR:${String(e.message).split('\n')[0].slice(0, 80)}`; } };
const temps = [];
const mk = (p) => { const d = mkdtempSync(join(tmpdir(), `did1-${p}-`)); temps.push(d); return d; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── the oracle (apparatus, NOT cid1) ───────────────────────────────────────────────────────────
function snapshot(root) {
  const m = new Map();
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      if (n === '.git') continue;                         // EXACT component, never a substring
      const p = join(d, n), rel = relative(root, p).split(sep).join('/');
      let st;
      try { st = lstatSync(p); } catch (e) { m.set(rel, `UNREADABLE:${e.code}`); continue; }
      if (st.isSymbolicLink()) m.set(rel, `L:${readlinkSync(p)}`);
      else if (st.isDirectory()) walk(p);
      else { try { m.set(rel, `F:${readFileSync(p).toString('base64')}`); } catch (e) { m.set(rel, `UNREADABLE:${e.code}`); } }
    }
  };
  walk(root);
  return m;
}
function sameSnapshot(a, b) {
  const diffs = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    if (a.get(k) !== b.get(k)) diffs.push(!a.has(k) ? `+${k}` : !b.has(k) ? `-${k}` : `~${k}`);
  }
  return { same: diffs.length === 0, diffs };
}

// ── shapes ─────────────────────────────────────────────────────────────────────────────────────
const BASE = { 'subject.js': 'module.exports={probe:()=>"CANDIDATE"};\n', 'keep.txt': 'KEEP\n', 'lib/util.js': 'module.exports=1;\n' };
function write(dir, files) { for (const [f, b] of Object.entries(files)) { mkdirSync(join(dir, f, '..'), { recursive: true }); writeFileSync(join(dir, f), b); } }
function commitAll(dir, msg = 'c') { git(dir, ['add', '-A']); return git(dir, ['-c', 'user.email=c@c', '-c', 'user.name=c', 'commit', '-q', '--allow-empty', '-m', msg]); }
function ownRepo(dir, files = BASE) { mkdirSync(dir, { recursive: true }); write(dir, files); git(dir, ['init', '-q']); git(dir, ['config', 'core.autocrlf', 'false']); commitAll(dir, 'candidate'); return dir; }
function bare(dir, files = BASE) { mkdirSync(dir, { recursive: true }); write(dir, files); return dir; }
function parent(tag, content) {
  const p = mk(tag);
  if (content === null) return p;
  git(p, ['init', '-q']); git(p, ['config', 'core.autocrlf', 'false']);
  if (content === '') return p;
  writeFileSync(join(p, 'PARENT_FILE.txt'), content); commitAll(p, 'parent');
  return p;
}
const TRIVIAL = { id: 'did1', requested: { script: 'true' }, protected: { script: 'true' } };
/** The implementation under test, normalized to { ok, id, reason, entries }. RECONCILE R4 adds `ci`. */
function ID(dir) {
  if (MODE === 'ci') { const r = candidateIdentity(dir); return { ok: r.available, id: r.available ? r.identity : null, reason: r.reason ?? null, entries: r.entries ?? null }; }
  return cid1(dir);
}
async function identity(dir) {
  if (MODE !== 'head') { const r = ID(dir); return r.ok ? r.id : null; }
  const v = await evaluate(dir, TRIVIAL); return v.candidateTree || null;
}
const enclosingTree = (dir) => { const t = git(join(dir, '..'), ['rev-parse', 'HEAD^{tree}']); return t.startsWith('ERR:') ? null : t; };

// ── rows ───────────────────────────────────────────────────────────────────────────────────────
const TAGS = {
  INVARIANCE: 'identity construction', FIDELITY: 'identity construction', AVAILABILITY: 'identity construction',
  REPRESENTABILITY: 'identity construction', PRESERVATION: 'WORKSPACE construction',
  CONSISTENCY: 'evaluation consistency', BINDING: 'receipt binding',
};
const rows = [];
function record(row, tag, shape, r) {
  const out = { row, tag, boundary: TAGS[tag], shape, ...r };
  rows.push(out);
  say(`  ${row.padEnd(4)} ${shape.padEnd(18)} ${String(out.outcome).padEnd(28)} ${tag.padEnd(16)} ${out.note || ''}`);
  return out;
}
/** Invariance: snapshots must be SAME (oracle-proven); identity must be equal and available. */
async function invariance(row, shape, dirA, dirB, { tag = 'INVARIANCE' } = {}) {
  const pre = sameSnapshot(snapshot(dirA), snapshot(dirB));
  if (!pre.same) return record(row, tag, shape, { outcome: 'APPARATUS_FAULT', note: `precondition: snapshots differ ${pre.diffs.join(',')}` });
  const a = await identity(dirA), b = await identity(dirB);
  const namesParent = [[dirA, a], [dirB, b]].some(([d, t]) => t && !existsSync(join(d, '.git')) && t === enclosingTree(d));
  let outcome;
  if (!a || !b) outcome = 'VIOLATED (AVAILABILITY)';
  else if (a !== b) outcome = `VIOLATED (${tag})`;
  else outcome = namesParent ? 'HOLDS_VACUOUSLY' : 'HOLDS';
  return record(row, tag, shape, { outcome, idA: a, idB: b, namesParent, note: namesParent ? 'identity is the enclosing repo\'s tree' : (!a || !b ? `${a ? '' : 'A'}${b ? '' : 'B'} unavailable` : '') });
}
/** Fidelity: mutate; snapshot must change (oracle-proven); identity must change. */
async function fidelity(row, shape, dir, mutate, { commitAfter = false } = {}) {
  const before = snapshot(dir); const a = await identity(dir);
  mutate(dir); if (commitAfter) commitAll(dir, 'mutation');
  const pre = sameSnapshot(before, snapshot(dir));
  if (pre.same) return record(row, 'FIDELITY', shape, { outcome: 'APPARATUS_FAULT', note: 'precondition: mutation did not change the snapshot' });
  const b = await identity(dir);
  const outcome = !a || !b ? 'VIOLATED (AVAILABILITY)' : a === b ? 'VIOLATED (FIDELITY)' : 'HOLDS';
  return record(row, 'FIDELITY', shape, { outcome, idA: a, idB: b, snapshotDiff: pre.diffs, note: `snapshot ${pre.diffs.join(',')}` });
}

// ── run ────────────────────────────────────────────────────────────────────────────────────────
const result = { prereg: ['1c3a2b1c', '3e14f827'], image: WORKER_IMAGE, controls: {}, rows };
try {
  say(MODE !== 'head'
    ? 'D-ID-1 suite: identity rows on cid1 (direct); M17-M19 on the UNREPAIRED shipped paths'
    : 'D-ID-1 regression suite vs the UNREPAIRED identity (evaluate().candidateTree)');
  say(`EH1 run: ${run.id}`);

  // CONTROLS: the oracle, and readiness
  const o1 = ownRepo(join(mk('oc'), 'c')); const o2 = join(mk('oc2'), 'c'); cpSync(o1, o2, { recursive: true });
  const oSame = sameSnapshot(snapshot(o1), snapshot(o2)).same;
  writeFileSync(join(o2, 'keep.txt'), 'KEEQ\n');
  const oDiff = !sameSnapshot(snapshot(o1), snapshot(o2)).same;
  const readyId = await identity(o1);
  result.controls = { oracleCopySame: oSame, oracleOneByteDifferent: oDiff, readiness: !!readyId };
  say(`CONTROLS  oracle copy=SAME ${oSame}  oracle 1-byte=DIFFERENT ${oDiff}  readiness(identity on own repo) ${!!readyId}`);
  if (!oSame || !oDiff || !readyId) throw new Error('a control failed - the suite cannot run');
  say('');

  const P1 = parent('p1', 'PARENT ONE\n'), P2 = parent('p2', 'PARENT TWO IS DIFFERENT\n');

  // M1 different parent repo
  await invariance('M1', 'BARE in P1 vs P2', bare(join(P1, 'm1')), bare(join(P2, 'm1')));
  await invariance('M1', 'OWN in P1 vs P2', ownRepo(join(P1, 'm1own')), ownRepo(join(P2, 'm1own')));
  // M2 different absolute path
  { const a = ownRepo(join(mk('m2a'), 'c')); const b = join(mk('m2b'), 'deep', 'er', 'c'); cpSync(a, b, { recursive: true });
    await invariance('M2', 'OWN moved', a, b); }
  await invariance('M2', 'BARE moved in P1', bare(join(P1, 'x', 'm2')), bare(join(P1, 'y', 'z', 'm2')));
  // M3 no enclosing repo, M4 commitless enclosing repo (AVAILABILITY)
  await invariance('M3', 'OWN vs BARE no-repo', ownRepo(join(mk('m3o'), 'c')), bare(join(parent('p0', null), 'c')));
  await invariance('M4', 'OWN vs BARE commitless', ownRepo(join(mk('m4o'), 'c')), bare(join(parent('pc', ''), 'c')));
  // M5 unrelated parent HEAD moves
  for (const shape of ['BARE', 'OWN']) {
    const P = parent(`m5${shape}`, 'PARENT\n'); const c = shape === 'BARE' ? bare(join(P, 'c')) : ownRepo(join(P, 'c'));
    const snap = snapshot(c); const a = await identity(c);
    writeFileSync(join(P, 'PARENT_FILE.txt'), 'PARENT MOVED\n'); git(P, ['add', 'PARENT_FILE.txt']); git(P, ['-c', 'user.email=p@p', '-c', 'user.name=p', 'commit', '-q', '-m', 'move']);
    const same = sameSnapshot(snap, snapshot(c)).same; const b = await identity(c);
    record('M5', 'INVARIANCE', `${shape} parent HEAD moved`, !same ? { outcome: 'APPARATUS_FAULT', note: 'snapshot changed' }
      : { outcome: !a || !b ? 'VIOLATED (AVAILABILITY)' : a !== b ? 'VIOLATED (INVARIANCE)' : 'HOLDS', idA: a, idB: b });
  }
  // M6 unrelated sibling modified
  for (const shape of ['BARE', 'OWN']) {
    const P = parent(`m6${shape}`, 'PARENT\n'); const c = shape === 'BARE' ? bare(join(P, 'c')) : ownRepo(join(P, 'c'));
    mkdirSync(join(P, 'sibling'), { recursive: true });
    const snap = snapshot(c); const a = await identity(c);
    writeFileSync(join(P, 'sibling', 'noise.txt'), 'unrelated change\n');
    const same = sameSnapshot(snap, snapshot(c)).same; const b = await identity(c);
    const namesParent = shape === 'BARE' && a === enclosingTree(c);
    record('M6', 'INVARIANCE', `${shape} sibling modified`, !same ? { outcome: 'APPARATUS_FAULT', note: 'snapshot changed' }
      : { outcome: !a || !b ? 'VIOLATED (AVAILABILITY)' : a !== b ? 'VIOLATED (INVARIANCE)' : namesParent ? 'HOLDS_VACUOUSLY' : 'HOLDS', idA: a, idB: b, namesParent });
  }
  // M7-M11 fidelity: OWN uncommitted (the D-PROP-1 shape), OWN committed (contrast), BARE in P1
  const MUT = {
    M7: (d) => writeFileSync(join(d, 'subject.js'), 'module.exports={probe:()=>"CHANGED"};\n'),
    M8: (d) => { writeFileSync(join(d, 'added.js'), 'module.exports=2;\n'); unlinkSync(join(d, 'keep.txt')); },
    M9: (d) => renameSync(join(d, 'lib', 'util.js'), join(d, 'lib', 'util2.js')),
    M10: (d) => writeFileSync(join(d, 'keep.txt'), 'KEEP\r\n'),
    M11: (d) => { writeFileSync(join(d, '.gitignore'), '*.log\n'); writeFileSync(join(d, '.gitattributes'), '* -text\n');
      mkdirSync(join(d, '.github', 'workflows'), { recursive: true }); writeFileSync(join(d, '.github', 'workflows', 'ci.yml'), 'on: push\n'); },
  };
  for (const [row, m] of Object.entries(MUT)) {
    await fidelity(row, 'OWN uncommitted', ownRepo(join(mk(`${row}u`), 'c')), m);
    await fidelity(row, 'OWN committed', ownRepo(join(mk(`${row}c`), 'c')), m, { commitAfter: true });
    await fidelity(row, 'BARE in P1', bare(join(P1, `${row}b`)), m);
  }
  // M11 extra: a file the candidate's OWN .gitignore hides, even after committing everything
  { const d = ownRepo(join(mk('M11i'), 'c'), { ...BASE, '.gitignore': '*.log\n' });
    await fidelity('M11', 'OWN ignored, committed', d, (x) => writeFileSync(join(x, 'debug.log'), 'a check can read this\n'), { commitAfter: true }); }
  // M12 contents of the candidate's own .git change, HEAD unmoved
  { const d = ownRepo(join(mk('M12'), 'c')); const snap = snapshot(d); const a = await identity(d);
    writeFileSync(join(d, '.git', 'description'), 'changed\n'); git(d, ['update-ref', 'refs/probe/x', 'HEAD']);
    const same = sameSnapshot(snap, snapshot(d)).same; const b = await identity(d);
    record('M12', 'INVARIANCE', 'OWN .git internals', !same ? { outcome: 'APPARATUS_FAULT' } : { outcome: a && a === b ? 'HOLDS' : 'VIOLATED (INVARIANCE)', idA: a, idB: b }); }
  // M13 symlink retarget (link text, never followed)
  { const d = ownRepo(join(mk('M13'), 'c'), { ...BASE, 'a.txt': 'A\n', 'b.txt': 'B\n' });
    let made = true; try { symlinkSync('a.txt', join(d, 'link')); commitAll(d, 'link'); } catch (e) { made = false; record('M13', 'FIDELITY', 'OWN symlink', { outcome: 'NOT_RUNNABLE', note: `UNMEASURED ON WINDOWS - requires a symlink-capable environment (${e.code})` }); }
    if (made) await fidelity('M13', 'OWN symlink uncommitted', d, (x) => { unlinkSync(join(x, 'link')); symlinkSync('b.txt', join(x, 'link')); }); }
  // M14 declared blind spots
  // empty dirs are declared OUT of the snapshot, so this is an INVARIANCE row (the oracle agrees: no entry)
  { const d = ownRepo(join(mk('M14e'), 'c')); const a = await identity(d); mkdirSync(join(d, 'emptydir')); const b = await identity(d);
    record('M14', 'INVARIANCE', 'OWN empty dir (declared out)', { outcome: a && a === b ? 'HOLDS' : 'VIOLATED (INVARIANCE)', idA: a, idB: b }); }
  record('M14', 'INVARIANCE', 'exec bit', { outcome: 'NOT_RUNNABLE', note: 'Windows has no exec bit to flip; declared blind spot' });
  // M15 (cid1 mode, Amendment 2): refuse only what cannot be FAITHFULLY named
  const exactPath = (d, name) => '\\\\?\\' + resolve(d) + '\\' + name;
  if (MODE !== 'head') {
    // M15a: odd. is named, and the WORKER's own view of /candidate lists exactly the host's entries
    { const d = ownRepo(join(mk('M15a'), 'c'));
      let made = true; try { writeFileSync(exactPath(d, 'odd.'), 'trailing dot\n'); } catch (e) { made = false; record('M15a', 'REPRESENTABILITY', 'OWN odd.', { outcome: 'NOT_RUNNABLE', note: e.code }); }
      if (made) {
        const r = ID(d);
        const host = [...snapshot(d).keys()].sort();
        const v = await evaluate(d, { id: 'm15a', requested: { script: "cd /candidate && find . -name .git -prune -o \\( -type f -o -type l \\) -print | sed 's|^\\./||' | sort" }, protected: { script: 'true' } });
        const worker = String(v.requested?.out || '').split('\n').map((s) => s.trim()).filter(Boolean).sort();
        const agree = JSON.stringify(host) === JSON.stringify(worker);
        record('M15a', 'REPRESENTABILITY', 'OWN odd. + worker view', {
          outcome: v.requested?.verdict !== 'PASS' ? `APPARATUS_FAULT (listing ${v.requested?.verdict})` : !r.ok ? `VIOLATED (AVAILABILITY) ${r.reason}` : agree ? 'HOLDS' : 'VIOLATED (REPRESENTABILITY)',
          idA: r.ok ? r.id : null, host, worker,
          note: `cid1 ${r.ok ? 'named ' + r.entries + ' entries' : 'refused: ' + r.reason}; host [${host.join(',')}] worker [${worker.join(',')}]` });
      } }
    // M15b: COLLAPSE - {odd, odd.} with different bytes must not share an identity with {odd}
    { const a = bare(join(mk('M15b1'), 'c'), { odd: 'ODD\n' }); const b = bare(join(mk('M15b2'), 'c'), { odd: 'ODD\n' });
      let made = true; try { writeFileSync(exactPath(b, 'odd.'), 'DIFFERENT BYTES\n'); } catch (e) { made = false; record('M15b', 'REPRESENTABILITY', 'collapse', { outcome: 'NOT_RUNNABLE', note: e.code }); }
      if (made) { const pre = sameSnapshot(snapshot(a), snapshot(b)); const ia = ID(a), ib = ID(b);
        record('M15b', 'REPRESENTABILITY', '{odd} vs {odd, odd.}', { outcome: pre.same ? 'APPARATUS_FAULT' : !ia.ok || !ib.ok ? `VIOLATED (AVAILABILITY) ${ia.reason || ib.reason}` : ia.id !== ib.id ? 'HOLDS' : 'VIOLATED (REPRESENTABILITY)', idA: ia.id, idB: ib.id, note: `snapshot ${pre.diffs.join(',')}` }); } }
    // M15c: a name that is not well-formed Unicode -> UNAVAILABLE.
    // APPARATUS NOTE (run ac3dfe9e): Node cannot CREATE such a name - it writes U+FFFD instead, so
    // that run's M15c tested a well-formed name and its "VIOLATED" was a failed precondition. The
    // names are now made by .NET, and the lone surrogate is PROVEN on disk from PowerShell's own
    // code points before cid1 is asked. c2 adds the well-formed lookalike Node would decode it to.
    const lone = (dir, files) => {
      const ps = files.map(([n, body]) => `[IO.File]::WriteAllText('${dir}\\' + ${n}, '${body}')`).join('; ')
        + `; Get-ChildItem -LiteralPath '${dir}' | ForEach-Object { ($_.Name.ToCharArray() | ForEach-Object { '{0:X4}' -f [int]$_ }) -join ' ' }`;
      try { return execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/); } catch (e) { return null; }
    };
    for (const [shape, files] of [
      ['lone surrogate alone', [["'bad' + [char]0xD800 + 'name'", 'lone']]],
      ['lone + its U+FFFD lookalike', [["'bad' + [char]0xD800 + 'name'", 'lone'], ["'bad' + [char]0xFFFD + [char]0xFFFD + [char]0xFFFD + 'name'", 'lookalike']]],
    ]) {
      const d = resolve(bare(join(mk('M15c'), 'c'), { 'ok.txt': 'x\n' }));
      const cps = lone(d, files);
      const proven = !!cps && cps.some((l) => / D8[0-9A-F]{2} /.test(` ${l} `));
      if (!proven) { record('M15c', 'REPRESENTABILITY', shape, { outcome: 'NOT_RUNNABLE', note: `no lone surrogate on disk (${JSON.stringify(cps)})` }); continue; }
      const r = ID(d); const seen = readdirSync(d).filter((n) => n !== 'ok.txt');
      record('M15c', 'REPRESENTABILITY', shape, { outcome: r.ok ? 'VIOLATED (REPRESENTABILITY)' : 'HOLDS', idA: r.ok ? r.id : null, onDisk: cps,
        note: `on disk [${cps.join(' | ')}]; Node readdir ${JSON.stringify(seen)}; cid1 ${r.ok ? 'RETURNED an identity' : 'refused: ' + r.reason}` });
    }
  } else
  // M15 (head mode, the original run): unrepresentable name -> must be UNAVAILABLE
  { const d = ownRepo(join(mk('M15'), 'c'));
    const odd = '\\\\?\\' + resolve(d) + '\\odd.';
    let made = true; try { writeFileSync(odd, 'trailing dot\n'); } catch (e) { made = false; record('M15', 'REPRESENTABILITY', 'OWN odd name', { outcome: 'NOT_RUNNABLE', note: e.code }); }
    if (made) { const names = readdirSync(d); const id = await identity(d);
      record('M15', 'REPRESENTABILITY', 'OWN name ending "."', { outcome: id ? 'VIOLATED (REPRESENTABILITY)' : 'HOLDS', idA: id, note: `entry present: ${names.includes('odd.')}; an identity was ${id ? 'RETURNED' : 'refused'}` }); } }
  // M16 own repo vs the same bytes without one
  await invariance('M16', 'OWN vs BARE in P1', ownRepo(join(mk('m16'), 'c')), bare(join(P1, 'm16')));

  // M17 PRESERVATION: the real batch.js copy, compared as SNAPSHOTS
  { const root = mk('M17'); const startOfT2 = {};
    const files = { 'subject.js': BASE['subject.js'], '.gitignore': '*.log\n', '.gitattributes': '* -text\n', '.github/workflows/ci.yml': 'on: push\n', 'debug.log': 'ignored by git, visible to a check\n' };
    const tasks = [
      { id: 't1', seed: { 'keep.txt': 'KEEP\n' }, requested: { script: 'test -f /candidate/.gitignore && test -f /candidate/.github/workflows/ci.yml' }, protected: { script: 'grep -q KEEP /candidate/keep.txt' } },
      { id: 't2', dependsOn: 't1', requested: { script: 'true' }, protected: { script: 'true' } },
    ];
    const runTask = async (ws, task) => { if (task.id === 't1') write(ws, files); if (task.id === 't2') startOfT2.snap = snapshot(ws); return { status: 'DONE', exit: 0 }; };
    const r = await runBatch(tasks, { workspacesDir: join(root, 'ws'), auditDir: join(root, 'audit'), journalPath: join(root, 'j.jsonl'), perTaskSec: 120, totalSec: 600, runTask, evalImage: WORKER_IMAGE, chain: true });
    const t1 = r.results.find((x) => x.task === 't1');
    const cand = snapshot(join(root, 'ws', 't1')), base = snapshot(join(root, 'ws', '.accepted-baseline'));
    const cb = sameSnapshot(cand, base), cn = startOfT2.snap ? sameSnapshot(cand, startOfT2.snap) : { same: false, diffs: ['t2 never started'] };
    // cid1 mode: does the identity REPORT the difference? (it should - the copy is wrong, not the identity)
    const idNote = MODE !== 'head' ? (() => { const x = ID(join(root, 'ws', 't1')), y = ID(join(root, 'ws', '.accepted-baseline'));
      return ` | cid1 candidate ${String(x.id).slice(5, 17)} vs baseline ${String(y.id).slice(5, 17)}: ${
        // Judged AGAINST THE ORACLE (cb, below). Run 14779b72 printed "SAME (identity would hide the
        // copy defect!)" after D-COPY, when the snapshots really were equal - a label that assumed the
        // defect. Now it warns only when the oracle and the identity disagree.
        x.id === y.id ? (cb.same ? 'SAME (snapshots equal per the oracle)' : 'SAME BUT THE ORACLE SEES A DIFFERENCE - identity hides it!')
          : (cb.same ? 'DIFFERENT BUT THE ORACLE SEES NONE - identity disagrees with the oracle!' : 'DIFFERENT (identity reports the copy defect)')}`; })() : '';
    record('M17', 'PRESERVATION', 'candidate vs baseline', { outcome: t1?.acceptance?.disposition !== 'RETAIN' ? `APPARATUS_FAULT (t1 ${t1?.acceptance?.disposition})` : cb.same ? 'HOLDS' : 'VIOLATED (PRESERVATION)', snapshotDiff: cb.diffs, note: `t1=${t1?.acceptance?.disposition} missing/changed: ${cb.diffs.join(',') || '-'}${idNote}` });
    record('M17', 'PRESERVATION', 'candidate vs t2 start', { outcome: cn.same ? 'HOLDS' : 'VIOLATED (PRESERVATION)', snapshotDiff: cn.diffs, note: `${cn.diffs.join(',') || '-'}` }); }

  // M18 CONSISTENCY: the candidate changes while the check runs
  { const d = ownRepo(join(mk('M18'), 'c')); const before = snapshot(d);
    const cidBefore = MODE !== 'head' ? ID(d).id : null;
    const t0 = Date.now();
    const p = evaluate(d, { id: 'm18', requested: { script: 'sleep 8; cat /candidate/subject.js' }, protected: { script: 'true' } });
    await sleep(4000); const tm = Date.now() - t0;
    writeFileSync(join(d, 'subject.js'), 'module.exports={probe:()=>"MUTATED MID-CHECK"};\n');
    const v = await p; const t1 = Date.now() - t0;
    const changed = !sameSnapshot(before, snapshot(d)).same;
    const saw = /MUTATED MID-CHECK/.test(v.requested?.out || '') ? 'the MUTATED bytes' : /CANDIDATE/.test(v.requested?.out || '') ? 'the ORIGINAL bytes' : 'neither';
    record('M18', 'CONSISTENCY', 'OWN host write mid-check', { outcome: !changed ? 'APPARATUS_FAULT' : v.verdict === 'EVALUATION_ERROR' ? 'HOLDS' : `VIOLATED (CONSISTENCY) verdict=${v.verdict}`,
      idA: v.candidateTree, note: `mutated at ${tm}ms of ${t1}ms; the check printed ${saw}`
        + (MODE !== 'head' ? ` | cid1 before/after ${cidBefore === ID(d).id ? 'SAME' : 'DIFFER (the signal D-CONS needs exists; nothing consumes it yet)'}` : '') }); }

  // M19 BINDING: the receipt must name the bytes the check actually saw
  { const d = ownRepo(join(mk('M19'), 'c'));
    writeFileSync(join(d, 'subject.js'), 'module.exports={probe:()=>"UNCOMMITTED WORK"};\n');
    const v = await evaluate(d, { id: 'm19', requested: { script: 'cat /candidate/subject.js' }, protected: { script: 'true' } });
    const seen = String(v.requested?.out || '').trim();
    const named = v.candidateTree ? git(d, ['show', `${v.candidateTree}:subject.js`]).trim() : null;
    record('M19', 'BINDING', 'OWN uncommitted', { outcome: !seen ? 'APPARATUS_FAULT' : named === seen ? 'HOLDS' : 'VIOLATED (BINDING)', idA: v.candidateTree,
      note: `check saw ${JSON.stringify(seen.slice(0, 48))}; receipt names ${JSON.stringify(String(named).slice(0, 48))}` }); }

  // ── predictions frozen in the prereg, scored ─────────────────────────────────────────────────
  // "M1, M5 fail in the no-.git shape; M3, M4 fail UNAVAILABLE; M7, M8, M9, M10, M13 fail when
  //  uncommitted; M17 fails; M2, M6, M12, M16 expected to pass in their own-repo forms"
  const violated = (row, shapeRe) => rows.some((r) => r.row === row && shapeRe.test(r.shape) && /^VIOLATED/.test(r.outcome));
  const measured = (row) => rows.some((r) => r.row === row && !/NOT_RUNNABLE|APPARATUS/.test(r.outcome));
  const allHold = (row) => rows.filter((r) => r.row === row).every((r) => r.outcome === 'HOLDS');
  // "not measured" is UNSCORED, never "wrong" (the head-mode run printed WRONG for M13 - corrected)
  const preds = MODE !== 'head' ? [
    // Amendment 2, a69aaddd
    ...['M3', 'M4'].map((r) => [`${r} holds (AVAILABILITY)`, allHold(r), measured(r)]),
    ...['M1', 'M2', 'M5', 'M6', 'M12', 'M14', 'M16'].map((r) => [`${r} holds genuinely, every measured shape`, rows.filter((x) => x.row === r && !/NOT_RUNNABLE/.test(x.outcome)).every((x) => x.outcome === 'HOLDS'), measured(r)]),
    ...['M7', 'M8', 'M9', 'M10', 'M11'].map((r) => [`${r} holds, every shape`, allHold(r), measured(r)]),
    ['M15a odd. AVAILABLE (worker listing: no prediction)', rows.some((x) => x.row === 'M15a' && !/AVAILABILITY/.test(x.outcome)), measured('M15a')],
    ['M15b holds (no collapse)', allHold('M15b'), measured('M15b')],
    ['M15c UNAVAILABLE', allHold('M15c'), measured('M15c')],
    ['M13 unmeasured on Windows', !measured('M13'), true],
    ['M17 STAYS RED', violated('M17', /./), measured('M17')],
    ['M18 STAYS RED', violated('M18', /./), measured('M18')],
    ['M19 STAYS RED', violated('M19', /./), measured('M19')],
  ].map(([p, ok, m]) => [p, m ? ok : null]) : [
    ['M1 violated BARE', violated('M1', /BARE/)], ['M5 violated BARE', violated('M5', /BARE/)],
    ['M3 violated (unavailable)', violated('M3', /./)], ['M4 violated (unavailable)', violated('M4', /./)],
    ...['M7', 'M8', 'M9', 'M10', 'M13'].map((r) => [`${r} violated uncommitted`, violated(r, /uncommitted/)]),
    ['M17 violated', violated('M17', /./)],
    ...['M2', 'M6', 'M12'].map((r) => [`${r} holds OWN`, rows.some((x) => x.row === r && /OWN/.test(x.shape) && x.outcome === 'HOLDS')]),
    ['M16 holds (as predicted)', rows.some((x) => x.row === 'M16' && x.outcome === 'HOLDS')],
  ];
  result.predictions = preds.map(([p, ok]) => ({ prediction: p, correct: ok }));

  // ── report by property / boundary, never a total ────────────────────────────────────────────
  say('\n=== BY PROPERTY (boundary) ===');
  // Grouped by the property VIOLATED (parsed from the outcome), not the row's declared tag: the
  // first run listed M3/M4 under INVARIANCE although they violate AVAILABILITY.
  const violatedProp = (r) => (String(r.outcome).match(/^VIOLATED \((\w+)\)/) || [])[1] || null;
  for (const tag of Object.keys(TAGS)) {
    const rs = rows.filter((r) => (violatedProp(r) || r.tag) === tag); if (!rs.length) continue;
    const v = rs.filter((r) => /^VIOLATED/.test(r.outcome));
    say(`  ${tag.padEnd(16)} [${TAGS[tag]}]  violated in: ${v.length ? v.map((r) => `${r.row}/${r.shape}`).join('; ') : 'none'}`);
    const vac = rs.filter((r) => r.outcome === 'HOLDS_VACUOUSLY'); if (vac.length) say(`  ${''.padEnd(16)} held only vacuously (named the parent): ${vac.map((r) => `${r.row}/${r.shape}`).join('; ')}`);
    const nr = rs.filter((r) => /NOT_RUNNABLE|APPARATUS/.test(r.outcome)); if (nr.length) say(`  ${''.padEnd(16)} not measured: ${nr.map((r) => `${r.row}/${r.shape}=${r.outcome}`).join('; ')}`);
  }
  say('\n=== PREDICTIONS (frozen in the prereg) ===');
  for (const p of result.predictions) say(`  ${p.correct === null ? 'UNSCORED' : p.correct ? 'correct ' : 'WRONG   '}  ${p.prediction}`);

  run.artifact('did1-regression.log', log.join('\n') + '\n');
  run.artifact('result.json', result);
  const sealed = run.seal({ exitStatus: 0 });
  console.log(`\nEH1 sealed: ${sealed.state} artifacts=${sealed.artifacts.length} clean=${sealed.worktreeClean} diff=${String(sealed.worktreeDiffHash).slice(0, 12)}`);
  console.log(`run dir: ${run.dir}`);
} catch (e) {
  say(`APPARATUS FAILURE: ${e.stack || e}`);
  try { run.artifact('did1-regression.log', log.join('\n') + '\n'); run.artifact('partial.json', result); run.abandon({ reason: String(e.message || e).slice(0, 300) }); } catch { /* preserve what we can */ }
  process.exitCode = 1;
} finally {
  for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
  console.log(MODE !== 'head'
    ? 'cid1 measured as a pure observer, wired into nothing. D-COPY / D-CONS / D-BIND NOT repaired.'
    : 'NOTHING WAS REPAIRED. cid1 NOT WRITTEN.');
}
