// CHECKER FOR THE TYPED CONTRACT, with EXECUTION ISOLATION.
//
// Module exports and class members are DIFFERENT obligations and are verified differently -
// conflating them is what made 7 of 20 goals unpassable by construction.
//
//   moduleExports  the name must be reachable from the module's exports
//   members        the OWNER must be exported, and the method must exist on it
//                  (prototype for an instance method, or the object itself for a static/plain one)
//   domIds         id="..." must appear in the page
//   domClasses     the class must appear somewhere in the source (markup or the script that builds
//                  the element - a class added at runtime has no static class= attribute)
//   dead refs      every local src/href must resolve to a file that exists
//
// Each rejection path returns a DISTINCT reason, because a repair gate can only be typed if the
// checker says WHICH obligation failed rather than just "false".
//
// ---------------------------------------------------------------------------------------------
// EXECUTION CONTAMINATION - the failure class that forced this rewrite.
//
// Goal 20 of the clean baseline answered "add availability(...) to the EXISTING s10_desk.js and
// export it" with a program that REWRITES THE PROGRAM:
//
//     const fs = require('fs');
//     let data = fs.readFileSync('./s10_desk.js', 'utf8');
//     data += `\nexports.availability = (library, isbn) => { return 'available/copies'; };\n`;
//     fs.writeFileSync('./s10_desk.js', data, 'utf8');
//
// Loading it to check its exports OVERWROTE THE SPECIMEN. The preserved .bytes file was the only
// surviving ground truth. A sufficiently strange artifact could just as easily rewrite ANOTHER
// goal's file, a fixture, or the probe script itself - silently changing later results.
//
// So the canonical workspace is now NEVER executed in. Every check copies the workspace into a
// disposable sandbox, runs there under a timeout, and hashes every file before and after. Any
// mutation is reported as its own rejection kind rather than being absorbed invisibly.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const JS_PROBE = `
const path = process.argv[2];
const c = JSON.parse(process.argv[3]);
let m;
try { m = require(path); } catch (e) { console.log('LOADFAIL ' + String(e.message).split('\\n')[0]); process.exit(1); }
const resolve = (n) => {
  if (m && Object.prototype.hasOwnProperty.call(m, n)) return m[n];
  if (typeof m === 'function' && m.name === n) return m;
  return undefined;
};
const missingExports = [];
for (const n of c.moduleExports) { if (resolve(n) === undefined) missingExports.push(n); }
const missingMembers = [];
for (const mem of c.members) {
  const owner = resolve(mem.owner);
  if (owner === undefined) { missingMembers.push(mem.owner + '.' + mem.name + ' (owner not exported)'); continue; }
  const onProto = owner && owner.prototype && typeof owner.prototype[mem.name] === 'function';
  const onSelf = typeof owner[mem.name] === 'function';
  // A goal that says "a static identity(n)" is not satisfied by an instance method. Recording the
  // kind without enforcing it would let exactly the false-pass class through that this whole
  // contract rewrite exists to stop.
  if (mem.kind === 'static_method') { if (!onSelf) missingMembers.push(mem.owner + '.' + mem.name + ' (must be static)'); }
  else if (!onProto && !onSelf) missingMembers.push(mem.owner + '.' + mem.name);
}
console.log('RESULT ' + JSON.stringify({ missingExports, missingMembers,
  exported: (typeof m === 'function') ? [m.name] : Object.keys(m || {}) }));
`;

const PY_PROBE = `
import importlib.util, sys, json, inspect
path = sys.argv[1]
c = json.loads(sys.argv[2])
spec = importlib.util.spec_from_file_location("m", path)
mod = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(mod)
except Exception as e:
    print("LOADFAIL %s: %s" % (type(e).__name__, e)); sys.exit(1)
missing_exports = [n for n in c["moduleExports"] if not hasattr(mod, n)]
missing_members = []
for mem in c["members"]:
    owner = getattr(mod, mem["owner"], None)
    if owner is None:
        missing_members.append(mem["owner"] + "." + mem["name"] + " (owner not exported)"); continue
    attr = getattr(owner, mem["name"], None)
    if not callable(attr):
        missing_members.append(mem["owner"] + "." + mem["name"]); continue
    if mem.get("kind") == "static_method" and not isinstance(inspect.getattr_static(owner, mem["name"], None), (staticmethod, classmethod)):
        missing_members.append(mem["owner"] + "." + mem["name"] + " (must be static)")
print("RESULT " + json.dumps({"missingExports": missing_exports, "missingMembers": missing_members,
    "exported": sorted(n for n in dir(mod) if not n.startswith("_"))}))
`;

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

// Snapshot every file so a mutation anywhere - not just to the specimen - is visible.
function snapshot(dir) {
  const out = new Map();
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    try { if (statSync(p).isFile()) out.set(f, sha(p)); } catch (e) { /* vanished mid-scan */ }
  }
  return out;
}

function diffSnapshots(before, after) {
  const changed = [];
  const added = [];
  const removed = [];
  for (const [f, h] of before) {
    if (!after.has(f)) removed.push(f);
    else if (after.get(f) !== h) changed.push(f);
  }
  for (const f of after.keys()) if (!before.has(f)) added.push(f);
  return { changed, added, removed };
}

function sandboxOf(ws) {
  const sb = mkdtempSync(join(tmpdir(), 'sbx-'));
  for (const f of readdirSync(ws)) {
    const src = join(ws, f);
    try { if (statSync(src).isFile()) copyFileSync(src, join(sb, f)); } catch (e) { /* skip */ }
  }
  return sb;
}

function htmlContract(ws, file, c) {
  // Static text analysis only - nothing is executed, so no isolation is needed here.
  const src = readFileSync(join(ws, file), 'utf8');
  const missingIds = c.domIds.filter((id) => !new RegExp('id\\s*=\\s*["\u0027]' + id + '["\u0027]').test(src));
  const missingClasses = c.domClasses.filter((k) => !src.includes(k));
  const refs = [...src.matchAll(/(?:src|href)\s*=\s*["\u0027]([^"\u0027]+)["\u0027]/g)].map((x) => x[1])
    .filter((u) => !/^(https?:|\/\/|#|data:|mailto:)/.test(u));
  const deadRefs = [...new Set(refs.filter((u) => !existsSync(join(ws, u.split(/[?#]/)[0]))))];
  const reasons = [];
  if (missingIds.length) reasons.push({ kind: 'missing_id', items: missingIds });
  if (missingClasses.length) reasons.push({ kind: 'missing_class', items: missingClasses });
  if (deadRefs.length) reasons.push({ kind: 'dead_ref', items: deadRefs });
  return { ok: !reasons.length, loads: true, reasons, mutated: null,
    msg: reasons.map((r) => r.kind + ' ' + JSON.stringify(r.items)).join(' ') };
}

export function checkContract(ws, file, contract, opts = {}) {
  const keepSandbox = !!opts.keepSandbox;
  if (!existsSync(join(ws, file))) {
    return { ok: false, loads: false, reasons: [{ kind: 'missing_file', items: [file] }], mutated: null, msg: 'file not written' };
  }
  const lang = contract.lang;
  if (lang === 'web') return htmlContract(ws, file, contract);
  if (lang === 'md') return { ok: true, loads: true, reasons: [], mutated: null, msg: '' };

  // ---- ISOLATED EXECUTION. The canonical workspace is never the cwd of generated code.
  const sb = sandboxOf(ws);
  const isPy = lang === 'py';
  const probe = join(sb, isPy ? '_cc.py' : '_cc.js');
  writeFileSync(probe, isPy ? PY_PROBE : JS_PROBE, 'utf8');
  const before = snapshot(sb);
  const payload = JSON.stringify({ moduleExports: contract.moduleExports, members: contract.members });
  const r = spawnSync(isPy ? 'python' : process.execPath, [probe, join(sb, file), payload],
    { cwd: sb, encoding: 'utf8', timeout: 30000 });
  const after = snapshot(sb);
  // The probe writes itself before the snapshot, so it is already accounted for.
  const d = diffSnapshots(before, after);
  const touched = [...d.changed, ...d.removed, ...d.added.filter((f) => f !== '_cc.js' && f !== '_cc.py')];

  const out = (String(r.stdout || '') + String(r.stderr || '')).trim();
  const line = out.split('\n').find((l) => l.startsWith('RESULT') || l.startsWith('LOADFAIL')) || '';
  const reasons = [];
  if (touched.length) {
    reasons.push({ kind: 'execution_contamination', items: touched });
  }
  let result = null;
  if (line.startsWith('LOADFAIL')) {
    reasons.push({ kind: 'load_error', items: [line.slice(9).trim()] });
  } else if (!line.startsWith('RESULT')) {
    reasons.push({ kind: r.error && r.error.code === 'ETIMEDOUT' ? 'timeout' : 'probe_failed', items: [out.slice(0, 120)] });
  } else {
    const j = JSON.parse(line.slice(7));
    result = j;
    if (j.missingExports.length) reasons.push({ kind: 'missing_export', items: j.missingExports });
    if (j.missingMembers.length) reasons.push({ kind: 'missing_member', items: j.missingMembers });
  }
  if (!keepSandbox) { try { rmSync(sb, { recursive: true, force: true }); } catch (e) { /* fine */ } }

  return {
    ok: !reasons.length,
    loads: !!result,
    reasons,
    exported: result ? result.exported : undefined,
    mutated: touched.length ? touched : null,
    sandbox: keepSandbox ? sb : undefined,
    msg: reasons.map((x) => x.kind + ' ' + JSON.stringify(x.items)).join(' ').slice(0, 200),
  };
}
