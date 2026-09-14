// POSITIVE WITNESS for probe goal45.functions - the canonical seed plus goal 45 and nothing else.
// Used only to prove the probe accepts a correct implementation. Never shown to the model.
const FUNCS = {
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  abs: (a) => Math.abs(a),
  sqrt: (a) => Math.sqrt(a),
};

function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if ('+-*/^(),'.includes(c)) { out.push({ t: c, at: i }); i++; continue; }
    const num = /^\d+(?:\.\d+)?/.exec(s.slice(i));
    if (num) { out.push({ t: 'num', v: Number(num[0]), at: i }); i += num[0].length; continue; }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (name) { out.push({ t: 'name', v: name[0], at: i }); i += name[0].length; continue; }
    throw new Error('cannot parse at ' + i);
  }
  return out;
}

function evaluate(expr, vars = {}) {
  const toks = tokenize(String(expr));
  let p = 0;
  const peek = () => toks[p];
  const eat = (t) => {
    if (!toks[p] || toks[p].t !== t) throw new Error('expected ' + t);
    return toks[p++];
  };

  const atom = () => {
    const tk = peek();
    if (!tk) throw new Error('unexpected end of input');
    if (tk.t === '(') { eat('('); const v = additive(); eat(')'); return v; }
    if (tk.t === 'num') { p++; return tk.v; }
    if (tk.t === 'name') {
      p++;
      // goal 45: a name followed by '(' is a function call with one or more arguments.
      if (peek() && peek().t === '(') {
        const fn = FUNCS[tk.v];
        if (!fn) throw new Error('unknown function ' + tk.v);
        eat('(');
        const args = [additive()];
        while (peek() && peek().t === ',') { eat(','); args.push(additive()); }
        eat(')');
        return fn(...args);
      }
      if (!Object.prototype.hasOwnProperty.call(vars, tk.v)) throw new Error('unknown name ' + tk.v);
      return vars[tk.v];
    }
    throw new Error('cannot parse');
  };

  const power = () => {
    const base = atom();
    if (peek() && peek().t === '^') { eat('^'); return Math.pow(base, unary()); }
    return base;
  };
  const unary = () => {
    if (peek() && peek().t === '-') { eat('-'); return -unary(); }
    if (peek() && peek().t === '+') { eat('+'); return unary(); }
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
  if (p !== toks.length) throw new Error('cannot parse');
  return value;
}

module.exports = { evaluate };
