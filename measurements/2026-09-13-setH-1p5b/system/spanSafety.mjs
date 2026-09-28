// SPAN SAFETY. Three checks that gate every localized operation.
//
// THE INVARIANT THIS EXISTS FOR:
//   A localized operation is not valid merely because it found the intended symbol. It must prove
//   PRESERVATION of everything outside the authorized edit span.
//
// That came out of a real bug: the python replace span used ^(\s+)def, and because \s matches
// newlines it anchored at the blank line BEFORE the method, computed an indent one level too deep,
// collapsed the cut to zero length, and left the old body sitting in the suffix - silently
// duplicated. The JS path carried the identical latent bug and passed by luck. The fixture that
// caught it asserted preservation, not "did it find the method".
//
// THE ASYMMETRY IS DELIBERATE: a false NEGATIVE costs a fallback to whole-file generation. A false
// POSITIVE surgically cuts the wrong code while looking beautifully localized. When uncertain,
// refuse. The goal is not to maximise FIM utilisation - it is to maximise verified correctness.

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- 1. SPAN VALIDITY -------------------------------------------------------------------------
// Checked BEFORE generation, from the source alone.
export function validateSpanShape(src, { op, owner, member, fn, lang }) {
  const problems = [];
  const countTop = (name, kind) => {
    const re = kind === 'py'
      ? new RegExp('^class\\s+' + esc(name) + '\\b', 'gm')
      : new RegExp('^(?:class|const|let|var|function)\\s+' + esc(name) + '\\b', 'gm');
    return (src.match(re) || []).length;
  };
  if (op === 'add_method' || op === 'replace_method') {
    const n = countTop(owner, lang);
    if (n === 0) problems.push('owner ' + owner + ' not found at top level');
    if (n > 1) problems.push('owner ' + owner + ' declared ' + n + ' times - ambiguous');
    const memRe = lang === 'py'
      ? new RegExp('^[ \\t]+def\\s+' + esc(member) + '\\s*\\(', 'gm')
      : new RegExp('^[ \\t]+(?:static\\s+)?' + esc(member) + '\\s*\\(', 'gm');
    const mCount = (src.match(memRe) || []).length;
    if (op === 'add_method' && mCount > 0) problems.push('member ' + member + ' already exists - this is not an addition');
    if (op === 'replace_method' && mCount === 0) problems.push('member ' + member + ' not found - nothing to replace');
    if (op === 'replace_method' && mCount > 1) problems.push('member ' + member + ' found ' + mCount + ' times - ambiguous');
  }
  if (op === 'add_function') {
    const n = countTop(fn, lang);
    if (n > 0) problems.push('module-level ' + fn + ' already exists - this is not an addition');
  }
  return { ok: problems.length === 0, problems };
}

// ---- 2. PRESERVATION --------------------------------------------------------------------------
// Longest common prefix/suffix. If they together cover the whole original, the change was purely an
// insertion at one point and NOTHING was deleted.
export function insertionOnly(before, after) {
  const b = String(before);
  const a = String(after);
  let p = 0;
  while (p < b.length && p < a.length && b[p] === a[p]) p++;
  let s = 0;
  while (s < b.length - p && s < a.length - p && b[b.length - 1 - s] === a[a.length - 1 - s]) s++;
  const covered = p + s;
  return {
    ok: covered >= b.length,
    deletedBytes: Math.max(0, b.length - covered),
    insertedBytes: Math.max(0, a.length - covered),
    prefixBytes: p,
    suffixBytes: s,
  };
}

// Did anything change outside the span the operation was authorised to touch?
export function outsideSpanChanged(before, after, span) {
  const pOk = after.startsWith(span.prefixOriginal);
  const sOk = after.endsWith(span.suffixOriginal);
  return { ok: pOk && sOk, prefixIntact: pOk, suffixIntact: sOk };
}

// Which top-level bindings and members existed before, and do they all still exist?
export function survivingSymbols(before, after, lang) {
  const topRe = lang === 'py' ? /^(?:class|def)\s+([A-Za-z_]\w*)/gm
    : /^(?:class|function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  const memRe = lang === 'py' ? /^[ \t]+def\s+([A-Za-z_]\w*)\s*\(/gm
    : /^[ \t]+(?:static\s+)?([A-Za-z_$][\w$]*)\s*\(/gm;
  const grab = (src, re) => {
    const out = new Set();
    let m;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(src))) out.add(m[1]);
    return out;
  };
  const beforeTop = grab(before, topRe);
  const afterTop = grab(after, topRe);
  const beforeMem = grab(before, memRe);
  const afterMem = grab(after, memRe);
  const lostTop = [...beforeTop].filter((n) => !afterTop.has(n));
  const lostMem = [...beforeMem].filter((n) => !afterMem.has(n));
  return { ok: lostTop.length === 0 && lostMem.length === 0, lostTop, lostMem };
}

// ---- 3. the full gate, applied to a candidate assembled from a span ---------------------------
export function auditLocalizedEdit({ before, after, span, op, lang }) {
  const problems = [];
  const ins = insertionOnly(before, after);
  // add_method and add_function are ZERO-DELETION operations by construction.
  if (op === 'add_method' || op === 'add_function') {
    if (!ins.ok) problems.push('deleted ' + ins.deletedBytes + ' bytes during a pure insertion');
  }
  const outside = outsideSpanChanged(before, after, span);
  if (!outside.prefixIntact) problems.push('bytes before the authorized span changed');
  if (!outside.suffixIntact) problems.push('bytes after the authorized span changed');
  const surv = survivingSymbols(before, after, lang);
  if (!surv.ok) {
    problems.push('symbols disappeared: ' + [...surv.lostTop, ...surv.lostMem].join(','));
  }
  return {
    ok: problems.length === 0,
    problems,
    metrics: {
      authorized_span_bytes: (span.prefixOriginal || '').length + (span.suffixOriginal || '').length,
      fim_output_bytes: ins.insertedBytes,
      deleted_bytes: ins.deletedBytes,
      outside_span_changed: !outside.ok,
      lost_symbols: [...surv.lostTop, ...surv.lostMem],
    },
  };
}
