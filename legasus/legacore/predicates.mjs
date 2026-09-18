// GATE 12A — BEHAVIOURAL PREDICATES.
//
// A behaviour is a guarded mapping: "when this condition holds of the input, the result is that". Both
// halves of a precedence question are behaviours - one already in the program, one requested by the
// task - and neither overlap nor precedence can be asked before they are extracted.
//
// TWO SOURCES, DELIBERATELY DIFFERENT SHAPES:
//
//   EXISTING   read from the program: `if <cond>: return <value>` inside a unit
//   REQUESTED  read from the task's delta clause: a condition and a result stated in English
//
// WHAT THIS MUST NOT DO. Per LEGASUS_V7.md the reference patch, its site, its order and its branch
// shape may not answer a precedence question. This module never sees them: it reads the SOURCE (which
// is a current program fact) and the TASK TEXT (which is the specification). It also does not use
// source order - the order predicates appear in is recorded for reporting only and is never evidence.
//
// DOMAIN REPRESENTATION. A condition is normalised to an interval or a point over one variable, which
// is enough for the comparison/equality guards this milestone claims and no more. Anything it cannot
// normalise is returned as `unmodelled` rather than guessed at, so overlap can decline to answer
// instead of inventing a domain.
const NL = String.fromCharCode(10);

// ---- numeric domains over a single variable.
// { kind: 'interval', lo, hi, loOpen, hiOpen } with -Infinity/Infinity for unbounded ends,
// { kind: 'point', value }, { kind: 'universe' }, or { kind: 'unmodelled', text }.
export function parseCondition(text) {
  const t = String(text || '').trim().replace(/^\(|\)$/g, '').trim();
  if (!t) return { kind: 'unmodelled', text: String(text || '') };

  let m = t.match(/^([A-Za-z_]\w*)\s*==\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { kind: 'point', variable: m[1], value: Number(m[2]) };

  m = t.match(/^([A-Za-z_]\w*)\s*(<=|>=|<|>)\s*(-?\d+(?:\.\d+)?)$/);
  if (m) {
    const v = Number(m[3]);
    if (m[2] === '<') return { kind: 'interval', variable: m[1], lo: -Infinity, hi: v, loOpen: true, hiOpen: true };
    if (m[2] === '<=') return { kind: 'interval', variable: m[1], lo: -Infinity, hi: v, loOpen: true, hiOpen: false };
    if (m[2] === '>') return { kind: 'interval', variable: m[1], lo: v, hi: Infinity, loOpen: true, hiOpen: true };
    return { kind: 'interval', variable: m[1], lo: v, hi: Infinity, loOpen: false, hiOpen: true };
  }

  m = t.match(/^([A-Za-z_]\w*)\s*!=\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { kind: 'complement_point', variable: m[1], value: Number(m[2]) };

  return { kind: 'unmodelled', text: t };
}

// ---- EXISTING behaviours, read from the program.
// `if <cond>: return <value>` at any depth inside a unit. The fall-through `return <value>` with no
// guard is recorded as the universe, because it applies whenever nothing above it did - which is a
// statement about the program, not about order.
export function existingBehaviours(src, unitName) {
  const lines = src.split(NL);
  const out = [];
  let inUnit = !unitName;
  let unitIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const head = raw.match(/^(\s*)def\s+(\w+)\s*\(/);
    if (head) {
      inUnit = !unitName || head[2] === unitName;
      unitIndent = head[1].length;
      continue;
    }
    if (!inUnit) continue;
    if (unitIndent >= 0 && raw.trim() && (raw.match(/^\s*/)[0].length <= unitIndent)) { inUnit = !unitName; continue; }

    const guarded = raw.match(/^\s*if\s+(.+?)\s*:\s*$/);
    if (guarded) {
      const next = lines[i + 1] || '';
      const ret = next.match(/^\s*return\s+(.+?)\s*$/);
      if (ret) out.push({ source: 'program', line: i, condition: guarded[1], domain: parseCondition(guarded[1]), result: ret[1].trim() });
      continue;
    }
    const bare = raw.match(/^\s*return\s+(.+?)\s*$/);
    if (bare && raw.match(/^\s*/)[0].length === unitIndent + 4) {
      out.push({ source: 'program', line: i, condition: null, domain: { kind: 'universe' }, result: bare[1].trim(), fallthrough: true });
    }
  }
  return out;
}

// ---- REQUESTED behaviour, read from the task's delta text.
//
// English condition forms, kept to the shapes a specification actually uses. A form this does not
// recognise yields `unmodelled` and the pipeline declines rather than guessing - the same discipline
// as an unresolved provider.
const COND_FORMS = [
  [/\b([a-z_]\w*)\s*(?:is\s+)?below\s+(-?\d+)/i, (m) => m[1] + ' < ' + m[2]],
  [/\b([a-z_]\w*)\s*(?:is\s+)?under\s+(-?\d+)/i, (m) => m[1] + ' < ' + m[2]],
  [/\b([a-z_]\w*)\s*(?:is\s+)?(?:greater than|above|over)\s+(-?\d+)/i, (m) => m[1] + ' > ' + m[2]],
  [/\b([a-z_]\w*)\s*(?:is\s+)?(?:less than)\s+(-?\d+)/i, (m) => m[1] + ' < ' + m[2]],
  [/\b([a-z_]\w*)\s*(?:is\s+)?(?:equal to|exactly)\s+(-?\d+)/i, (m) => m[1] + ' == ' + m[2]],
  [/\b([a-z_]\w*)\s*(<=|>=|<|>|==)\s*(-?\d+)/, (m) => m[1] + ' ' + m[2] + ' ' + m[3]],
];

// A specification usually names the quantity generically - "values below 10" - rather than by the
// parameter name. Binding a generic subject to the variable is a real reading capability, but it is
// only unambiguous when the unit has exactly ONE parameter. With several parameters "values" could mean
// any of them, and the honest answer is to decline rather than pick.
const GENERIC_SUBJECT = new Set(['value', 'values', 'number', 'numbers', 'input', 'inputs',
  'item', 'items', 'result', 'results', 'they', 'it', 'them']);

export function requestedBehaviour(deltaText, variable, opts) {
  const soleParameter = !!(opts && opts.soleParameter);
  const t = String(deltaText || '');
  let condition = null;
  for (const [re, build] of COND_FORMS) {
    const m = t.match(re);
    if (!m) continue;
    let expr = build(m);
    const subject = expr.split(' ')[0];
    if (variable && subject !== variable) {
      // Rebind a GENERIC subject to the sole parameter; refuse anything else.
      if (soleParameter && GENERIC_SUBJECT.has(subject.toLowerCase())) {
        expr = variable + expr.slice(subject.length);
      } else {
        continue;
      }
    }
    condition = expr;
    break;
  }
  const res = t.match(/return\s+"([^"]+)"|returns?\s+"([^"]+)"|reported as\s+"([^"]+)"|as\s+"([^"]+)"/i);
  const result = res ? '"' + (res[1] || res[2] || res[3] || res[4]) + '"' : null;
  return {
    source: 'requested_delta',
    condition,
    domain: condition ? parseCondition(condition) : { kind: 'unmodelled', text: t.slice(0, 60) },
    result,
  };
}

export { NL };
