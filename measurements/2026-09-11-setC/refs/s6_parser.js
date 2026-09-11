// Reference solution (final state of chain 6) - used only to prove checks-C.mjs can pass.
function tokenize(expr) {
  const out = []; const s = String(expr); let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const t = s.slice(i, j); if (!/^(\d+(\.\d+)?|\.\d+)$/.test(t)) throw new Error('bad number: ' + t);
      out.push({ type: 'num', value: parseFloat(t) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(ch)) { let j = i; while (j < s.length && /[A-Za-z_0-9]/.test(s[j])) j++; out.push({ type: 'id', value: s.slice(i, j) }); i = j; continue; }
    if ('+-*/()^'.includes(ch)) { out.push({ type: 'op', value: ch }); i++; continue; }
    throw new Error('unexpected character: ' + ch);
  }
  return out;
}
function evaluate(expr, vars = {}) {
  const t = tokenize(expr); let p = 0;
  const peek = () => t[p]; const next = () => t[p++];
  const is = (v) => peek() && peek().type === 'op' && peek().value === v;
  function primary() {
    const x = next(); if (!x) throw new Error('unexpected end of expression');
    if (x.type === 'num') return x.value;
    if (x.type === 'id') { if (!Object.prototype.hasOwnProperty.call(vars, x.value)) throw new Error('unknown variable: ' + x.value); return vars[x.value]; }
    if (x.value === '(') { const v = sum(); if (!is(')')) throw new Error('missing )'); next(); return v; }
    throw new Error('unexpected ' + x.value);
  }
  function power() { const b = primary(); if (is('^')) { next(); return b ** unary(); } return b; }
  function unary() { if (is('-')) { next(); return -unary(); } if (is('+')) { next(); return unary(); } return power(); }
  function product() { let v = unary(); while (is('*') || is('/')) { const op = next().value; const r = unary(); if (op === '/' && r === 0) throw new Error('division by zero'); v = op === '*' ? v * r : v / r; } return v; }
  function sum() { let v = product(); while (is('+') || is('-')) { const op = next().value; const r = product(); v = op === '+' ? v + r : v - r; } return v; }
  const v = sum(); if (p !== t.length) throw new Error('unexpected ' + t[p].value); return v;
}
module.exports = { tokenize, evaluate };
