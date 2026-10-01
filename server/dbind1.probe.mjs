/**
 * dbind1.probe.mjs - D-BIND-1: does the evidence name the exact object that was judged?
 *
 *   DBIND_PHASE=before node server/dbind1.probe.mjs     (shipped evaluator - MUST FIRE on B1/B1i/B2/B5, B7=1)
 *   DBIND_PHASE=after  node server/dbind1.probe.mjs
 *
 * Frozen in legasus/screen/D-BIND-1_PREREG.md before this file existed. Runs the REAL evaluate(),
 * applyAcceptance(), runBatch() and mechanismAudit.mjs. cid1 is used only as the probe's own oracle
 * for "what object is this"; the RECEIPT under test is what evaluate() and its transport sites record.
 *
 *   receipt.subject === verdict.subject === C0     NOT cid1(workspace now)     NOT HEAD^{tree}
 */
import { mkdtempSync, writeFileSync, unlinkSync, rmSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';
import { evaluate } from './evaluator.js';
import { applyAcceptance } from './acceptance.js';
import { runBatch } from './batch.js';
import { WORKER_IMAGE } from './worker.js';
import { cid1 } from './cid1.mjs';

const PHASE = process.env.DBIND_PHASE;
if (!['before', 'after'].includes(PHASE)) throw new Error('set DBIND_PHASE=before or after');
const REPO = process.cwd();
const run = openRun({ root: join(REPO, 'legasus', 'evidence-runs'), label: `D-BIND-1-${PHASE.toUpperCase()}`, command: `DBIND_PHASE=${PHASE} node server/dbind1.probe.mjs`,
  repo: REPO, evidenceClass: EVIDENCE_CLASS.ORIGINAL, note: `D-BIND-1 ${PHASE} the receipt repair.` });
const log = []; const say = (s) => { console.log(s); log.push(s); };
const temps = []; const mk = (p) => { const d = mkdtempSync(join(tmpdir(), `dbind-${p}-`)); temps.push(d); return d; };
const git = (at, a) => { try { return execFileSync('git', ['-C', at, ...a], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return `ERR:${String(e.message).split('\n')[0].slice(0, 60)}`; } };

const ORIGINAL = 'module.exports={probe:()=>"ORIGINAL"};\n';
const FILES = { 'subject.js': ORIGINAL, 'keep.txt': 'KEEP\n', 'lib.js': 'module.exports=1;\n' };
function write(d, files) { for (const [f, b] of Object.entries(files)) { mkdirSync(join(d, f, '..'), { recursive: true }); writeFileSync(join(d, f), b); } }
function commitAll(d, m = 'c') { git(d, ['add', '-A']); git(d, ['-c', 'user.email=b@b', '-c', 'user.name=b', 'commit', '-q', '--allow-empty', '-m', m]); }
function candidate(files = FILES) { const d = mk('c'); write(d, files); git(d, ['init', '-q']); git(d, ['config', 'core.autocrlf', 'false']); commitAll(d, 'start'); return d; }
function bareUnder(parent, files = FILES) { const d = join(parent, 'cand'); mkdirSync(d, { recursive: true }); write(d, files); return d; }
function parentRepo(content) { const p = mk('p'); if (content === null) return p; git(p, ['init', '-q']); if (content === '') return p; writeFileSync(join(p, 'PARENT.txt'), content); commitAll(p, 'parent'); return p; }
const CAT = { id: 'b', requested: { script: 'cat /candidate/subject.js' }, protected: { script: 'true' } };
const short = (x) => (x == null ? String(x) : String(x).slice(0, 18));
const isCid = (x) => typeof x === 'string' && x.startsWith('cid1:');
const rows = [];
function record(id, label, r) { rows.push({ id, label, ...r }); say(`  ${id.padEnd(4)} ${label.padEnd(44)} ${r.outcome.padEnd(34)} ${r.note || ''}`); }
const V = (s) => `VIOLATION: ${s}`;

try {
  say(`D-BIND-1 ${PHASE.toUpperCase()}   EH1 ${run.id}`);

  // B0 ordinary PASS: receipt.subject === verdict.subject === C0, alias equal by construction
  { const d = candidate(); const C0 = cid1(d).id; const v = await evaluate(d, CAT);
    const ok = v.verdict === 'PASS' && v.subject === C0 && v.candidateTree === v.subject;
    record('B0', 'ordinary PASS, own repo', { outcome: ok ? 'HOLDS' : V(v.subject !== C0 ? 'subject ≠ C0' : v.candidateTree !== v.subject ? 'candidateTree ≠ subject' : `verdict ${v.verdict}`),
      verdict: v.verdict, subject: v.subject, candidateTree: v.candidateTree, C0 }); }

  // B1 D-PROP-1 reversed: committed C, uncommitted bytes K; the receipt must name K (what the check printed)
  { const d = candidate(); const idC = cid1(candidate()).id;   // identity of the COMMITTED content, from an identical twin
    writeFileSync(join(d, 'subject.js'), 'module.exports={probe:()=>"UNCOMMITTED WORK"};\n');
    const idK = cid1(d).id; const v = await evaluate(d, CAT);
    const saw = /UNCOMMITTED WORK/.test(v.requested?.out || '');
    const ok = saw && v.candidateTree === idK && v.subject === idK && v.candidateTree !== idC;
    record('B1', 'D-PROP-1 reversed: receipt names the judged bytes', { outcome: !saw ? 'APPARATUS (check did not print K)' : ok ? 'HOLDS'
        : V(isCid(v.candidateTree) ? 'receipt is cid1 but not K' : 'receipt names the tree never judged (git)'),
      receipt: v.candidateTree, subject: v.subject, idK, idC, note: `receipt ${short(v.candidateTree)}  K ${short(idK)}  C ${short(idC)}` }); }

  // B1i ignored file, everything committed
  { const d = candidate({ ...FILES, '.gitignore': '*.log\n' }); writeFileSync(join(d, 'debug.log'), 'a check can read this\n'); commitAll(d, 'all');
    const idWith = cid1(d).id; const v = await evaluate(d, CAT);
    record('B1i', 'ignored file present, all committed', { outcome: v.candidateTree === idWith && v.subject === idWith ? 'HOLDS' : V('receipt excludes the ignored file (git view)'),
      receipt: v.candidateTree, idWith }); }

  // B2 D'-1 A5 reversed: identical no-.git candidate under P1, P2, P0, Pc
  { const outs = {};
    for (const [n, c] of [['P1', 'ONE\n'], ['P2', 'TWO is different\n'], ['P0', null], ['Pc', '']]) { const d = bareUnder(parentRepo(c)); outs[n] = { v: await evaluate(d, CAT), C0: cid1(d).id }; }
    const subs = new Set(Object.values(outs).map((o) => o.v.candidateTree)); const verdicts = Object.values(outs).map((o) => o.v.verdict);
    const ok = subs.size === 1 && isCid([...subs][0]) && verdicts.every((x) => x === 'PASS') && Object.values(outs).every((o) => o.v.subject === o.C0 && o.v.candidateTree === o.C0);
    record('B2', "D'-1 A5 reversed: 4 parents, one receipt", { outcome: ok ? 'HOLDS' : V(`${subs.size} distinct receipts; verdicts ${verdicts.join('/')}`),
      receipts: Object.fromEntries(Object.entries(outs).map(([n, o]) => [n, { receipt: o.v.candidateTree, verdict: o.v.verdict }])),
      note: Object.entries(outs).map(([n, o]) => `${n}:${short(o.v.candidateTree)}/${o.v.verdict}`).join(' ') }); }

  // B3 identical working bytes, HEAD at X vs Y (a committed file then deleted from the working tree)
  { const d = candidate(); const s0 = cid1(d).id; const v1 = await evaluate(d, CAT);
    writeFileSync(join(d, 'only-in-head.txt'), 'x\n'); commitAll(d, 'Y'); unlinkSync(join(d, 'only-in-head.txt'));
    const s1 = cid1(d).id; const v2 = await evaluate(d, CAT);
    const treeMoved = git(d, ['rev-parse', 'HEAD^{tree}']);
    record('B3', 'HEAD moved, snapshot unchanged', { outcome: s0 !== s1 ? 'APPARATUS (snapshot changed)' : v1.candidateTree === v2.candidateTree && v1.subject === v2.subject ? 'HOLDS' : V('receipt follows HEAD'),
      r1: v1.candidateTree, r2: v2.candidateTree, note: `receipts ${short(v1.candidateTree)} vs ${short(v2.candidateTree)}` }); }

  // B4 live candidate mutated after the verdict: the receipt is about the JUDGED object
  { const d = candidate(); const v = await evaluate(d, CAT); const C0 = v.subject;
    writeFileSync(join(d, 'subject.js'), 'module.exports={probe:()=>"LATER"};\n'); const now = cid1(d).id;
    record('B4', 'live mutated after the verdict', { outcome: v.subject === C0 && now !== v.subject && v.candidateTree === v.subject ? 'HOLDS' : V(v.candidateTree !== v.subject ? 'candidateTree ≠ subject' : 'receipt tracks workspace-now'),
      subject: v.subject, candidateTree: v.candidateTree, liveNow: now }); }

  // B5 subject UNAVAILABLE in a candidate that HAS a git HEAD: fail closed, no git fallback
  { const d = resolve(candidate());
    const ps = `[IO.File]::WriteAllText('${d}\\' + 'bad' + [char]0xD800 + 'name', 'lone'); [IO.File]::WriteAllText('${d}\\' + 'bad' + [char]0xFFFD + [char]0xFFFD + [char]0xFFFD + 'name', 'look'); Get-ChildItem -LiteralPath '${d}' | ForEach-Object { ($_.Name.ToCharArray() | ForEach-Object { '{0:X4}' -f [int]$_ }) -join ' ' }`;
    let cps = null; try { cps = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/); } catch {}
    const proven = !!cps && cps.some((l) => / D8[0-9A-F]{2} /.test(` ${l} `));
    if (!proven) record('B5', 'unavailable subject, git HEAD present', { outcome: 'NOT_RUNNABLE', note: 'lone surrogate not created' });
    else { const v = await evaluate(d, CAT); const headTree = git(d, ['rev-parse', 'HEAD^{tree}']);
      const ok = v.verdict === 'EVALUATION_ERROR' && v.subject == null && v.candidateTree == null;
      record('B5', 'unavailable subject, git HEAD present', { outcome: ok ? 'HOLDS (closed, no fallback)' : V(v.candidateTree === headTree ? 'FELL BACK TO GIT: candidateTree = HEAD^{tree}' : `verdict ${v.verdict}, candidateTree ${short(v.candidateTree)}`),
        verdict: v.verdict, subject: v.subject ?? null, candidateTree: v.candidateTree ?? null, headTree }); } }

  // B6 + B7: the real batch (chain). t1 RETAIN; t2 damages keep.txt WITHOUT committing -> RESTORED
  { const root = mk('batch'); const wsDir = join(root, 'ws');
    const tasks = [
      { id: 't1', seed: { 'keep.txt': 'KEEP\n' }, requested: { script: 'test -f /candidate/subject.js' }, protected: { script: 'grep -q KEEP /candidate/keep.txt' } },
      { id: 't2', dependsOn: 't1', requested: { script: 'true' }, protected: { script: 'grep -q KEEP /candidate/keep.txt' } },
    ];
    const runTask = async (ws, task) => { if (task.id === 't1') writeFileSync(join(ws, 'subject.js'), ORIGINAL); if (task.id === 't2') unlinkSync(join(ws, 'keep.txt')); return { status: 'DONE', exit: 0 }; };
    const r = await runBatch(tasks, { workspacesDir: wsDir, auditDir: join(root, 'audit'), journalPath: join(root, 'j.jsonl'), perTaskSec: 120, totalSec: 600, runTask, evalImage: WORKER_IMAGE, chain: true });
    const t1 = r.results.find((x) => x.task === 't1'), t2 = r.results.find((x) => x.task === 't2');
    const acc = t1.acceptance, baseId = cid1(join(wsDir, '.accepted-baseline')).id;
    const chain = {
      verdictSubject: t1.verdict?.subject ?? null, accSubject: acc?.candidateVerdict?.subject ?? null, accTree: acc?.candidateVerdict?.candidateTree ?? null,
      survivingTree: acc?.survivingWorkspaceVerdict?.candidateTree ?? null, survivingSubject: acc?.survivingWorkspaceVerdict?.subject ?? null, baselineTree: t1.baselineTree ?? null, baselineCid1: baseId,
    };
    const ok = t1.acceptance?.disposition === 'RETAIN' && chain.accSubject === chain.verdictSubject && chain.accTree === chain.verdictSubject
      && chain.survivingSubject === chain.survivingTree && chain.baselineTree === chain.survivingTree && chain.baselineTree === baseId;
    record('B6', 'consumers transport the subject to the baseline', { outcome: t1.acceptance?.disposition !== 'RETAIN' ? `APPARATUS (t1 ${t1.acceptance?.disposition})` : ok ? 'HOLDS'
        : V(chain.accSubject == null ? 'acceptance carries no subject' : chain.baselineTree !== baseId ? 'baselineTree ≠ cid1(baseline dir)' : 'chain broken'),
      ...chain, note: `baselineTree ${short(chain.baselineTree)}  cid1(baseline) ${short(baseId)}` });
    // B7: mechanismAudit over this batch
    const camp = join(root, 'campaign'); mkdirSync(join(camp, 'runs'), { recursive: true });
    const lines = [{ kind: 'plan', tasks: ['t1', 't2'] }];
    for (const [i, x] of r.results.entries()) { lines.push({ kind: 'run', idx: i, task: x.task, arm: 'B', rep: 1, runId: `run-${x.task}`, state: x.state, disposition: x.acceptance?.disposition, accepted: x.acceptance?.disposition === 'RETAIN',
      candidateTree: x.acceptance?.candidateVerdict?.candidateTree ?? null, survivingTree: x.acceptance?.survivingWorkspaceVerdict?.candidateTree ?? null }); writeFileSync(join(camp, 'runs', `run-${x.task}.json`), JSON.stringify({ id: `run-${x.task}`, status: 'done', steps: [] })); }
    writeFileSync(join(camp, 'summary.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    execFileSync(process.execPath, [join(REPO, 'server', 'mechanismAudit.mjs'), camp, '--out', join(camp, 'audit.json')], { encoding: 'utf8', windowsHide: true });
    const a = JSON.parse(readFileSync(join(camp, 'audit.json'), 'utf8')); const u2 = a.units.find((u) => u.task === 't2');
    record('B7', 'D-CONSUME-1 finding 1: audit of an uncommitted restore', { outcome: t2?.acceptance?.disposition !== 'RESTORED' ? `APPARATUS (t2 ${t2?.acceptance?.disposition})` : a.labelDisagreements.length === 0 ? 'HOLDS (0 disagreements)' : V(`${a.labelDisagreements.length} label disagreement(s): a correct restore reads as wrong`),
      labelDisagreements: a.labelDisagreements.length, t2: { disposition: u2?.disposition, treesEqual: u2?.treesEqual, labelAgrees: u2?.labelAgrees } }); }

  // K8 the commit boundary - must STAY RED
  { const d = candidate(); const startRef = git(d, ['rev-parse', 'HEAD']);
    const task = { id: 'k8', requested: { script: 'true' }, protected: { script: 'true' } };
    const v = await evaluate(d, task); writeFileSync(join(d, 'subject.js'), 'module.exports={probe:()=>"MUTATED"};\n');
    const acc = await applyAcceptance(d, task, v, { startRef, captureDir: null, taskId: 'k8' }); const live = cid1(d).id;
    record('K8', 'mutation between verdict and commit', { outcome: acc.disposition === 'RETAIN' && live !== v.subject ? 'RETAINED C1 with receipt.subject = C0 (red: commit boundary)' : `disposition ${acc.disposition}`,
      receipt: v.candidateTree, subject: v.subject, live }); }

  const by = Object.fromEntries(rows.map((r) => [r.id, r])); const viol = (id) => /^VIOLATION/.test(by[id]?.outcome || '');
  const verdict = PHASE === 'before'
    ? { mustFire: viol('B1') && viol('B1i') && viol('B2') && (viol('B5') || by.B5.outcome === 'NOT_RUNNABLE') && by.B7.labelDisagreements === 1, violated: rows.filter((r) => viol(r.id)).map((r) => r.id), b7: by.B7.labelDisagreements, k8Red: /RETAINED C1/.test(by.K8.outcome) }
    : { allHold: ['B0', 'B1', 'B1i', 'B2', 'B3', 'B4', 'B6', 'B7'].every((k) => /^HOLDS/.test(by[k].outcome)), b5: by.B5.outcome, k8StillRed: /RETAINED C1/.test(by.K8.outcome) };
  say(`\n=== D-BIND-1 ${PHASE.toUpperCase()} ===`); for (const [k, x] of Object.entries(verdict)) say(`    ${k.padEnd(12)} ${JSON.stringify(x)}`);
  run.artifact('dbind1.log', log.join('\n') + '\n'); run.artifact('result.json', { phase: PHASE, rows, verdict });
  const s = run.seal({ exitStatus: 0 }); console.log(`EH1 sealed: ${s.state}  ${run.dir}`);
} catch (e) {
  say(`APPARATUS FAILURE: ${e.stack || e}`); try { run.artifact('dbind1.log', log.join('\n') + '\n'); run.abandon({ reason: String(e.message).slice(0, 300) }); } catch {}
  process.exitCode = 1;
} finally { for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch {} } }
