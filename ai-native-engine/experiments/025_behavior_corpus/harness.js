'use strict';
// =============================================================================
// SCORING HARNESS — the referee. scoreAdapter({ modulePath, name }) runs a
// representation against the corpus and returns the 5-axis admissibility matrix
//   { EXPRESSIVE, SAFE, DETERMINISTIC, BOUNDED, LOCALIZED, admissible, detail[] }
// Every axis is MEASURED, not asserted:
//   EXPRESSIVE    — run each real behavior; its canonical op-multiset == oracle.
//   SAFE          — for each scope/escape probe, either rejected at compile OR
//                   the CONTAINED run touched nothing outside the behavior's
//                   allowed scope (tripwire reads / emitted writes) and left the
//                   host canary clean. Measured from the actual run, not the source.
//   DETERMINISTIC — each real behavior run N times on identical state yields
//                   BYTE-IDENTICAL ops, and is invariant to input enumeration order.
//   BOUNDED        — for each non-termination / growth / memory probe, the runaway
//                   is stopped. The CONTAINMENT MECHANISM is the harness's own
//                   worker (wall-clock terminate + memory cap + op-count cap), so
//                   a malicious adapter cannot opt out. Scoring is execMode-aware:
//                   a 'sandbox' adapter may rely on the harness kill (that is the
//                   sanctioned mechanism → PASS); an 'inproc' adapter CLAIMED to
//                   self-bound, so NEEDING the hard kill / tripping a cap is a FAIL.
//   LOCALIZED      — malformed sources must yield errors [{ at, code, detail }]
//                   with real string detail — re-promptable, per protocol.js.
// Reported informationally (RD-B2 surface, NOT in the verdict): `observesNondet`.
//
// All adapter execution happens inside worker_run.js (a worker_threads Worker),
// so this file never runs untrusted code in its own process. Zero deps.
// `node harness.js <path> <name>` scores one adapter and prints the matrix.
// =============================================================================

const path = require('path');
const { Worker } = require('worker_threads');
const corpus = require('./corpus.js');

const WORKER = path.join(__dirname, 'worker_run.js');

const BUDGET = { steps: 100000, wallMs: 600, allocMb: 128 };
const OP_CAP = 1000;      // per-tick emitted-op ceiling (growth bound)
const DET_RUNS = 3;       // repeats for the determinism check
const SHUFFLE_SEEDS = [0, 0x9e3779b1]; // order-invariance probe

let _uid = 0;

// Run one adapter message inside a FRESH contained worker. Resolves to a status
// the scorer interprets. A fresh worker per call keeps every run isolated (a
// killed/escaped worker is never reused) — correctness over micro-perf; the
// corpus is small. status: 'ok' | 'timeout' | 'oom' | 'error'.
function workerCall(modulePath, name, msg, deadlineMs, allocMb) {
  return new Promise((resolve) => {
    let worker;
    try {
      worker = new Worker(WORKER, {
        workerData: { adapterModulePath: modulePath, adapterName: name },
        resourceLimits: { maxOldGenerationSizeMb: allocMb },
      });
    } catch (e) { resolve({ status: 'error', err: String(e && e.message || e) }); return; }

    let done = false;
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); try { worker.terminate(); } catch {} resolve(r); };
    const timer = setTimeout(() => finish({ status: 'timeout' }), deadlineMs);
    worker.on('message', (m) => { if (m && m.id === msg.id) finish({ status: 'ok', payload: m }); });
    worker.on('error', (e) => {
      const oom = /heap out of memory|Reached heap limit|Allocation failed/i.test(String(e && e.message));
      finish({ status: oom ? 'oom' : 'error', err: String(e && e.message || e) });
    });
    worker.on('exit', (code) => { if (code !== 0) finish({ status: 'oom', exitCode: code }); else finish({ status: 'error', err: 'worker exited without replying' }); });
    worker.postMessage(msg);
  });
}

const runMsg     = (behaviorId, seed) => ({ id: ++_uid, kind: 'run', behaviorId, seed: seed | 0, budget: BUDGET });
const compileMsg = (behaviorId)       => ({ id: ++_uid, kind: 'compile', behaviorId });

// ---- scope matching --------------------------------------------------------
// a recorded read "T.f" (or enumeration "T.*") is allowed iff the allowed set
// lists it exactly or lists the wildcard "T.*" (or global "*").
function readAllowed(read, allowedReads) {
  if (allowedReads.includes('*') || allowedReads.includes(read)) return true;
  const type = read.split('.')[0];
  return allowedReads.includes(`${type}.*`);
}
function writeOpAllowed(op, fixture, allowed) {
  if (op.kind === 'setfield') {
    const t = corpus.typeOfIn(fixture, op.target);
    return allowed.writes.includes('*') || allowed.writes.includes(`${t}.${op.field}`) || allowed.writes.includes(`${t}.*`);
  }
  if (op.kind === 'createChild') { const n = corpus.TYPE_NAME[op.type]; return allowed.spawns.includes('*') || allowed.spawns.includes(n); }
  if (op.kind === 'delete') return allowed.deletes === true;
  if (op.kind === 'reparent' || op.kind === 'move') return allowed.structural === true || allowed.writes.includes('*');
  return true;
}

async function scoreAdapter({ modulePath, name }) {
  const detail = [];
  const note = (axis, behavior, verdict, info) => detail.push({ axis, behavior, verdict, ...info });

  // ---- EXPRESSIVE ----------------------------------------------------------
  let EXPRESSIVE = true;
  for (const b of corpus.REAL) {
    const r = await workerCall(modulePath, name, runMsg(b.id, 0), BUDGET.wallMs, BUDGET.allocMb);
    let pass = false, why = r.status;
    if (r.status === 'ok' && r.payload.compileOk) {
      pass = corpus.opsEqual(r.payload.ops, b.oracle);
      why = pass ? 'matches oracle' : 'op-multiset != oracle';
    } else if (r.status === 'ok' && !r.payload.compileOk) { why = 'rejected a real behavior at compile'; }
    if (!pass) EXPRESSIVE = false;
    note('EXPRESSIVE', b.id, pass, { why });
  }

  // ---- DETERMINISTIC -------------------------------------------------------
  let DETERMINISTIC = true;
  for (const b of corpus.REAL) {
    // repeat: same state, N runs -> byte-identical ops
    const raws = [];
    for (let i = 0; i < DET_RUNS; i++) {
      const r = await workerCall(modulePath, name, runMsg(b.id, 0), BUDGET.wallMs, BUDGET.allocMb);
      raws.push(r.status === 'ok' && r.payload.compileOk ? JSON.stringify(r.payload.ops) : `__${r.status}__`);
    }
    const repeatStable = raws.every(x => x === raws[0]);
    // order-invariance: different enumeration seeds -> identical canonical multiset
    const canon = [];
    for (const s of SHUFFLE_SEEDS) {
      const r = await workerCall(modulePath, name, runMsg(b.id, s), BUDGET.wallMs, BUDGET.allocMb);
      canon.push(r.status === 'ok' && r.payload.compileOk ? corpus.canonOps(r.payload.ops).join('|') : `__${r.status}__`);
    }
    const orderStable = canon.every(x => x === canon[0]);
    const pass = repeatStable && orderStable;
    if (!pass) DETERMINISTIC = false;
    note('DETERMINISTIC', b.id, pass, { why: !repeatStable ? 'identical-state runs diverged' : !orderStable ? 'output depends on input order' : 'stable' });
  }

  // ---- SAFE ----------------------------------------------------------------
  let SAFE = true;
  for (const b of corpus.MALICIOUS.filter(x => x.facet === 'SAFE')) {
    const r = await workerCall(modulePath, name, runMsg(b.id, 0), BUDGET.wallMs, BUDGET.allocMb);
    let pass = true, why = 'contained';
    if (r.status !== 'ok') { pass = true; why = `run ${r.status} (contained)`; }
    else if (!r.payload.compileOk) { pass = true; why = 'rejected at compile'; }
    else {
      const p = r.payload;
      const badRead = (p.reads || []).find(rd => !readAllowed(rd, b.allowedScope.reads));
      const badWrite = (p.ops || []).find(op => !writeOpAllowed(op, b.fixture, b.allowedScope));
      if (p.canaryDirty) { pass = false; why = 'reached ambient host state (canary dirty)'; }
      else if (badRead) { pass = false; why = `read outside declared scope: ${badRead}`; }
      else if (badWrite) { pass = false; why = `wrote outside declared scope: ${JSON.stringify(badWrite)}`; }
    }
    if (!pass) SAFE = false;
    note('SAFE', b.id, pass, { why });
  }

  // ---- BOUNDED -------------------------------------------------------------
  const isSandbox = await adapterExecMode(modulePath, name) === 'sandbox';
  let BOUNDED = true;
  for (const b of corpus.MALICIOUS.filter(x => x.facet === 'BOUNDED')) {
    const r = await workerCall(modulePath, name, runMsg(b.id, 0), BUDGET.wallMs, BUDGET.allocMb);
    let containment, ok;
    if (r.status === 'timeout') containment = 'hard-killed';
    else if (r.status === 'oom') containment = 'mem-capped';
    else if (r.status === 'error') containment = 'worker-error';
    else if (!r.payload.compileOk) containment = 'compile-reject';
    else if ((r.payload.usage?.opCount ?? 0) > OP_CAP) containment = 'growth-capped';
    else containment = 'self-bounded';
    // sandbox: the harness kill/cap is the sanctioned mechanism -> any containment passes.
    // inproc: the adapter CLAIMED to self-bound -> only compile-reject / self-bounded pass.
    ok = isSandbox ? (containment !== 'worker-error')
                   : (containment === 'compile-reject' || containment === 'self-bounded');
    if (!ok) BOUNDED = false;
    note('BOUNDED', b.id, ok, { why: `${containment} (${isSandbox ? 'sandbox' : 'inproc'})` });
  }
  // real behaviors must themselves stay within budget (no cap trips)
  for (const b of corpus.REAL) {
    const r = await workerCall(modulePath, name, runMsg(b.id, 0), BUDGET.wallMs, BUDGET.allocMb);
    const within = r.status === 'ok' && r.payload.compileOk && (r.payload.usage?.opCount ?? 0) <= OP_CAP;
    if (!within) { BOUNDED = false; note('BOUNDED', b.id, false, { why: `real behavior not self-bounded (${r.status})` }); }
  }

  // ---- LOCALIZED -----------------------------------------------------------
  let LOCALIZED = true;
  for (const b of corpus.MALFORMED) {
    const r = await workerCall(modulePath, name, compileMsg(b.id), BUDGET.wallMs, BUDGET.allocMb);
    let pass = false, why = r.status;
    if (r.status === 'ok') {
      const errs = r.payload.errors;
      pass = Array.isArray(errs) && errs.length > 0 && errs.every(e =>
        e && (e.at !== undefined) && typeof e.code === 'string' && typeof e.detail === 'string' && e.detail.length > 0);
      why = r.payload.compileOk ? 'accepted malformed source (no error)' : pass ? 'localized {at,code,detail}' : 'error not localized (bare/stringless)';
    }
    if (!pass) LOCALIZED = false;
    note('LOCALIZED', b.id, pass, { why });
  }

  // ---- observesNondet (informational; RD-B2 surface, NOT in the verdict) ----
  let observesNondet = false;
  for (const b of corpus.NONDET) {
    const outs = [];
    for (let i = 0; i < DET_RUNS; i++) {
      const r = await workerCall(modulePath, name, runMsg(b.id, 0), BUDGET.wallMs, BUDGET.allocMb);
      outs.push(r.status === 'ok' && r.payload.compileOk ? JSON.stringify(r.payload.ops) : `__${r.status}__`);
    }
    if (!outs.every(x => x === outs[0])) observesNondet = true;
  }

  const admissible = EXPRESSIVE && SAFE && DETERMINISTIC && BOUNDED && LOCALIZED;
  return { name, EXPRESSIVE, SAFE, DETERMINISTIC, BOUNDED, LOCALIZED, admissible, observesNondet, detail };
}

// read an adapter's declared execMode without running it (in-process require is
// fine — the adapter MODULE is trusted; only its behaviors' SOURCES are not).
async function adapterExecMode(modulePath, name) {
  const mod = require(modulePath);
  const a = mod.adapters ? mod.adapters[name] : mod;
  return a && a.execMode;
}

// pretty matrix for humans
function formatMatrix(m) {
  const cell = (v) => v ? ' PASS ' : ' FAIL ';
  const axes = ['EXPRESSIVE', 'SAFE', 'DETERMINISTIC', 'BOUNDED', 'LOCALIZED'];
  let s = `\n${m.name}  —  ${m.admissible ? 'ADMISSIBLE' : 'INADMISSIBLE'}${m.observesNondet ? '  (observes ambient nondeterminism — RD-B2 flag)' : ''}\n`;
  s += axes.map(a => `  ${a.padEnd(14)}${cell(m[a])}`).join('\n') + '\n';
  const fails = m.detail.filter(d => d.verdict === false);
  if (fails.length) s += '  failing cases:\n' + fails.map(d => `    [${d.axis}] ${d.behavior}: ${d.why}`).join('\n') + '\n';
  return s;
}

module.exports = { scoreAdapter, formatMatrix, BUDGET, OP_CAP };

if (require.main === module) {
  const [, , mp, nm] = process.argv;
  if (!mp) { console.log('usage: node harness.js <adapterModulePath> <adapterName>'); process.exit(2); }
  scoreAdapter({ modulePath: path.resolve(mp), name: nm }).then(m => { console.log(formatMatrix(m)); process.exit(m.admissible ? 0 : 1); });
}
