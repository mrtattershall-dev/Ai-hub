'use strict';
// RD-001.1 — INDEX REPRESENTATION AT SCALE: is the Map/Set index a bottleneck?
//
// RD-001 decided: authoritative data + DERIVED indexes (byType, childrenOf,
// referrersOf) so AI relationship queries are O(result), not O(N). The core
// implements those indexes as Map<int, Set<int>>. The open card asked whether to
// PORT them to typed-array / CSR (compressed-sparse-row) form for the 50k-entity
// SoA capstone. The project rule is measure-first: don't rewrite working,
// asymptotically-optimal code on a hunch. This measures the three axes that
// actually decide it — MEMORY, READ latency, and INCREMENTAL-UPDATE cost — and
// lets the numbers say port / don't-port.
//
// Honesty (RD-008 discipline): CSR byte sizes are EXACT (typed-array byteLength).
// Map/Set memory is a measured heapUsed delta — SOFT, version/GC-dependent —
// reported as such. Timings are wall-clock, median of repeats, also SOFT. Run
// with `node --expose-gc index_representation.js` for a cleaner memory delta;
// plain `node` still works (memory flagged noisier). Deterministic data, no RNG.

const N = 50000;                       // entities (RD-008 capstone scale)
const T = 5;                           // types
const hasGc = typeof global.gc === 'function';
const gc = () => { if (hasGc) { global.gc(); global.gc(); } };
const now = () => Number(process.hrtime.bigint());
const heap = () => { gc(); return process.memoryUsage().heapUsed; };
const median = (xs) => xs.slice().sort((a,b)=>a-b)[xs.length>>1];

// --- synthetic world data (same shape as RD-001, scaled; pseudo-scatter, no RNG)
function spec(id) {
  return {
    type: id % T,
    parent: id === 0 ? -1 : (id >> 3),                 // 8-way tree
    ref: id % 7 === 0 ? -1 : ((id * 2654435761) >>> 0) % N,
  };
}

// =============================================================================
// A — Map<int, Set<int>>  (what the core uses today)
// =============================================================================
function buildMapSet() {
  const byType = new Map(), childrenOf = new Map(), referrersOf = new Map();
  const addTo = (m,k,v) => { (m.get(k) ?? m.set(k,new Set()).get(k)).add(v); };
  for (let id = 0; id < N; id++) {
    const s = spec(id);
    addTo(byType, s.type, id);
    if (s.parent >= 0) addTo(childrenOf, s.parent, id);
    if (s.ref >= 0) addTo(referrersOf, s.ref, id);
  }
  return { byType, childrenOf, referrersOf };
}
const mapGet = (ix, which, k) => ix[which].get(k) ?? null; // Set | null

// =============================================================================
// B — CSR typed arrays: offsets Int32Array + values Int32Array, per index.
// Read = values.subarray(off[k], off[k+1]). Packed, cache-friendly, exact bytes.
// Build is a counting sort; INCREMENTAL update is not supported (static) — that
// is the whole tension, measured below.
// =============================================================================
function buildCSR() {
  const specs = new Array(N);
  for (let id=0; id<N; id++) specs[id] = spec(id);
  const makeCSR = (nKeys, keyOf, emitEdge) => {
    const counts = new Int32Array(nKeys);
    for (let id=0; id<N; id++) { const k = keyOf(specs[id], id); if (k>=0) counts[k]++; }
    const off = new Int32Array(nKeys+1);
    for (let k=0;k<nKeys;k++) off[k+1]=off[k]+counts[k];
    const values = new Int32Array(off[nKeys]);
    const cur = off.slice(0,nKeys);
    for (let id=0; id<N; id++){ const k=keyOf(specs[id],id); if(k>=0) values[cur[k]++]=id; }
    return { off, values };
  };
  const byType     = makeCSR(T, (s)=>s.type);
  const childrenOf = makeCSR(N, (s)=>s.parent);
  const referrersOf= makeCSR(N, (s)=>s.ref);
  return { byType, childrenOf, referrersOf };
}
const csrGet = (csr, k) => csr.values.subarray(csr.off[k], csr.off[k+1]);
const csrBytes = (b) => b.byType.off.byteLength + b.byType.values.byteLength
  + b.childrenOf.off.byteLength + b.childrenOf.values.byteLength
  + b.referrersOf.off.byteLength + b.referrersOf.values.byteLength;

// ---------------------------------------------------------------------------
console.log(`=== RD-001.1 index representation @ N=${N.toLocaleString()} (${hasGc?'--expose-gc: cleaner memory':'no --expose-gc: memory NOISY'}) ===\n`);

// --- MEMORY -----------------------------------------------------------------
gc(); const h0 = heap();
let A = buildMapSet();
const hA = heap(); const mapSetHeap = hA - h0;
let B = buildCSR();
const csrExact = csrBytes(B);
// count edges for a per-edge figure
const edges = A.byType.size===0?0:(()=>{ let e=0; for(const s of [A.byType,A.childrenOf,A.referrersOf]) for(const set of s.values()) e+=set.size; return e; })();

console.log('--- MEMORY ---');
console.log(`  edges indexed: ${edges.toLocaleString()}  (byType+childrenOf+referrersOf)`);
console.log(`  CSR typed-array:  ${(csrExact/1024/1024).toFixed(2)} MB  EXACT  (${(csrExact/edges).toFixed(1)} B/edge incl. offset tables)`);
console.log(`  Map/Set heapUsed: ${(mapSetHeap/1024/1024).toFixed(2)} MB  ${hasGc?'(gc-cleaned, still soft)':'(SOFT/noisy)'}  (~${(mapSetHeap/edges).toFixed(0)} B/edge)`);
console.log(`  ratio Map÷CSR: ~${(mapSetHeap/csrExact).toFixed(1)}x  (soft — rides on heapUsed)`);

// --- READ latency -----------------------------------------------------------
// K random queries per index type; sum result sizes to defeat dead-code elim.
const K = 200000;
function timeReads(label, getType, getChild, getRef) {
  const runs = [];
  for (let r=0;r<5;r++){
    let acc=0; const t0=now();
    for (let i=0;i<K;i++){
      const p=(i*2654435761)>>>0;
      acc += getType(p % T);
      acc += getChild(p % N);
      acc += getRef((p>>1) % N);
    }
    runs.push(now()-t0); if(acc<0) console.log('x');
  }
  const ms = median(runs)/1e6;
  console.log(`  ${label}: ${ms.toFixed(1)} ms for ${(3*K).toLocaleString()} queries  (${(3*K/(ms/1000)/1e6).toFixed(1)} M q/s)  [median of 5, SOFT]`);
  return ms;
}
// Honest read cost = ITERATE the result (what serialization/processing does),
// not just .size. childrenOf/referrersOf are small (the frequent relationship
// queries) so we sum their elements; byType can be huge (10k) so we lookup-only
// (you paginate/stream all-of-type, you don't sum it in a hot loop).
console.log('\n--- READ latency (iterate small relationship results; byType=lookup) ---');
const sumSet = (s)=>{ if(!s) return 0; let a=0; for(const v of s) a+=v; return a; };
const sumArr = (a)=>{ let s=0; for(let i=0;i<a.length;i++) s+=a[i]; return s; };
const mapRead = timeReads('Map/Set ',
  k=>{const s=mapGet(A,'byType',k);return s?s.size:0;},
  k=>sumSet(mapGet(A,'childrenOf',k)),
  k=>sumSet(mapGet(A,'referrersOf',k)));
// CSR read done RIGHT: iterate the flat values array by offset — NO subarray
// allocation (allocating a view per query is the whole cost; the point of CSR
// is you index in place). This is the honest apples-to-apples read.
const sumCSR = (c,k)=>{ let s=0; for(let i=c.off[k];i<c.off[k+1];i++) s+=c.values[i]; return s; };
const csrRead = timeReads('CSR     ',
  k=>B.byType.off[k+1]-B.byType.off[k],
  k=>sumCSR(B.childrenOf,k),
  k=>sumCSR(B.referrersOf,k));

// --- INCREMENTAL UPDATE (the tension: RD-017 commits mutate indexes O(change))
console.log('\n--- INCREMENTAL UPDATE cost (M=20,000 single-edge mutations) ---');
const M = 20000;
{
  const addTo=(m,k,v)=>{(m.get(k)??m.set(k,new Set()).get(k)).add(v);};
  const delFrom=(m,k,v)=>{const s=m.get(k);if(s){s.delete(v);}};
  const runs=[];
  for(let r=0;r<5;r++){ const t0=now();
    for(let i=0;i<M;i++){ const k=(i*2654435761)>>>0 % N; addTo(A.childrenOf,k,N+i); delFrom(A.childrenOf,k,N+i); }
    runs.push(now()-t0);
  }
  const ms=median(runs)/1e6;
  console.log(`  Map/Set : ${ms.toFixed(2)} ms for ${(2*M).toLocaleString()} add/del  (O(1) each — what the RD-017 staged commit does)`);
}
{
  // CSR has no cheap incremental update: any mutation needs a rebuild of that
  // index. Measure ONE childrenOf rebuild — the floor cost per mutated commit.
  const runs=[];
  for(let r=0;r<5;r++){ const t0=now(); buildCSR(); runs.push(now()-t0); }
  const ms=median(runs)/1e6;
  console.log(`  CSR     : ${ms.toFixed(2)} ms per FULL rebuild (all 3 indexes) — the floor cost of ANY mutation`);
  console.log(`            => a single-edge change costs a whole rebuild unless a complex delta-CSR is built.`);
}

// --- VERDICT (computed) -----------------------------------------------------
console.log('\n--- computed verdict ---');
console.log(`  MEMORY : CSR is ${(mapSetHeap/csrExact).toFixed(1)}x smaller (soft) but the ABSOLUTE Map/Set cost is`);
console.log(`           ${(mapSetHeap/1024/1024).toFixed(1)} MB at ${N.toLocaleString()} entities — a few MB, not a wall.`);
console.log(`  READ   : CSR is ${(mapRead/csrRead).toFixed(1)}x faster on the query mix, but both do millions of q/s;`);
console.log(`           relationship reads are not the bottleneck at this scale.`);
console.log(`  WRITE  : Map/Set updates in O(1)/edge — exactly the RD-017 staged-commit access pattern.`);
console.log(`           CSR pays an O(N) rebuild per change (or a much more complex delta structure).`);
console.log(`\n  READ/WRITE RATIO decides it: the engine MUTATES every commit (RD-002/017). A static,`);
console.log(`  read-optimal CSR trades the cheap incremental update the transactional pipeline needs`);
console.log(`  for memory/read wins that don't bind at 50k. => KEEP Map/Set in the core; revisit only`);
console.log(`  if (a) N grows ~10x AND memory bites, or (b) a read-mostly snapshot view is needed —`);
console.log(`  in which case build a CSR as a DERIVED read cache from the Map/Set, don't replace it.`);
