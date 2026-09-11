// neutral.cjs - preloaded with `node -r` to judge an IMPLEMENTATION without its author's own asserts.
// require('assert') (any flavour) becomes a no-op and console.assert does nothing, so a module whose
// code is right but whose self-test is wrong still loads - the "correct code, own test wrong" case.
const Module = require('module');
const orig = Module._load;
const noop = new Proxy(function () {}, { get: () => noop, apply: () => undefined, construct: () => noop });
Module._load = function (request, ...rest) {
  if (/^(node:)?assert(\/strict)?$/.test(request)) return noop;
  return orig.call(this, request, ...rest);
};
console.assert = () => {};
