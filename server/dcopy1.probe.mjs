/**
 * dcopy1.probe.mjs - D-COPY-1: does workspace construction preserve the snapshot?
 *
 *   DCOPY_PHASE=before node server/dcopy1.probe.mjs     (unrepaired batch.js - MUST FIRE)
 *   DCOPY_PHASE=after  node server/dcopy1.probe.mjs     (after the repair)
 *
 * Frozen in legasus/screen/D-COPY-1_PREREG.md (4bec21ce) before this file existed. Runs the REAL
 * runBatch through both construction sites (batch.js :189 workspace -> baseline, :269 baseline ->
 * next task) and judges with cid1 (content equality), plus an entry-by-entry matrix. Only runTask -
 * the model - is stubbed. cid1 is used as the ORACLE only; it is not wired into anything.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';
import { runBatch } from './batch.js';
import { WORKER_IMAGE } from './worker.js';
import { cid1 } from './cid1.mjs';

const PHASE = process.env.DCOPY_PHASE;
if (!['before', 'after'].includes(PHASE)) throw new Error('set DCOPY_PHASE=before or after');
const REPO = process.cwd();
const run = openRun({ root: join(REPO, 'legasus', 'evidence-runs'), label: `D-COPY-1-${PHASE.toUpperCase()}`, command: `DCOPY_PHASE=${PHASE} node server/dcopy1.probe.mjs`,
  repo: REPO, evidenceClass: EVIDENCE_CLASS.ORIGINAL, note: `D-COPY-1 ${PHASE} the batch.js repair. Prereg 4bec21ce.` });
const log = []; const say = (s) => { console.log(s); log.push(s); };
const temps = [];

// The frozen matrix: path -> expected in the baseline under the RULE (true = preserved)
const MATRIX = {
  '.gitignore': true, '.gitattributes': true, '.github/workflows/ci.yml': true, 'foo.git': true, '.gitconfig': true,
  'nested/.git/HEAD': false, 'nested/.github/x.yml': true, 'README.md': true, 'src/deep/a/b/c.js': true,
};
// What the CURRENT substring filter is predicted to do (prereg table)
const PREDICTED_CURRENT = { ...MATRIX, '.gitignore': false, '.gitattributes': false, '.github/workflows/ci.yml': false, '.gitconfig': false, 'nested/.github/x.yml': false };
const CONTENT = (p) => `content of ${p}\n`;

/** Entries present (files only) relative to root, .git components excluded exactly - apparatus listing. */
function files(root) {
  const out = new Set();
  if (!existsSync(root)) return out;
  const walk = (d, rel) => { for (const n of readdirSync(d, { withFileTypes: true })) {
    const r = rel ? `${rel}/${n.name}` : n.name;
    if (n.isDirectory()) { if (n.name === '.git' && !rel) continue; walk(join(d, n.name), r); } else out.add(r);
  } };
  walk(root, '');
  return out;
}

async function layout(name, root) {
  const at = {};
  const tasks = [
    { id: 't1', seed: { 'seed.txt': 'seed\n' }, requested: { script: 'true' }, protected: { script: 'true' } },
    { id: 't2', dependsOn: 't1', requested: { script: 'true' }, protected: { script: 'true' } },
  ];
  const runTask = async (ws, task) => {
    if (task.id === 't1') {
      for (const p of Object.keys(MATRIX)) { mkdirSync(dirname(join(ws, p)), { recursive: true }); writeFileSync(join(ws, p), CONTENT(p)); }
      mkdirSync(join(ws, '.git', 'objects'), { recursive: true }); writeFileSync(join(ws, '.git', 'objects', 'zz-dcopy-junk'), 'root .git internals\n');
      mkdirSync(join(ws, 'emptydir'), { recursive: true });
    }
    if (task.id === 't2') { at.t2start = cid1(ws); at.t2files = files(ws); }
    return { status: 'DONE', exit: 0 };
  };
  const wsDir = join(root, 'workspaces');
  const r = await runBatch(tasks, { workspacesDir: wsDir, auditDir: join(root, 'audit'), journalPath: join(root, 'journal.jsonl'),
    perTaskSec: 120, totalSec: 600, runTask, evalImage: WORKER_IMAGE, chain: true });
  const t1 = r.results.find((x) => x.task === 't1'), t2 = r.results.find((x) => x.task === 't2');
  const baseDir = join(wsDir, '.accepted-baseline');
  const C = cid1(join(wsDir, 't1')), B = existsSync(baseDir) ? cid1(baseDir) : { ok: false, reason: 'baseline directory ABSENT' };
  const S = at.t2start || { ok: false, reason: 't2 never started' };
  const baseFiles = files(baseDir);
  const matrix = Object.keys(MATRIX).map((p) => ({ path: p, rule: MATRIX[p], predictedCurrent: PREDICTED_CURRENT[p], inBaseline: baseFiles.has(p), inT2Start: at.t2files ? at.t2files.has(p) : null }));
  const res = {
    layout: name, root, t1: t1?.acceptance?.disposition ?? t1?.state, t2: t2?.state,
    cidCandidate: C.ok ? C.id : `REFUSED ${C.reason}`, cidBaseline: B.ok ? B.id : `REFUSED ${B.reason}`, cidT2Start: S.ok ? S.id : `REFUSED ${S.reason}`,
    baselineEqualsCandidate: C.ok && B.ok && C.id === B.id, t2StartEqualsCandidate: C.ok && S.ok && C.id === S.id,
    baselineExists: existsSync(baseDir), baselineFileCount: baseFiles.size, matrix,
  };
  say(`--- ${name}   t1=${res.t1}  t2=${res.t2}  baseline exists=${res.baselineExists} (${res.baselineFileCount} files)`);
  say(`    cid1 candidate ${String(res.cidCandidate).slice(0, 22)}  baseline ${String(res.cidBaseline).slice(0, 22)}  t2-start ${String(res.cidT2Start).slice(0, 22)}`);
  say(`    candidate == baseline: ${res.baselineEqualsCandidate}    candidate == t2 start: ${res.t2StartEqualsCandidate}`);
  for (const m of matrix) say(`      ${m.path.padEnd(26)} rule ${m.rule ? 'KEEP' : 'drop'}  current-predicts ${m.predictedCurrent ? 'KEEP' : 'drop'}  baseline ${m.inBaseline ? 'KEEP' : 'drop'}  t2 ${m.inT2Start === null ? '-' : m.inT2Start ? 'KEEP' : 'drop'}`);
  return res;
}

const result = { phase: PHASE, prereg: '4bec21ce', layouts: [] };
try {
  say(`D-COPY-1 ${PHASE.toUpperCase()}   EH1 ${run.id}`);
  const plain = mkdtempSync(join(tmpdir(), 'dcopy-')); temps.push(plain);
  result.layouts.push(await layout('ordinary location', join(plain, 'hub')));
  const anc = mkdtempSync(join(tmpdir(), 'dcopy-anc-')); temps.push(anc);
  result.layouts.push(await layout('under an ancestor named .gitlab-runner', join(anc, '.gitlab-runner', 'hub')));

  const [P, A] = result.layouts;
  const exactRule = (L) => L.matrix.every((m) => m.inBaseline === m.rule && m.inT2Start === m.rule);
  const asPredicted = (L) => L.matrix.every((m) => m.inBaseline === m.predictedCurrent);
  result.verdict = PHASE === 'before'
    ? { mustFire: !P.baselineEqualsCandidate, matrixAsPredicted: asPredicted(P), ancestorCopiesNothing: !A.baselineExists || A.baselineFileCount === 0,
        fired: !P.baselineEqualsCandidate && asPredicted(P) }
    : { m17Green: P.baselineEqualsCandidate && P.t2StartEqualsCandidate && A.baselineEqualsCandidate && A.t2StartEqualsCandidate,
        matrixExact: exactRule(P) && exactRule(A) };
  say(`\n=== D-COPY-1 ${PHASE.toUpperCase()} ===`);
  for (const [k, v] of Object.entries(result.verdict)) say(`    ${k.padEnd(22)} ${v}`);

  run.artifact('dcopy1.log', log.join('\n') + '\n');
  run.artifact('result.json', result);
  const s = run.seal({ exitStatus: 0 }); console.log(`EH1 sealed: ${s.state}  ${run.dir}`);
} catch (e) {
  say(`APPARATUS FAILURE: ${e.stack || e}`); try { run.artifact('dcopy1.log', log.join('\n') + '\n'); run.abandon({ reason: String(e.message).slice(0, 300) }); } catch {}
  process.exitCode = 1;
} finally { for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch {} } }
