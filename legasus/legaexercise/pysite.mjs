// EXECUTION SITE IDENTITY — one definition, shared by the tracer and by every denominator.
//
//     EXECUTION_IDENTITY_NONALIASING
//     Evidence belongs to the exact executable identity that produced it.
//     SIMILAR SOURCE IS NOT TRANSFERABLE AUTHORITY.
//
// This is not a new law. It is the one underneath four separate bugs this project has already paid for:
//
//     the INSTALLED packaging satisfying a claim about the CORPUS packaging
//     the `bisect` Python source satisfying a claim the C accelerator actually answered
//     a macOS platform branch being read as a source lacking authority
//     and now the module code object's `def foo(` STATEMENT satisfying a claim about a site inside foo
//
// Four manifestations, one invariant. Source coordinates describe WHERE an execution site came from; the
// executable object establishes WHAT SITE IT IS. So a witness must say "W observed SITE X", never "W
// observed line 255" - because the same physical line belongs to several different executable events.
//
// The fingerprint is derived from the executable object (its bytecode and its position), never from its
// name. Names have already misled this project once; co_qualname is carried as DESCRIPTIVE metadata so a
// human can read a site, and it is not the identity.
//
// DEFINED ONCE ON PURPOSE. A forked copy of `containsPoint` between legacore and legaverify silently
// disagreed about set membership for an entire family. Two definitions of site identity would be the same
// defect with worse consequences, because the numerator and the denominator would each be self-consistent.

// Python source fragment defining `sitefp(code)`. Both the tracer and the site-map generator embed THIS
// string, so they cannot drift.
export const FINGERPRINT_SRC = [
  'import hashlib',
  '_fpcache = {}',
  'def sitefp(code):',
  '    fp = _fpcache.get(code)',
  '    if fp is None:',
  '        raw = code.co_code + repr((code.co_firstlineno, code.co_argcount,',
  '                                   code.co_nlocals, len(code.co_consts))).encode()',
  '        fp = hashlib.sha256(raw).hexdigest()[:8]',
  '        _fpcache[code] = fp',
  '    return fp',
  'def sitekey(mod, code, line):',
  '    qual = getattr(code, "co_qualname", code.co_name)',
  '    return mod + "|" + qual + "#" + sitefp(code) + ":" + str(line)',
].join(String.fromCharCode(10));

// Parse a site key back into its parts. The line is PRESENTATION METADATA; the fingerprint is identity.
export function parseSite(key) {
  const m = /^([^|]+)\|(.*)#([0-9a-f]{8}):(\d+)$/.exec(key);
  if (!m) return null;
  return { module: m[1], qualname: m[2], fingerprint: m[3], line: Number(m[4]) };
}

export const codeIdentity = (key) => {
  const p = parseSite(key);
  return p ? p.module + '|' + p.qualname + '#' + p.fingerprint : null;
};
