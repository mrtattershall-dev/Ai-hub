// RE-AUDIT of the 25/43 connectivity split AND of P-A / P-B, from corrected execution identities.
//
// The predictions are NOT restated or adjusted - they were frozen in commits f895871 and 6e74d6c and are
// re-evaluated here exactly as written. What changed is the identity the evidence is keyed by: `entered`
// was module.co_name, which collapsed 26 distinct code objects in this corpus alone. A result computed on
// aliased identities is not refuted by that, but it is UNESTABLISHED until recomputed.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { FINGERPRINT_SRC, parseSite } from '../../legasus/legaexercise/pysite.mjs';
import { connectivity, supportedRegion, ROUTE } from '../../legasus/legaprogress/frontier.mjs';

const NL = String.fromCharCode(10);
const ROOT = 'benchmarks/repoB/pristine/packaging';
const ident = (q) => { const i = q.indexOf('|'); const h = q.lastIndexOf('#');
  return { module: q.slice(0, i), qualname: q.slice(i + 1, h) }; };

const DENOM = [
  'import json, os, sys, types',
  FINGERPRINT_SRC,
  'rows = {}',
  'def walk(code, qual, mod, top):',
  '    if not top:',
  '        lines = sorted({ln for (_s, _e, ln) in code.co_lines() if ln is not None})',
  '        rows[mod + "|" + qual + "#" + sitefp(code)] = [sitekey(mod, code, ln) for ln in lines]',
  '    for c in code.co_consts:',
  '        if isinstance(c, types.CodeType):',
  '            walk(c, getattr(c, "co_qualname", c.co_name), mod, False)',
  'for f in sorted(os.listdir(sys.argv[1])):',
  '    if f.endswith(".py"):',
  '        src = open(os.path.join(sys.argv[1], f), encoding="utf-8").read()',
  '        walk(compile(src, f, "exec"), "<module>", f[:-3], True)',
  'print(json.dumps(rows))',
].join(NL);

const siteMap = JSON.parse(execFileSync('python', ['-c', DENOM, ROOT],
  { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }));
const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json', 'utf8'));

// Attribute each execution to the CODE IDENTITY its docstring documents, when that identity actually ran.
const witnesses = [];
for (const r of sweep.runs) {
  const mod = r.module.replace(/\.py$/, '');
  const own = (r.enteredq || []).find((q) => {
    const p = ident(q); return p.module === mod && p.qualname === r.owner;
  });
  witnesses.push({ rootSubject: own || (mod + '|<doctest>#00000000'),
    entered: r.enteredq || [], lines: r.qlines || [], invocation: r.invocation });
}
const roots = [...new Set(witnesses.filter((w) => ident(w.rootSubject).module === 'specifiers')
  .map((w) => w.rootSubject))];

// supportedRegion namespaces on `subject.split('.')[0]`; identity keys use `|`, so the module is
// prefixed as an explicit namespace. Identity stays the authority; the namespace is descriptive.
// The entry points MUST be rekeyed the same way, or no edge can ever match and every subject falls OUT -
// which is a vacuous refusal, not a result.
const asNs = (q) => ident(q).module + '.' + q;
const PURPOSE = { identity: 'the specifier subsystem', domains: ['specifiers'],
  entryPoints: roots.map(asNs), prohibitions: [] };
const subjects = [...new Set(sweep.enteredIds)];
const connIn = connectivity(witnesses.map((w) => ({ rootSubject: asNs(w.rootSubject),
  entered: (w.entered || []).map(asNs) })));
const { supported } = supportedRegion({ purpose: PURPOSE, subjects: subjects.map(asNs), conn: connIn });

const byModule = {};
for (const s of subjects) {
  const m = ident(s).module;
  const b = byModule[m] || (byModule[m] = { total: 0, IN_DOMAIN: 0, CONNECTED: 0, OUT: 0 });
  b.total++;
  const r = supported.get(asNs(s));
  b[r === ROUTE.IN_DOMAIN ? 'IN_DOMAIN' : r === ROUTE.CONNECTED ? 'CONNECTED' : 'OUT']++;
}
console.log('RE-AUDIT 1 — the connectivity split, on code-object identities');
console.log('  module          total  IN_DOMAIN  CONNECTED   OUT');
for (const [m, c] of Object.entries(byModule).sort((a, b) => b[1].total - a[1].total)) {
  console.log('  ' + m.padEnd(14) + String(c.total).padStart(5) + String(c.IN_DOMAIN).padStart(11)
    + String(c.CONNECTED).padStart(11) + String(c.OUT).padStart(6));
}
const v = byModule.version || { CONNECTED: 0, total: 0, IN_DOMAIN: 0 };
const t = byModule.tags || { OUT: 0, total: 0 };
console.log('');
console.log('  P1 specifiers IN_DOMAIN     : '
  + ((byModule.specifiers || {}).IN_DOMAIN > 0 ? 'HELD' : 'FAILED'));
console.log('  P2 version CONNECTED, unnamed: '
  + (v.CONNECTED > 0 && v.IN_DOMAIN === 0 ? 'HELD' : 'FAILED')
  + '   ' + v.CONNECTED + '/' + v.total + '   (was 25/43 under aliased identity)');
console.log('  P3 tags NOT admitted        : ' + (t.OUT === t.total && t.total > 0 ? 'HELD' : 'FAILED')
  + '   ' + t.OUT + '/' + t.total);

// RE-AUDIT 2 — P-A and P-B, on identities rather than (module, line).
const purposeRuns = witnesses.filter((w) => ident(w.rootSubject).module === 'specifiers');
const slices = new Map();
for (const w of purposeRuns) {
  const hit = new Set(w.lines);
  for (const [fnId, keys] of Object.entries(siteMap)) {
    if (ident(fnId).module !== 'version') continue;
    const inFn = keys.filter((k) => hit.has(k));
    if (!inFn.length) continue;
    const arr = slices.get(fnId) || [];
    arr.push({ invocation: w.invocation.slice(0, 46), lines: new Set(inFn) });
    slices.set(fnId, arr);
  }
}
let full = 0; const partials = [];
for (const [fnId, runs] of slices) {
  const u = new Set(); for (const s of runs) for (const l of s.lines) u.add(l);
  const total = siteMap[fnId].length;
  if (u.size < total) partials.push({ fnId, covered: u.size, total, runs: runs.length }); else full++;
}
const divergent = [];
for (const [fnId, runs] of slices) {
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const A = runs[i].lines; const B = runs[j].lines;
      const inter = [...A].filter((l) => B.has(l)).length;
      const diff = [...A].filter((l) => !B.has(l)).length + [...B].filter((l) => !A.has(l)).length;
      if (inter && diff) { divergent.push({ fnId, a: runs[i].invocation, b: runs[j].invocation,
        shared: inter, differing: diff }); break; }
    }
    if (divergent.some((d) => d.fnId === fnId)) break;
  }
}
console.log('');
console.log('RE-AUDIT 2 — P-A / P-B, on code-object identities');
console.log('  version code objects touched by the region : ' + slices.size);
console.log('  FULLY covered                              : ' + full);
console.log('  only PARTIALLY covered                     : ' + partials.length);
partials.sort((a, b) => (a.covered / a.total) - (b.covered / b.total));
for (const p of partials.slice(0, 6)) {
  console.log('    ' + ident(p.fnId).qualname.padEnd(30) + String(p.covered).padStart(4) + '/'
    + String(p.total).padEnd(5) + p.runs + ' witnesses');
}
console.log('');
console.log('  P-A proper subset of some admitted functions : '
  + (partials.length > 0 ? 'HELD' : 'REFUTED') + '   (' + partials.length + ' partial, ' + full + ' full)');
console.log('  P-B witnesses overlap but DIFFER inside one  : '
  + (divergent.length > 0 ? 'HELD' : 'REFUTED') + '   (' + divergent.length + ' code objects)');
for (const d of divergent.slice(0, 3)) {
  console.log('    ' + ident(d.fnId).qualname + '  share ' + d.shared + ', differ ' + d.differing);
}
void parseSite;
