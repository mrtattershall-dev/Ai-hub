'use strict';
// RD-001.1 SCALING SWEEP — parametric N, JSON out, memory-safe for Modal.
// Runs the Map/Set vs CSR index comparison at one N; prints a single JSON line.
// Usage: node --expose-gc sweep.js <N> <trials>
// (memory-safe: never materialises N spec objects — spec(id) is computed inline.)

const N = parseInt(process.argv[2] || '50000', 10);
const TRIALS = parseInt(process.argv[3] || '3', 10);
const T = 5;
const hasGc = typeof global.gc === 'function';
const gc = () => { if (hasGc) { global.gc(); global.gc(); } };
const now = () => Number(process.hrtime.bigint());
const heap = () => { gc(); return process.memoryUsage().heapUsed; };
const median = (xs) => xs.slice().sort((a, b) => a - b)[xs.length >> 1];

// spec computed inline everywhere (no N-sized object array)
const specType   = (id) => id % T;
const specParent = (id) => id === 0 ? -1 : (id >> 3);
const specRef    = (id) => id % 7 === 0 ? -1 : ((id * 2654435761) >>> 0) % N;

function buildMapSet() {
  const byType = new Map(), childrenOf = new Map(), referrersOf = new Map();
  const addTo = (m, k, v) => { (m.get(k) ?? m.set(k, new Set()).get(k)).add(v); };
  for (let id = 0; id < N; id++) {
    addTo(byType, specType(id), id);
    const p = specParent(id); if (p >= 0) addTo(childrenOf, p, id);
    const r = specRef(id);    if (r >= 0) addTo(referrersOf, r, id);
  }
  return { byType, childrenOf, referrersOf };
}

function buildCSR() {
  const makeCSR = (nKeys, keyOf) => {
    const counts = new Int32Array(nKeys);
    for (let id = 0; id < N; id++) { const k = keyOf(id); if (k >= 0) counts[k]++; }
    const off = new Int32Array(nKeys + 1);
    for (let k = 0; k < nKeys; k++) off[k + 1] = off[k] + counts[k];
    const values = new Int32Array(off[nKeys]);
    const cur = off.slice(0, nKeys);
    for (let id = 0; id < N; id++) { const k = keyOf(id); if (k >= 0) values[cur[k]++] = id; }
    return { off, values };
  };
  return { byType: makeCSR(T, specType), childrenOf: makeCSR(N, specParent), referrersOf: makeCSR(N, specRef) };
}
const csrBytes = (b) => b.byType.off.byteLength + b.byType.values.byteLength
  + b.childrenOf.off.byteLength + b.childrenOf.values.byteLength
  + b.referrersOf.off.byteLength + b.referrersOf.values.byteLength;

const K = 200000; // fixed query count, independent of N
function timeReadsMap(A) {
  const runs = [];
  for (let r = 0; r < 5; r++) {
    let acc = 0; const t0 = now();
    for (let i = 0; i < K; i++) {
      const p = (i * 2654435761) >>> 0;
      const bt = A.byType.get(p % T); acc += bt ? bt.size : 0;
      const c = A.childrenOf.get(p % N); if (c) for (const v of c) acc += v;
      const rf = A.referrersOf.get((p >> 1) % N); if (rf) for (const v of rf) acc += v;
    }
    runs.push(now() - t0); if (acc < 0) console.error('x');
  }
  return median(runs) / 1e6;
}
function timeReadsCSR(B) {
  const runs = [];
  const sumCSR = (c, k) => { let s = 0; for (let i = c.off[k]; i < c.off[k + 1]; i++) s += c.values[i]; return s; };
  for (let r = 0; r < 5; r++) {
    let acc = 0; const t0 = now();
    for (let i = 0; i < K; i++) {
      const p = (i * 2654435761) >>> 0;
      acc += B.byType.off[(p % T) + 1] - B.byType.off[p % T];
      acc += sumCSR(B.childrenOf, p % N);
      acc += sumCSR(B.referrersOf, (p >> 1) % N);
    }
    runs.push(now() - t0); if (acc < 0) console.error('x');
  }
  return median(runs) / 1e6;
}

const M = 20000; // fixed mutation count
function timeWriteMap(A) {
  const addTo = (m, k, v) => { (m.get(k) ?? m.set(k, new Set()).get(k)).add(v); };
  const delFrom = (m, k, v) => { const s = m.get(k); if (s) s.delete(v); };
  const runs = [];
  for (let r = 0; r < 5; r++) {
    const t0 = now();
    for (let i = 0; i < M; i++) { const k = ((i * 2654435761) >>> 0) % N; addTo(A.childrenOf, k, N + i); delFrom(A.childrenOf, k, N + i); }
    runs.push(now() - t0);
  }
  return median(runs) / 1e6;
}
function timeCSRRebuild() {
  const runs = [];
  for (let r = 0; r < 3; r++) { const t0 = now(); buildCSR(); runs.push(now() - t0); }
  return median(runs) / 1e6;
}

// --- run TRIALS repeats, take medians ---------------------------------------
const memMap = [], memCsr = [], rMap = [], rCsr = [], wMap = [], wCsr = [];
let edges = 0;
for (let t = 0; t < TRIALS; t++) {
  gc(); const h0 = heap();
  let A = buildMapSet();
  const hA = heap(); memMap.push(hA - h0);
  if (t === 0) { edges = 0; for (const m of [A.byType, A.childrenOf, A.referrersOf]) for (const s of m.values()) edges += s.size; }
  rMap.push(timeReadsMap(A));
  wMap.push(timeWriteMap(A));
  A = null; gc();

  let B = buildCSR();
  memCsr.push(csrBytes(B));
  rCsr.push(timeReadsCSR(B));
  B = null; gc();
  wCsr.push(timeCSRRebuild());
}

const out = {
  N, trials: TRIALS, edges,
  mapSetBytes: median(memMap), csrBytes: median(memCsr),
  mapReadMs: median(rMap), csrReadMs: median(rCsr),
  mapWriteMs: median(wMap), csrRebuildMs: median(wCsr),
  node: process.version, hasGc,
};
console.log(JSON.stringify(out));
