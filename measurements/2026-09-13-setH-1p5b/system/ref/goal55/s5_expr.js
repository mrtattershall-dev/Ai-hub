// POSITIVE WITNESS for probe goal55.errorpos - the canonical seed plus goal 55 and nothing else.
// Used only to prove the probe accepts a correct implementation. Never shown to the model.
//
// goal 55: every syntax error message contains 'at N', where N is the 0-based position of the first
// character that cannot be parsed, or the length of the input when it ends too early.
function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if ('+-*/^()'.includes(c)) { out.push({ t: c, at: i }); i++; continue; }
    const num = /^\d+(?:\.\d+)?/.exec(s.slice(i));
    if (num) { out.push({ t: 'num', v: Number(num[0]), at: i }); i += num[0].length; continue; }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (name) { out.push({ t: 'name', v: name[0], at: i }); i += name[0].length; continue; }
    throw new Error('cannot parse at ' + i);
  }
  return out;
}

function evaluate(expr, vars = {}) {
  const text = String(expr);
  const toks = tokenize(text);
  let p = 0;
  const peek = () => toks[p];
  // Where the failure is: the offending token's offset, or the end of input when we ran out.
  const where = () => (toks[p] ? toks[p].at : text.length);
  const bad = (what) => new Error(what + ' at ' + where());
  const eat = (t) => {
    if (!toks[p] || toks[p].t !== t) throw bad('expected ' + t);
    return toks[p++];
  };

  const atom = () => {
    const tk = peek();
    if (!tk) throw bad('unexpected end of input');
    if (tk.t === '(') { eat('('); const v = additive(); eat(')'); return v; }
    if (tk.t === 'num') { p++; return tk.v; }
    if (tk.t === 'name') {
      p++;
      if (!Object.prototype.hasOwnProperty.call(vars, tk.v)) {
        throw new Error('unknown name ' + tk.v + ' at ' + tk.at);
      }
      return vars[tk.v];
    }
    throw bad('cannot parse');
  };

  const power = () => {
    const base = atom();
    if (peek() && peek().t === '^') { eat('^'); return Math.pow(base, unary()); }
    return base;
  };
  const unary = () => {
    if (peek() && peek().t === '-') { p++; return -unary(); }
    if (peek() && peek().t === '+') { p++; return unary(); }
    return power();
  };
  const multiplicative = () => {
    let v = unary();
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = toks[p++].t;
      const r = unary();
      if (op === '/') { if (r === 0) throw new Error('division by zero'); v /= r; } else v *= r;
    }
    return v;
  };
  const additive = () => {
    let v = multiplicative();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = toks[p++].t;
      const r = multiplicative();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };

  const value = additive();
  if (p !== toks.length) throw bad('cannot parse');
  return value;
}

module.exports = { evaluate };
