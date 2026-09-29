'use strict';
// RD-003.1 / RD-007.1 — "quantized" world serialization for AI context.
//
// The goal on record: make what the AI reads (world state, files, tool defs)
// as small as possible. The SUBTLETY this card exists to expose: the LLM is
// billed and bounded in TOKENS, not bytes, and those decouple hard. We encode
// the SAME world several ways and measure BOTH, so we optimize the right axis.
//
// Token count here is a PROXY (a structural upper bound: each word, each digit,
// each punctuation mark counts as one), NOT a real BPE tokenizer — no deps.
// The proxy is applied identically to every encoding, so the COMPARISON is
// fair even though the absolute numbers aren't exact. base64 is deliberately
// included to show the byte-smallest option is a token/comprehension trap.

const N = 5000;
function ent(id) {
  return { id, type: id % 5, growth: (id * 37) % 256, water: (id * 91) % 256 };
}
const world = Array.from({ length: N }, (_, i) => ent(i));

const bytes = s => Buffer.byteLength(s, 'utf8');
// proxy tokens (vocab-AGNOSTIC): every alphanumeric run costs ceil(len/4) — so
// a random base64 blob is NOT flattered by being treated as one big "word",
// which was the bug in v1. Each punctuation char = 1 token. Still only a proxy;
// a real BPE tokenizer is needed for exact counts, but this no longer inverts
// on base64. Applied identically to every encoding.
const proxyTokens = s => {
  let t = 0;
  for (const m of s.match(/[A-Za-z0-9_]+|[^\sA-Za-z0-9]/g) || []) {
    t += /^[A-Za-z0-9_]+$/.test(m) ? Math.ceil(m.length / 4) : 1;
  }
  return t;
};

// --- A. verbose JSON (what a naive "dump the scene" would send) -------------
const A = JSON.stringify(world);

// --- B. compact JSON: short keys, ints already ------------------------------
const B = JSON.stringify(world.map(e => ({ i: e.id, t: e.type, g: e.growth, w: e.water })));

// --- C. columnar text: one line per field, values comma-joined (SoA on the
//        wire — kills per-entity key repetition entirely) ---------------------
const C = [
  'type,'   + world.map(e => e.type).join(','),
  'growth,' + world.map(e => e.growth).join(','),
  'water,'  + world.map(e => e.water).join(','),
].join('\n'); // id is implicit = row index

// --- D. binary packed -> base64 (byte-minimal, token-hostile) --------------
const buf = Buffer.alloc(N * 3); // type,growth,water as 3 bytes; id implicit
world.forEach((e, i) => { buf[i*3] = e.type; buf[i*3+1] = e.growth; buf[i*3+2] = e.water; });
const D = buf.toString('base64');

const encodings = [
  ['A verbose JSON',   A, true],
  ['B compact JSON',   B, true],
  ['C columnar text',  C, true],
  ['D base64 binary',  D, false], // legible=false: model can't reason over it
];

console.log(`=== world serialization: ${N} entities, fields {type,growth,water} (id implicit) ===\n`);
console.log('encoding'.padEnd(18), 'bytes'.padStart(9), 'proxy-tok'.padStart(11), 'B/entity'.padStart(10), 'legible'.padStart(9));
for (const [name, s, legible] of encodings) {
  console.log(name.padEnd(18), String(bytes(s)).padStart(9), String(proxyTokens(s)).padStart(11),
    (bytes(s)/N).toFixed(2).padStart(10), (legible ? 'yes' : 'NO').padStart(9));
}

console.log('\n--- the point (computed, not asserted) ---');
const byBytes = [...encodings].sort((a,b)=>bytes(a[1])-bytes(b[1]))[0][0];
const legibleOnly = encodings.filter(e => e[2]);
const bestLegibleBytes = [...legibleOnly].sort((a,b)=>bytes(a[1])-bytes(b[1]))[0];
const bestLegibleTok  = [...legibleOnly].sort((a,b)=>proxyTokens(a[1])-proxyTokens(b[1]))[0];
console.log(`byte-smallest overall: ${byBytes} — but it is base64: ILLEGIBLE to the model (decode step it can't do).`);
console.log(`so the real question is smallest among LEGIBLE encodings the model can reason over directly:`);
console.log(`  smallest legible by bytes : ${bestLegibleBytes[0]} (${bytes(bestLegibleBytes[1])} B)`);
console.log(`  smallest legible by tokens: ${bestLegibleTok[0]} (${proxyTokens(bestLegibleTok[1])} proxy-tok)`);
console.log(`columnar text wins BOTH: ~${(bytes(A)/bytes(C)).toFixed(0)}x fewer bytes and ~${(proxyTokens(A)/proxyTokens(C)).toFixed(0)}x fewer tokens than verbose JSON, still fully legible.`);
console.log(`legibility, not raw size, is what disqualifies base64 — size alone would have chosen it.`);

// --- E. the real lever: DON'T send the whole world. Send a retrieved slice. --
// Using RD-001's indexes, the AI asks a question and gets only what it needs.
const sliceIds = world.filter(e => e.type === 2 && e.growth > 200).map(e => e.id); // "ripe enemies", say
const slice = 'type,growth,water\n' + sliceIds.map(id => { const e = world[id]; return `${e.type},${e.growth},${e.water}`; }).join('\n');
console.log(`\n--- retrieval beats compression ---`);
console.log(`full columnar world: ${bytes(C)} bytes / ${proxyTokens(C)} proxy-tok`);
console.log(`retrieved slice (${sliceIds.length} matching entities): ${bytes(slice)} bytes / ${proxyTokens(slice)} proxy-tok`);
console.log(`slice is ~${(proxyTokens(C)/Math.max(1,proxyTokens(slice))).toFixed(0)}x smaller than the whole world in tokens.`);
console.log('Encoding shrinks a payload ~10x; retrieval shrinks it by whatever fraction is irrelevant — usually far more.');
