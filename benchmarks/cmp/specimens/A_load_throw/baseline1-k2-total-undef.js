// A tiny inventory: a plain object mapping item name -> quantity. Functions never mutate their input.
function add(inv, item, qty) { const out = { ...inv }; out[item] = (out[item] || 0) + qty; return out; }
function count(inv, item) { return inv[item] || 0; }
module.exports = { add, count, remove, total };
function remove(inv, item, qty) {
  const out = { ...inv };
  if (out[item] !== undefined) {
    out[item] -= qty;
    if (out[item] <= 0) {
      delete out[item];
    }
  }
  return out;
}
