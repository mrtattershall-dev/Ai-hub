'use strict';
// =============================================================================
// 037 — RULE -> ENGLISH EXPLAINER. Renders the behavior-wire grammar
// (core/behavior.js) as plain sentences so a player can read exactly what a
// rule will do BEFORE installing it, and read WHY the gate/pipeline said no.
// The human-language gap finding: the engine speaks only code language; this
// module is the translation layer. PURE — imports nothing, never throws,
// never returns undefined. Zero deps.
//
//   explainRule(source)   rule JSON (object or string) -> one/two sentences
//   explainErrors(errors) installRule/parseRule rejection array -> sentences
//   explainReason(reason) engine pipeline reason string -> friendlier sentence
// =============================================================================

const isObj = (x) => x !== null && typeof x === 'object';
const CMP_WORD = { '>': 'above', '<': 'below', '>=': 'at least', '<=': 'at most', '==': 'exactly', '!=': 'not' };
const PLURAL = { crop: 'crops', fish: 'fish', enemy: 'enemies', zone: 'zones' };
const plural = (t) => typeof t !== 'string' ? String(t)
  : PLURAL[t] ?? (t.endsWith('y') ? t.slice(0, -1) + 'ies' : t + 's');

// last-resort brace-free dump of an unrecognizable node (NEVER raw JSON).
function safeText(x) {
  try { return String(JSON.stringify(x)).replace(/[{}"]/g, '').slice(0, 60); }
  catch { return 'an unrecognized expression'; }
}

// which field-aggregation is this expr, if any? (object-arg min/max are
// aggregations; array-arg min/max are the binary clamp operators.)
function aggKind(x) {
  if (!isObj(x)) return null;
  if ('count' in x) return 'count';
  if ('sum' in x) return 'sum';
  if ('min' in x && !Array.isArray(x.min)) return 'min';
  if ('max' in x && !Array.isArray(x.max)) return 'max';
  return null;
}

// Pred = {field,cmp,value} | {all:[..]} | {any:[..]} -> "water above 0"
function predPhrase(p) {
  if (!isObj(p)) return safeText(p);
  if (Array.isArray(p.all)) return p.all.map(predPhrase).join(' and ');
  if (Array.isArray(p.any)) return p.any.map(predPhrase).join(' or ');
  return `${p.field} ${CMP_WORD[p.cmp] ?? p.cmp} ${p.value}`;
}

// count/sum/min/max aggregation spec -> "the number of crops with growth at least 100"
function aggPhrase(kind, spec) {
  if (!isObj(spec)) return safeText(spec);
  const scope = spec.of === 'children' ? ' among its children'
    : spec.of === 'subtree' ? ' anywhere under it' : '';
  const pool = `${plural(spec.type)}${spec.where ? ' with ' + predPhrase(spec.where) : ''}${scope}`;
  if (kind === 'count') return `the number of ${pool}`;
  if (kind === 'sum') return `the total ${spec.field} of ${pool}`;
  return `the ${kind === 'min' ? 'lowest' : 'highest'} ${spec.field} of ${pool}`;
}

// compositional fallback: any expr -> a readable brace-free formula.
function formula(x) {
  if (typeof x === 'number') return String(x);
  if (!isObj(x)) return safeText(x);
  const k = aggKind(x);
  if (k) return aggPhrase(k, x[k]);
  if ('field' in x) return String(x.field);
  if (Array.isArray(x.add) && x.add.length === 2) return `(${formula(x.add[0])} + ${formula(x.add[1])})`;
  if (Array.isArray(x.sub) && x.sub.length === 2) return `(${formula(x.sub[0])} - ${formula(x.sub[1])})`;
  if (Array.isArray(x.min) && x.min.length === 2) return `the smaller of ${formula(x.min[0])} and ${formula(x.min[1])}`;
  if (Array.isArray(x.max) && x.max.length === 2) return `the larger of ${formula(x.max[0])} and ${formula(x.max[1])}`;
  return safeText(x);
}

// noun-position expr: "increases its tally by <this>"
function exprNoun(x) {
  if (typeof x === 'number') return String(x);
  if (isObj(x)) {
    const k = aggKind(x);
    if (k) return aggPhrase(k, x[k]);
    if ('field' in x) return `its ${x.field}`;
  }
  return formula(x);
}

// peel the outer min/max clamps an author states for the range proof:
// {min:[inner,N]} -> capped at N, {max:[inner,N]} -> never below N.
// A clamp is a binary min/max with EXACTLY one numeric side.
function peelClamps(x) {
  let cap = null, floor = null, cur = x;
  const oneNum = (arr) => {
    if (!Array.isArray(arr) || arr.length !== 2) return null;
    if (typeof arr[0] === 'number' && typeof arr[1] !== 'number') return [arr[0], arr[1]];
    if (typeof arr[1] === 'number' && typeof arr[0] !== 'number') return [arr[1], arr[0]];
    return null;
  };
  for (let i = 0; i < 2 && isObj(cur); i++) {
    let m;
    if (cap === null && (m = oneNum(cur.min))) { cap = m[0]; cur = m[1]; continue; }
    if (floor === null && (m = oneNum(cur.max))) { floor = m[0]; cur = m[1]; continue; }
    break;
  }
  return { cap, floor, inner: cur };
}

// {set:F, to:Expr} -> clause. poss=true means the clause starts with the
// field ("water becomes 0") and needs a possessive subject.
function setClause(field, to) {
  if (field === 'name') return { poss: false, text: `is renamed to '${to}'` };
  const { cap, floor, inner } = peelClamps(to);
  const suffix = [];
  if (cap !== null) suffix.push(`capped at ${cap}`);
  if (floor !== null) suffix.push(`never below ${floor}`);
  const tail = suffix.length ? ` (${suffix.join(', ')})` : '';
  if (isObj(inner)) {
    // self-relative add/sub: "gains 5 growth" / "loses 1 water"
    const selfOther = (arr, commutes) => {
      if (!Array.isArray(arr) || arr.length !== 2) return undefined;
      if (isObj(arr[0]) && arr[0].field === field) return arr[1];
      if (commutes && isObj(arr[1]) && arr[1].field === field) return arr[0];
      return undefined;
    };
    let d = selfOther(inner.add, true);
    if (d !== undefined) return typeof d === 'number'
      ? { poss: false, text: `${d < 0 ? `loses ${-d}` : `gains ${d}`} ${field}${tail}` }
      : { poss: false, text: `increases its ${field} by ${exprNoun(d)}${tail}` };
    d = selfOther(inner.sub, false);
    if (d !== undefined) return typeof d === 'number'
      ? { poss: false, text: `${d < 0 ? `gains ${-d}` : `loses ${d}`} ${field}${tail}` }
      : { poss: false, text: `decreases its ${field} by ${exprNoun(d)}${tail}` };
    const k = aggKind(inner);
    if (k) return { poss: true, text: `${field} becomes ${aggPhrase(k, inner[k])}${tail}` };
    if ('field' in inner) return { poss: true, text: `${field} becomes its ${inner.field}${tail}` };
  }
  if (typeof inner === 'number') return { poss: true, text: `${field} becomes ${inner}${tail}` };
  return { poss: true, text: `${field} becomes ${formula(inner)}${tail}` };
}

function effectClause(ef, type) {
  if (!isObj(ef)) return { poss: false, text: `does ${safeText(ef)}` };
  if (ef.set !== undefined) return setClause(ef.set, ef.to);
  if (ef.delete) return { poss: false,
    text: type === 'crop' ? 'is harvested (removed from the world)' : 'is removed from the world' };
  if (isObj(ef.reparent)) return { poss: false, text: `is moved under '${ef.reparent.to}'` };
  if (isObj(ef.spawn)) {
    const s = ef.spawn;
    const props = isObj(s.props) ? s.props : {};
    const named = typeof props.name === 'string' ? ` named '${props.name}'` : '';
    const rest = Object.entries(props).filter(([k]) => k !== 'name')
      .map(([k, v]) => `${k} ${v}`).join(', ');
    const capTxt = Number.isInteger(s.cap) ? `, at most ${s.cap} per tick` : '';
    return { poss: false, text: `${s.type === 'crop' ? 'plants' : 'creates'} a new ${s.type}${named}${rest ? ` (${rest})` : ''}${capTxt}` };
  }
  return { poss: false, text: `has an unrecognized effect (${safeText(ef)})` };
}

// ---- explainRule ------------------------------------------------------------
function explainRule(source) {
  let rule = source;
  try {
    if (typeof source === 'string') {
      try { rule = JSON.parse(source); }
      catch { return 'this rule is not valid JSON, so it cannot be read or explained.'; }
    }
    if (!isObj(rule)) return 'this rule is empty and would do nothing.';
    const name = typeof rule.name === 'string' && rule.name ? rule.name : 'unnamed rule';
    const type = isObj(rule.match) && rule.match.type !== undefined ? rule.match.type : 'thing';
    let subj = isObj(rule.match) && rule.match.uuid !== undefined
      ? `the ${type} '${rule.match.uuid}'` : `each ${type}`;
    if (isObj(rule.match) && rule.match.where) subj += ` with ${predPhrase(rule.match.where)}`;
    const timing = Number.isInteger(rule.every) && rule.every > 1
      ? `every ${rule.every} ticks` : 'every tick';
    if (!Array.isArray(rule.effects) || !rule.effects.length)
      return `${name}: ${timing}, ${subj} is matched, but the rule has no effects, so it does nothing.`;
    let body = '';
    rule.effects.forEach((ef, i) => {
      const c = effectClause(ef, type);
      if (i === 0) body = c.poss ? `${subj}'s ${c.text}` : `${subj} ${c.text}`;
      else body += ` and ${c.poss ? `its ${c.text}` : c.text}`;
    });
    return `${name}: ${timing}, ${body}.`;
  } catch (e) {
    const nm = isObj(rule) && rule.name ? String(rule.name) : 'this rule';
    return `${nm}: could not be put into plain words (${String(e && e.message).replace(/[{}]/g, '')}).`;
  }
}

// ---- explainErrors ------------------------------------------------------------
// installRule/parseRule error shape: { rule, where, code, detail } — every gate
// code below is enumerated from core/behavior.js. Details are embedded with
// braces stripped so no raw JSON ever reaches the player.
const strip = (d) => d == null ? '' : String(d).replace(/[{}]/g, '');
const ERROR_TEMPLATES = {
  malformed_json: (e) => `the rule is not valid JSON (${strip(e.detail)}), so the gate could not even read it.`,
  missing_name: () => `the rule has no name — every rule needs one so it can be installed, versioned, or removed.`,
  unknown_type: (e) => `the rule refers to a kind of thing this world does not have (${strip(e.detail)}).`,
  bad_uuid: () => `to target one specific object, match.uuid must be that object's id (a non-empty string).`,
  target_not_live: (e) => `the specific object this rule points at is not in the world (${strip(e.detail)}), so the gate refused it.`,
  type_mismatch: (e) => `the object this rule points at is a different kind of thing than the rule says (${strip(e.detail)}).`,
  bad_period: () => `'every' must be a whole number of ticks, 1 or more.`,
  no_effects: () => `the rule has no effects — it would never do anything, so the gate refused it.`,
  bad_value: (e) => `a value in the rule is the wrong kind of thing${e.detail ? ` (${strip(e.detail)})` : ' — conditions compare against numbers'}.`,
  unknown_field: (e) => `the rule mentions a property nothing in this world has (${strip(e.detail)}).`,
  field_not_owned: (e) => `the rule touches a property that belongs to a different kind of thing (${strip(e.detail)}).`,
  range_unprovable: (e) => {
    const f = String(e.detail ?? '').split(' ')[0] || 'that property';
    return `the effect on '${f}' has no safe clamp — it could leave the property's allowed range (possibly without bound), so the gate refused it; add a min/max to state the limit.`;
  },
  bad_reparent: () => `a reparent effect must name the id of the object to move under.`,
  spawn_cap_required: () => `the spawn effect declares no per-tick cap — it could create new things without bound, so the gate refused it; declare a cap between 1 and 16.`,
  unknown_effect: () => `an effect is not one of the kinds the engine understands (set, delete, reparent, or spawn).`,
  bad_scope: (e) => `an aggregation names an unknown scope (${strip(e.detail)}) — it can look at all, children, or subtree.`,
  bad_pred: () => `a condition is malformed — it needs a property, a comparison, and a value.`,
  bad_cmp: (e) => `a comparison is not one the engine knows (${strip(e.detail)}).`,
  noninteger_const: (e) => `numbers in a rule must be whole integers (got ${strip(e.detail)}).`,
  bad_arity: (e) => `the '${strip(e.detail)}' operation needs exactly two arguments.`,
  bad_expr: (e) => `part of an expression could not be understood (${strip(e.detail)}).`,
  duplicate_name: (e) => `a rule named '${e.rule ?? ''}' is already installed — pick a different name, or explicitly replace the old one.`,
  not_installed: (e) => `no rule named '${e.rule ?? ''}' is installed, so there is nothing to remove.`,
};
function explainErrors(errors) {
  if (!Array.isArray(errors) || !errors.length) return 'the gate reported no errors.';
  return errors.map((e) => {
    if (!isObj(e)) return String(e);
    const t = ERROR_TEMPLATES[e.code];
    if (!t) return `[${e.where}] ${e.code}: ${e.detail ?? ''}`.trim(); // unknown code: verbatim
    return e.where ? `in ${e.where}: ${t(e)}` : t(e);
  }).join('\n');
}

// ---- explainReason ------------------------------------------------------------
// pipeline rejection reason families, enumerated from core/engine.js
// `reasons.push(...)`: budget / tick-budget / claim / deferred / range /
// contract / validate / note. Unknown strings pass through unchanged.
const REASONS = [
  [/^validate: cannot write (\w+) of a destroyed object/,
    (m) => `that object was already gone by the time this ran, so its ${m[1]} could not be changed.`],
  [/^validate: cannot reparent a deleted object/,
    () => `that object was already gone by the time this ran, so it could not be moved.`],
  [/^validate: target (\S+) is (\w+)/,
    (m) => `the object this pointed at (${m[1]}) is ${m[2] === 'missing' ? 'not in the world' : m[2]}, so there was nothing to act on.`],
  [/^validate: world full \(capacity (\d+)\)/,
    (m) => `the world is full — it can hold at most ${m[1]} things, so nothing new could be created.`],
  [/^validate: field '(\w+)' not valid on a (\w+)/,
    (m) => `a ${m[2]} has no '${m[1]}' property, so that write was blocked.`],
  [/^validate: reparent would create a cycle/,
    () => `that move would put a thing inside itself, so it was blocked.`],
  [/^validate: (?:new )?parent (\S+) (?:not live|is being deleted this batch)/,
    (m) => `the intended parent (${m[1]}) is not available, so nothing was placed under it.`],
  [/^claim: (\S+) held by (\S+) until tick (\d+)/,
    (m) => `${m[2]} currently holds ${m[1]} (until tick ${m[3]}), so this had to wait its turn.`],
  [/^claim: cannot claim (\S+) — target is (\w+)/,
    (m) => `${m[1]} cannot be claimed — it is ${m[2] === 'missing' ? 'not in the world' : m[2]}.`],
  [/^claim: cannot claim (\S+) — being deleted/,
    (m) => `${m[1]} cannot be claimed — it is being deleted right now.`],
  [/^claim: ticks must be a positive integer/,
    () => `a claim must last a whole positive number of ticks.`],
  [/^claim: ticks (\d+) exceeds the TTL cap (\d+)/,
    (m) => `a claim cannot be held for ${m[1]} ticks at once (the limit is ${m[2]}) — renew it while you still hold it instead.`],
  [/^budget: (\d+) ops exceeds per-tx budget (\d+)/,
    (m) => `this tried to do ${m[1]} things at once — more than the ${m[2]} allowed together — so none of it was applied.`],
  [/^tick-budget:/,
    () => `the world was too busy this tick — this did not fit the tick's work budget, so none of it was applied.`],
  [/^range: orderKey=(\S+) must be finite/,
    () => `an ordering position must be a real, finite number.`],
  [/^range: (\w+)=(\S+) outside integer range \[(-?\d+),(-?\d+)\]/,
    (m) => `${m[1]} can only be a whole number between ${m[3]} and ${m[4]}, but this tried to make it ${m[2]} — nothing was changed.`],
  [/^deferred: reparent of (\S+) contested/,
    (m) => `two actors tried to move ${m[1]} to different places at the same time — it stayed where it was, and the conflict is waiting for a person to resolve.`],
  [/^deferred: (\w+) of (\S+) contested/,
    (m) => `two actors tried to set ${m[1]} of ${m[2]} at the same time — the old value was kept, and the conflict is waiting for a person to resolve.`],
  [/^contract: (.*)/,
    (m) => `the change would have broken its own stated goal (${m[1]}), so it was rolled back.`],
  [/^note: (\d+) child\(ren\) orphaned by delete of (\S+)/,
    (m) => `deleting ${m[2]} left ${m[1]} of its children without a parent (they are still in the world).`],
];
function explainReason(reason) {
  if (typeof reason !== 'string') return String(reason);
  for (const [re, fn] of REASONS) {
    const m = reason.match(re);
    if (m) return fn(m);
  }
  return reason; // unknown family: pass through unchanged
}

module.exports = { explainRule, explainErrors, explainReason };
