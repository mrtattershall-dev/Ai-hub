// A tiny inventory: a plain object mapping item name -> quantity. Functions never mutate their input.
function add(inv, item, qty) { const out = { ...inv }; out[item] = (out[item] || 0) + qty; return out; }
function count(inv, item) { return inv[item] || 0; }
function remove(inv, item, qty) { if (!(item in inv)) return { ...inv }; const out = { ...inv }; out[item] -= qty;  return out; }
function total(inv) { return Object.values(inv).reduce((a, b) => a + b, 0); }
module.exports = { add, count, remove, total };
