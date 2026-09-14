// TYPED REPAIR GATES. Built on the DEVELOPMENT set (goals 1-20) only.
//
// THE GOVERNING RULE: the repair model never receives more context than the classifier can justify.
//   * missing export        -> NO MODEL CALL AT ALL
//   * missing require       -> NO MODEL CALL AT ALL
//   * dead reference        -> a generation task for THAT file, not the broken caller
//   * missing member        -> FIM prefix/suffix around the insertion point, not the whole file
//   * anything ambiguous    -> route onward or give up; never get clever
//
// WHY DETERMINISTIC REPAIR MUST HAVE NEAR-ZERO DISCRETION: the failure this project keeps producing
// is an apparatus that agrees with itself and disagrees with the goal. A repair rule that guesses is
// the same defect wearing a different hat. So every mechanical transform states PRECONDITIONS, and
// refusing is a first-class outcome with its own fixtures - the refusals are tested as hard as the
// transforms.
//
// WHY FIM RATHER THAN WHOLE-FILE REGENERATION: Qwen2.5-Coder was trained with explicit fill-in-the-
// middle and repository objectives, and ollama exposes it (`Capabilities: insert`). The whole-file
// repair gate returned BYTE-IDENTICAL replies on 8 of 10 goals, because handing a model its own file
// back makes copying the dominant continuation. FIM asks for the missing unit instead.
import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------------------------
// CLASSIFY. Maps a checkContract result onto a repair route. One reason in, one route out.
// ---------------------------------------------------------------------------------------------
// Consulted by BOTH the router and the transform, so they cannot disagree about what is mechanical.
const NODE_BUILTINS = new Set(['assert', 'fs', 'path', 'os', 'util', 'crypto', 'events', 'url', 'http']);

export function classifyFailure(check, contract, src) {
  if (!check || check.ok) return { route: 'none', kind: null };
  const kinds = check.reasons.map((r) => r.kind);
  const of = (k) => (check.reasons.find((r) => r.kind === k) || {}).items || [];

  // An artifact that mutated the workspace is never repaired - it is quarantined. Repairing it would
  // mean re-executing code already shown to write outside itself.
  if (kinds.includes('execution_contamination')) {
    return { route: 'quarantine', kind: 'execution_contamination', items: of('execution_contamination') };
  }
  if (kinds.includes('timeout')) return { route: 'unresolved', kind: 'timeout' };

  // A dead reference is a MISSING ARTIFACT, not a defect in the file that points at it.
  if (kinds.includes('dead_ref')) {
    return { route: 'generate_artifact', kind: 'dead_ref', items: of('dead_ref') };
  }

  // `X is not defined` is a missing require ONLY when X is a Node builtin. `describe is not defined`
  // is a model that wrote a test file against a framework global - a semantic failure, not
  // bookkeeping. The route must decide this; relying on the transform to refuse would mean a route
  // whose correctness depends on the next stage saying no.
  if (kinds.includes('load_error')) {
    const msg = String(of('load_error')[0] || '');
    const m = msg.match(/^(\w+) is not defined$/);
    if (m && contract.lang === 'js' && NODE_BUILTINS.has(m[1])) {
      return { route: 'deterministic', kind: 'missing_require', items: [m[1]] };
    }
    return { route: 'localized_semantic', kind: 'load_error', items: [msg] };
  }

  if (kinds.includes('missing_export')) {
    return { route: 'deterministic', kind: 'missing_export', items: of('missing_export') };
  }
  if (kinds.includes('missing_member')) {
    return { route: 'fim_member', kind: 'missing_member', items: of('missing_member') };
  }
  if (kinds.includes('missing_id') || kinds.includes('missing_class')) {
    return { route: 'localized_semantic', kind: kinds.includes('missing_id') ? 'missing_id' : 'missing_class',
      items: [...of('missing_id'), ...of('missing_class')] };
  }
  return { route: 'unresolved', kind: kinds[0] || 'unknown' };
}

// ---------------------------------------------------------------------------------------------
// DETERMINISTIC: missing export. JS only - in Python a name that is not at module level is simply
// absent, which is a semantic failure, not a bookkeeping one.
// ---------------------------------------------------------------------------------------------

// Top-level declarations only: column 0, no indentation. Deliberately conservative.
function topLevelDecls(src, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^(?:class|function|const|let|var)\\s+' + esc + '\\b', 'gm');
  return (src.match(re) || []).length;
}

export function repairMissingExport(src, contract, missing) {
  if (contract.lang !== 'js') {
    return { ok: false, why: 'deterministic export repair is JS-only; in Python the name is simply absent' };
  }
  if (missing.length !== 1) {
    return { ok: false, why: 'expected exactly one missing export, got ' + missing.length };
  }
  const name = missing[0];
  const n = topLevelDecls(src, name);
  if (n === 0) return { ok: false, why: name + ' is not declared at top level - nothing to export' };
  if (n > 1) return { ok: false, why: name + ' has ' + n + ' top-level declarations - ambiguous' };

  // Any existing export binding for this name means the failure is NOT plain bookkeeping.
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp('(?:module\\.)?exports\\s*\\.\\s*' + esc + '\\s*=').test(src)) {
    return { ok: false, why: 'an exports.' + name + ' binding already exists - not a bookkeeping failure' };
  }
  const assign = src.match(/module\.exports\s*=\s*([\s\S]*?);/);
  if (assign) {
    const rhs = assign[1].trim();
    // Only extend a plain object literal. Anything else (a function, a spread, a call) is discretion.
    if (!/^\{[\s\S]*\}$/.test(rhs)) {
      return { ok: false, why: 'module.exports is not a plain object literal (' + rhs.slice(0, 40) + ') - refusing to rewrite' };
    }
    if (new RegExp('\\b' + esc + '\\b').test(rhs)) {
      return { ok: false, why: name + ' already appears in module.exports - the failure is elsewhere' };
    }
    const inner = rhs.slice(1, -1).trim();
    const merged = inner ? '{ ' + inner.replace(/,\s*$/, '') + ', ' + name + ' }' : '{ ' + name + ' }';
    return { ok: true, src: src.replace(assign[0], 'module.exports = ' + merged + ';'),
      how: 'merged ' + name + ' into the existing module.exports object literal' };
  }
  const nl = src.endsWith('\n') ? '' : '\n';
  return { ok: true, src: src + nl + 'module.exports = { ' + name + ' };\n',
    how: 'appended module.exports = { ' + name + ' }' };
}

// ---------------------------------------------------------------------------------------------
// DETERMINISTIC: missing require for a Node builtin the artifact calls but never imported.
// ---------------------------------------------------------------------------------------------
export function repairMissingRequire(src, contract, names) {
  if (contract.lang !== 'js') return { ok: false, why: 'require repair is JS-only' };
  if (names.length !== 1) return { ok: false, why: 'expected exactly one undefined name' };
  const name = names[0];
  if (!NODE_BUILTINS.has(name)) {
    return { ok: false, why: name + ' is not a Node builtin - an undefined name here is a semantic failure' };
  }
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp('require\\(\\s*[\'"]' + esc + '[\'"]').test(src)) {
    return { ok: false, why: name + ' is already required - the failure is elsewhere' };
  }
  if (new RegExp('^(?:const|let|var|function|class)\\s+' + esc + '\\b', 'm').test(src)) {
    return { ok: false, why: name + ' has a local binding - refusing to shadow it' };
  }
  if (!new RegExp('\\b' + esc + '\\s*[.(]').test(src)) {
    return { ok: false, why: name + ' is never used - nothing to fix' };
  }
  return { ok: true, src: 'const ' + name + ' = require(\'' + name + '\');\n' + src,
    how: 'prepended const ' + name + ' = require(\'' + name + '\')' };
}

// ---------------------------------------------------------------------------------------------
// FIM LOCALIZATION: build prefix/suffix for inserting a missing method into its owner class.
// The model sees the class it must extend and nothing else it does not need.
// ---------------------------------------------------------------------------------------------
export function fimSpanForMember(src, contract, owner, member) {
  const isPy = contract.lang === 'py';
  const esc = owner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = isPy ? new RegExp('^class\\s+' + esc + '\\b[^\\n]*:\\s*\\n', 'm')
    : new RegExp('^(?:class|const|let|var)\\s+' + esc + '\\b[^\\n]*\\{', 'm');
  const m = src.match(re);
  if (!m) return { ok: false, why: 'could not locate a top-level declaration of ' + owner };

  if (isPy) {
    // Insert at the END of the class body: the last line indented under the class.
    const start = m.index + m[0].length;
    const lines = src.slice(start).split('\n');
    let i = 0;
    let last = 0;
    for (; i < lines.length; i++) {
      const l = lines[i];
      if (l.trim() === '') continue;
      if (/^\s/.test(l)) last = i; else break;
    }
    const cut = start + lines.slice(0, last + 1).join('\n').length;
    return { ok: true, prefix: src.slice(0, cut) + '\n\n    def ' + member + '(self',
      suffix: '\n' + src.slice(cut), where: 'end of class ' + owner };
  }

  // JS: find the matching close brace of the class body, insert just before it.
  let depth = 0;
  let i = m.index + m[0].length - 1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  if (depth !== 0) return { ok: false, why: 'unbalanced braces in ' + owner };
  return { ok: true, prefix: src.slice(0, i) + '\n  ' + member + '(',
    suffix: '\n' + src.slice(i), where: 'end of class ' + owner };
}

export function loadSrc(p) { return readFileSync(p, 'utf8'); }
