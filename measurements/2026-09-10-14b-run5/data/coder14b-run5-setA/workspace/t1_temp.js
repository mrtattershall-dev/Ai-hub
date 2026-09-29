function cToF(c) { return (c * 9/5) + 32; }
function fToC(f) { return (f - 32) * 5/9; }

module.exports = { cToF, fToC };
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

const c = 100; const f = 212;
assert(cToF(c) === f, 'cToF(c) -> f');
assert(fToC(f) === c, 'fToC(f) -> c');

console.log('t1/temp OK');
