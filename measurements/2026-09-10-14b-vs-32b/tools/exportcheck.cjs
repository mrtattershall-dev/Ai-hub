// ADDED AFTER PRE-REGISTRATION (b504e8d): written and twice corrected after seeing set A
// (class goals graded on the class's methods; console stub completed with assert).
// exportcheck.cjs - for every goal worded "exporting X", is X actually EXPORTED?
//
//   node exportcheck.cjs <workspace> <goals.json>
//
// FN-MISSING only asks whether a function is DEFINED. A goal that says "exporting match(...)"
// is not met by a file that defines match but exports nothing (the 32B's t7_router.js). Graded
// identically for both models. Each file is loaded with `assert` neutralised and console muted,
// so a model's own failing self-test cannot stop us from seeing what the module exports.
const fs = require('fs'), path = require('path');
const ws = process.argv[2];
const goals = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const noop = new Proxy(function () {}, { get: () => noop, apply: () => undefined, construct: () => noop });

function exportsOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const m = { exports: {} };
  const req = (x) => (x === 'assert' || x === 'node:assert' || x === 'assert/strict' ? noop : require(path.resolve(path.dirname(file), x)));
  const timers = { setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {} };
  try {
    new Function('module', 'exports', 'require', 'console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', src)(
      // console.assert/info/table too: a model's file can self-test with console.assert, and a
      // stub without it made the 32B's u12_luhn.js fail to load - a false "NOT EXPORTED".
      m, m.exports, req, { log() {}, error() {}, warn() {}, info() {}, assert() {}, table() {}, debug() {} },
      timers.setTimeout, timers.setInterval, timers.clearTimeout, timers.clearInterval);
  } catch (e) { return { error: String(e.message).slice(0, 80), names: namesOf(m.exports), ex: m.exports }; }
  return { names: namesOf(m.exports), ex: m.exports };
}
function namesOf(ex) {
  if (typeof ex === 'function') return [ex.name || '(default function)', ...Object.keys(ex)];
  return ex && typeof ex === 'object' ? Object.keys(ex) : [];
}

for (let i = 0; i < goals.length; i++) {
  const g = goals[i];
  const m = g.match(/^Create\s+(\S+\.js)\s+exporting\s+(.+?)(?:[.,](?:\s+(?:Include|with|plus|where|that)\b)|$)/i);
  if (!m) continue;
  const file = m[1];
  // A CLASS goal ("an Inventory class with add(...)") must export the CLASS, and the named
  // methods must exist ON the class - not as separate exports (the first version of this
  // checker wanted add/remove/count exported separately, a false flag for both models).
  // A FUNCTION goal must export every named function.
  const cls = [...new Set([...m[2].matchAll(/\ban?\s+([A-Z][\w$]*)\s+class\b/g)].map((x) => x[1]))];
  const fns = [...new Set([...m[2].matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map((x) => x[1]))];
  const wanted = cls.length ? cls : fns;
  const methods = cls.length ? fns : [];
  const full = path.join(ws, file);
  if (!fs.existsSync(full)) { console.log(`goal ${String(i + 1).padStart(2)} ${file.padEnd(18)} FILE MISSING`); continue; }
  const r = exportsOf(full);
  const exported = (n) => r.names.includes(n) || (r.names[0] === n);
  const missing = wanted.filter((n) => !exported(n));
  let methodNote = '';
  if (cls.length && !missing.length) {
    const C = typeof r.ex === 'function' && (r.ex.name === cls[0]) ? r.ex : r.ex && r.ex[cls[0]];
    const absent = methods.filter((mm) => !(C && C.prototype && typeof C.prototype[mm] === 'function'));
    methodNote = absent.length ? `  METHODS MISSING ON ${cls[0]}: ${absent.join(',')}` : `  (methods on class: ok)`;
  }
  console.log(`goal ${String(i + 1).padStart(2)} ${file.padEnd(18)} wants ${JSON.stringify(wanted).padEnd(30)} exports ${JSON.stringify(r.names).padEnd(30)} ${missing.length ? 'NOT EXPORTED: ' + missing.join(',') : 'ok'}${methodNote}${r.error ? '  (load error: ' + r.error + ')' : ''}`);
}
