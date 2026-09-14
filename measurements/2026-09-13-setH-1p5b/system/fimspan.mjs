// FIM SPANS. Where the hole goes, for each localizable operation.
//
// The model receives the surrounding code and fills one hole. It never receives an instruction to
// reproduce the file, which is what made the old whole-file repair gate echo its input byte for byte
// on eight of ten goals, and what let whole-file generation reach for networkx when asked to add a
// single method.
//
// Every span function returns { ok, prefix, suffix, where } or { ok: false, why }. Refusing to
// localize is a first-class outcome: an unlocalizable operation falls back to the old generation
// path rather than being guessed at.
const FENCE = String.fromCharCode(96, 96, 96);
export const FENCE_CHARS = FENCE;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --- insert a method at the end of an existing class body -------------------------------------
export function spanAddMethod(src, lang, owner, member) {
  if (lang === 'py') {
    const m = src.match(new RegExp('^class\\s+' + esc(owner) + '\\b[^\\n]*:\\s*\\n', 'm'));
    if (!m) return { ok: false, why: 'no top-level class ' + owner };
    const start = m.index + m[0].length;
    const lines = src.slice(start).split('\n');
    let last = -1;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.trim() === '') continue;
      if (/^\s/.test(l)) last = i; else break;
    }
    if (last < 0) return { ok: false, why: 'class ' + owner + ' has an empty body' };
    const cut = start + lines.slice(0, last + 1).join('\n').length;
    // origPrefix/origSuffix are the ORIGINAL bytes either side of the hole. The safety audit needs
    // them to prove nothing outside the authorized span changed; reconstructing them at the call
    // site is how that check silently becomes meaningless.
    return { ok: true, where: 'end of class ' + owner,
      prefix: src.slice(0, cut) + '\n\n    def ' + member + '(self',
      suffix: '\n' + src.slice(cut),
      origPrefix: src.slice(0, cut), origSuffix: src.slice(cut) };
  }
  const m = src.match(new RegExp('^(?:class|const|let|var)\\s+' + esc(owner) + '\\b[^\\n]*\\{', 'm'));
  if (!m) return { ok: false, why: 'no top-level declaration of ' + owner };
  let depth = 0;
  let i = m.index + m[0].length - 1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  if (depth !== 0) return { ok: false, why: 'unbalanced braces in ' + owner };
  return { ok: true, where: 'end of class ' + owner,
    prefix: src.slice(0, i) + '\n  ' + member + '(',
    suffix: '\n' + src.slice(i),
    origPrefix: src.slice(0, i), origSuffix: src.slice(i) };
}

// --- insert a module-level function ------------------------------------------------------------
// Placed BEFORE the export statement where one exists, so the new binding is in scope for it.
export function spanAddFunction(src, lang, fn) {
  // NOTE: trailing whitespace is NOT stripped. Trimming it would make the candidate fail the
  // preservation audit for bytes the model never touched - a false alarm that would look exactly
  // like the model deleting code.
  const gap = src.endsWith('\n') ? '\n' : '\n\n';
  if (lang === 'py') {
    return { ok: true, where: 'end of module',
      prefix: src + gap + 'def ' + fn + '(',
      suffix: '\n',
      origPrefix: src, origSuffix: '' };
  }
  const exp = src.match(/\n[^\n]*module\.exports\s*=/);
  if (exp) {
    const at = exp.index;
    return { ok: true, where: 'before module.exports',
      prefix: src.slice(0, at) + '\n\nfunction ' + fn + '(',
      suffix: '\n' + src.slice(at),
      origPrefix: src.slice(0, at), origSuffix: src.slice(at) };
  }
  return { ok: true, where: 'end of module',
    prefix: src + gap + 'function ' + fn + '(',
    suffix: '\n',
    origPrefix: src, origSuffix: '' };
}

// --- replace an existing member's body ---------------------------------------------------------
// Only fires when the member's span can be delimited unambiguously; otherwise it refuses, because a
// mis-cut span silently deletes working code.
export function spanReplaceMethod(src, lang, owner, member) {
  if (lang === 'py') {
    // [ \t]+ rather than \s+ : \s matches NEWLINES, so this anchored at the blank line BEFORE the
    // method and captured "newline + indent". The computed indent came out one too deep, the cut
    // collapsed to zero length, and the old body survived into the suffix - silently duplicated.
    const re = new RegExp('^([ \\t]+)def\\s+' + esc(member) + '\\s*\\(', 'm');
    const m = src.match(re);
    if (!m) return { ok: false, why: 'no def ' + member };
    const indent = m[1].length;
    const start = m.index;
    const rest = src.slice(start).split('\n');
    let end = rest.length;
    for (let i = 1; i < rest.length; i++) {
      const l = rest[i];
      if (l.trim() === '') continue;
      const ind = l.match(/^\s*/)[0].length;
      if (ind <= indent) { end = i; break; }
    }
    const cut = start + rest.slice(0, end).join('\n').length;
    return { ok: true, where: 'body of ' + member,
      prefix: src.slice(0, start) + m[1] + 'def ' + member + '(',
      suffix: '\n' + src.slice(cut) };
  }
  // Same reason as the python branch: horizontal whitespace only, never \s.
  const re = new RegExp('^([ \\t]+)(?:static\\s+)?' + esc(member) + '\\s*\\([^\\n]*\\{', 'm');
  const m = src.match(re);
  if (!m) return { ok: false, why: 'no method ' + member };
  let depth = 0;
  let i = m.index + m[0].length - 1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  if (depth !== 0) return { ok: false, why: 'unbalanced braces in ' + member };
  return { ok: true, where: 'body of ' + member,
    prefix: src.slice(0, m.index) + m[1] + member + '(',
    suffix: '\n' + src.slice(i + 1) };
}
