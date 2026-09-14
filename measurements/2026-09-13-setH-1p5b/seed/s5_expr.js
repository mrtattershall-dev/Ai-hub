// CANONICAL REFERENCE - cumulative correct state after setH goals 5, 15, 25, 35.
// Goal 45 onward (min/max/abs functions) and goal 55 (error positions) are HELD OUT.
//
//   goal  5  + - * / with precedence, left-to-right, spaces allowed; throws on /0 and on junk
//   goal 15  parentheses and unary minus: -(2+3)*2 is -10, 2*-3 is -6
//   goal 25  ^ binds tighter than * and /, right-associative (2^3^2 is 512), -2^2 is -4
//   goal 35  evaluate(expr, vars = {}); an unknown name throws with the name in the message
//
// Recursive descent. Precedence low to high: additive -> multiplicative -> unary -> power -> atom.
// Unary sits ABOVE power so that -2^2 parses as -(2^2), which is what goal 25 requires.
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
    if (tk.t === '(') {
      eat('(');
      const v = additive();
      eat(')');
      return v;
    }
    if (tk.t === 'num') { p++; return tk.v; }
    if (tk.t === 'name') {
      p++;
      if (!Object.prototype.hasOwnProperty.call(vars, tk.v)) {
        throw new Error('unknown name ' + tk.v);
      }
      return vars[tk.v];
    }
    throw new Error('cannot parse');
  };

  // Right-associative, and its left operand is an ATOM so that -2^2 is -(2^2).
  const power = () => {
    const base = atom();
    if (peek() && peek().t === '^') {
      eat('^');
      return Math.pow(base, unary());
    }
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
      if (op === '/') {
        if (r === 0) throw new Error('division by zero');
        v /= r;
      } else v *= r;
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
