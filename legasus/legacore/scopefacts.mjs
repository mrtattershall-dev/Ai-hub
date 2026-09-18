// ENCLOSING-SCOPE PROVIDERS.
//
// An operation inserted into a function body may refer to that function's parameters and locals. They
// are providers — the name is available — but they are providers of a DIFFERENT KIND from a module
// binding, and the difference matters:
//
//     a module binding exists only AFTER its line, so it constrains WHERE the operation may sit
//     a parameter exists for the WHOLE body, so it constrains NOTHING
//
// Treating the second as unresolved produced a wrong account with a correct region. Treating it as a
// module binding would manufacture an ordering constraint from a name that was never unavailable. It
// needs its own state precisely because it resolves the account while narrowing nothing.
//
// SCOPE, honestly: this resolves against the operation's IMMEDIATE enclosing unit only. Closures over
// an outer function's locals are not modelled, and a name that resolves through one will remain
// UNRESOLVED - which is the correct declared-gap behaviour rather than a silent wrong answer.
const NL = String.fromCharCode(10);

// Parameter names of a `def` header, ignoring annotations and defaults.
function params(header) {
  const open = header.indexOf('(');
  const close = header.lastIndexOf(')');
  if (open < 0 || close <= open) return [];
  const out = [];
  let depth = 0;
  let slot = '';
  const flush = () => {
    const n = slot.split('=')[0].split(':')[0].replace(/[*]/g, '').trim();
    if (/^[A-Za-z_]\w*$/.test(n)) out.push(n);
    slot = '';
  };
  for (const ch of header.slice(open + 1, close)) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { flush(); continue; }
    slot += ch;
  }
  flush();
  return out;
}

// Does `sym` come from the unit whose body is `parentRange`? Returns a witnessed record or null.
//
// `parentRange` null, or covering the whole module, means the insertion is at module level and there
// is no enclosing unit - a parameter of some unrelated function is NOT in scope there, which is what
// the negative witnesses pin down.
export function scopeProviders(src, parentRange, sym) {
  if (!parentRange) return null;
  const lines = src.split(NL);

  // The unit header sits immediately above its body. If there is no `def` there, the range is not a
  // function body and nothing can be resolved by enclosing scope.
  let header = null;
  for (let i = parentRange.lo - 1; i >= 0 && i >= parentRange.lo - 2; i--) {
    if (/^\s*def\s+\w+\s*\(/.test(lines[i] || '')) { header = i; break; }
  }
  if (header === null) return null;

  if (params(lines[header]).includes(sym)) {
    return { kind: 'enclosing_scope', provider: 'parameter', line: header,
      why: 'parameter of `' + lines[header].trim().slice(0, 40) + '`',
      narrows: false,
      detail: 'a parameter is bound for the whole body, so no boundary inside the body precedes its '
        + 'availability and it imposes no ordering constraint' };
  }

  for (let i = parentRange.lo; i <= parentRange.hi && i < lines.length; i++) {
    if (new RegExp('^\\s*' + sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*=(?!=)').test(lines[i] || '')) {
      return { kind: 'enclosing_scope', provider: 'local', line: i,
        why: 'local bound at line ' + i + ' of the enclosing unit',
        narrows: false,
        detail: 'a local of the enclosing unit resolves the account. It is NOT treated as an ordering '
          + 'constraint here: this deriver does not model intra-body definite assignment, so claiming '
          + 'an ordering it cannot verify would be manufacturing information.' };
    }
  }
  return null;
}

export { NL };
