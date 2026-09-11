// ADDED AFTER PRE-REGISTRATION: hand-verification helper - loads a model's file with assert
// and console neutralised and returns a named function/class from its own scope or exports.
// load a model file with assert/console neutralised; return a named binding from its own scope or its exports
module.exports = function grab(file, name) {
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(file, 'utf8') + `\n;__g(typeof ${name}!=='undefined'?${name}:null);`;
  const noop = new Proxy(function () {}, { get: () => noop, apply: () => undefined, construct: () => noop });
  const con = { log() {}, error() {}, warn() {}, info() {}, assert() {}, table() {}, debug() {} };
  const m = { exports: {} }; let got = null;
  const req = (x) => (/assert/.test(x) ? noop : require(path.resolve(path.dirname(file), x)));
  try { new Function('module', 'exports', 'require', 'console', '__g', src)(m, m.exports, req, con, (g) => { got = g; }); } catch (e) { /* its own test may throw */ }
  return got || (m.exports && m.exports[name]) || (typeof m.exports === 'function' && m.exports.name === name ? m.exports : null);
};
