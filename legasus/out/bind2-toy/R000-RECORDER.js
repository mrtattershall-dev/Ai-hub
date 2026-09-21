// A synthetic subject with one site for every operator in the frozen family, and KNOWN
// answers, so the apparatus can be checked before it is pointed at a real subject.
function __legasus_clamp_impl(x) {
  let out = x;
  if (out > 10) {
    out = 10;
  } else {
    out = out + 0;
  }
  try {
    if (typeof x !== 'number') throw new TypeError('not a number');
  } catch (e) {
    return -1;
  }
  return out;
}

export function untouched(y) {
  return y * 2;
}

export function clamp(...args) {
  const __t = process.env.LEGASUS_RECORD;
  let __rec;
  try { const __r = __legasus_clamp_impl(...args); __rec = { call: globalThis.__legasus_call = (globalThis.__legasus_call || 0) + 1, x: args[0], o: JSON.stringify(__r) === undefined ? 'undefined' : JSON.stringify(__r) }; if (__t) require_append(__t, __rec); return __r; }
  catch (e) { __rec = { call: globalThis.__legasus_call = (globalThis.__legasus_call || 0) + 1, x: args[0], throw: (e && e.name) + ': ' + (e && e.message) }; if (__t) require_append(__t, __rec); throw e; }
}
function require_append(p, rec) { try { __legasus_fs.appendFileSync(p, JSON.stringify(rec) + '\n'); } catch { /* the call still happened; C4 will see the gap */ } }
import * as __legasus_fs from 'node:fs';
