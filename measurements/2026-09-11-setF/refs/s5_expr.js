// Reference solution (final state of chain s5) - used only to prove checks-F.mjs can pass.
// Precedence, loosest first: comparisons, + -, * /, unary minus, ^ (right-associative).

function tokenize(expr) {
  const s = String(expr), out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    const rest = s.slice(i);
    const num = /^(\d+(\.\d+)?|\.\d+)/.exec(rest);
    if (num) { out.push({ type: 'num', value: Number(num[0]), pos: i }); i += num[0].length; continue; }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (name) { out.push({ type: 'name', value: name[0], pos: i }); i += name[0].length; continue; }
    const op = /^(<=|>=|==|!=|[+\-*/^<>])/.exec(rest);
    if (op) { out.push({ type: 'op', value: op[0], pos: i }); i += op[0].length; continue; }
    if (ch === '(') { out.push({ type: 'lparen', value: '(', pos: i }); i++; continue; }
    if (ch === ')') { out.push({ type: 'rparen', value: ')', pos: i }); i++; continue; }
    if (ch === ',') { out.push({ type: 'comma', value: ',', pos: i }); i++; continue; }
    throw new Error(`unexpected character '${ch}' at ${i}`);
  }
  return out;
}

function parse(expr) {
  const toks = tokenize(expr), len = String(expr).length;
  let i = 0;
  const fail = () => {
    const t = toks[i];
    throw new Error(t ? `unexpected '${t.value}' at ${t.pos}` : `unexpected end of input at ${len}`);
  };
  const isOp = (...ops) => toks[i] && toks[i].type === 'op' && ops.includes(toks[i].value);
  const isType = (type) => toks[i] && toks[i].type === type;

  function comparison() {
    let l = additive();
    while (isOp('<', '<=', '>', '>=', '==', '!=')) { const op = toks[i++].value; l = { t: 'bin', op, l, r: additive() }; }
    return l;
  }
  function additive() {
    let l = multiplicative();
    while (isOp('+', '-')) { const op = toks[i++].value; l = { t: 'bin', op, l, r: multiplicative() }; }
    return l;
  }
  function multiplicative() {
    let l = unary();
    while (isOp('*', '/')) { const op = toks[i++].value; l = { t: 'bin', op, l, r: unary() }; }
    return l;
  }
  function unary() {
    if (isOp('-')) { i++; return { t: 'neg', x: unary() }; }
    return power();
  }
  function power() {
    const base = primary();
    if (isOp('^')) { i++; return { t: 'bin', op: '^', l: base, r: unary() }; }
    return base;
  }
  function primary() {
    const t = toks[i];
    if (!t) fail();
    if (t.type === 'num') { i++; return { t: 'num', v: t.value }; }
    if (t.type === 'name') {
      i++;
      if (!isType('lparen')) return { t: 'var', n: t.value };
      i++;
      const args = [];
      if (isType('rparen')) { i++; return { t: 'call', n: t.value, args }; }
      for (;;) {
        args.push(comparison());
        if (isType('comma')) { i++; continue; }
        if (isType('rparen')) { i++; break; }
        fail();
      }
      return { t: 'call', n: t.value, args };
    }
    if (t.type === 'lparen') {
      i++;
      const e = comparison();
      if (!isType('rparen')) fail();
      i++;
      return e;
    }
    fail();
  }

  const ast = comparison();
  if (i < toks.length) fail();
  return ast;
}

function callFn(name, a) {
  if (name === 'min' || name === 'max') {
    if (!a.length) throw new Error(`${name} needs at least one argument`);
    return Math[name](...a);
  }
  if (name === 'abs' || name === 'sqrt') {
    if (a.length !== 1) throw new Error(`${name} takes exactly one argument`);
    if (name === 'sqrt' && a[0] < 0) throw new Error('sqrt of a negative number');
    return Math[name](a[0]);
  }
  throw new Error(`unknown function ${name}`);
}

function ev(n, vars) {
  switch (n.t) {
    case 'num': return n.v;
    case 'var':
      if (!vars || !Object.prototype.hasOwnProperty.call(vars, n.n)) throw new Error(`unknown variable ${n.n}`);
      return vars[n.n];
    case 'neg': return -ev(n.x, vars);
    case 'call': return callFn(n.n, n.args.map((x) => ev(x, vars)));
    default: {
      const l = ev(n.l, vars), r = ev(n.r, vars);
      switch (n.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': if (r === 0) throw new Error('division by zero'); return l / r;
        case '^': return Math.pow(l, r);
        case '<': return l < r ? 1 : 0;
        case '<=': return l <= r ? 1 : 0;
        case '>': return l > r ? 1 : 0;
        case '>=': return l >= r ? 1 : 0;
        case '==': return l === r ? 1 : 0;
        case '!=': return l !== r ? 1 : 0;
        default: throw new Error('unknown operator ' + n.op);
      }
    }
  }
}

function rpn(n) {
  switch (n.t) {
    case 'num': return [String(n.v)];
    case 'var': return [n.n];
    case 'neg': return [...rpn(n.x), 'neg'];
    case 'call': return [...n.args.flatMap(rpn), `${n.n}/${n.args.length}`];
    default: return [...rpn(n.l), ...rpn(n.r), n.op];
  }
}

function evaluate(expr, vars = {}) { return ev(parse(expr), vars); }
function toRPN(expr) { return rpn(parse(expr)); }
function compile(expr) { const ast = parse(expr); return (vars = {}) => ev(ast, vars); }

module.exports = { evaluate, tokenize, toRPN, compile };
