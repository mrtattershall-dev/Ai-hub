'use strict';
// =============================================================================
// 037 — INTENT2: schema-driven plain-English -> ops parser. Successor to
// intent.js, whose vocabulary was farm-only by construction ("move left paddle
// down" in a live Pong world got a farm-verb refusal, 2026-07-16). This one
// derives EVERY noun and field from the snapshot's schemaDefs (RD-024 runtime
// types), so it works for any world the engine can define. No game noun and no
// field name appears in this source — the test file audits that.
//
// PURE: no I/O, no engine imports, never mutates the snapshot. The caller
// shows `say` to the human (the interpretation, BEFORE anything runs), then
// submits `ops` through the existing validated pipeline (m1_server
// sanitizeOps + engine invariants). This module never touches the world.
//
//   parse(snapshot, text[, {selected: uuid}]) -> one of
//     { kind:'ops',     ops:[...], say }            // ops in the server grammar
//     { kind:'clarify', say, options:[uuid,...] }   // ambiguous / underspecified
//     { kind:'error',   say }
//     { kind:'info',    say[, select: uuid] }       // questions; select = highlight
//
// snapshot (the generic view, m1_server snapshot()):
//   { tick, you,
//     entities:[{uuid, type, name, parent, fields:{f:value,...}}],
//     schemaDefs:[{name, fields:{f:{range:[lo,hi],...}}, spatial?:{x,y}}],
//     claims:[{uuid, holder, until}] }
// =============================================================================

const STEP = 8;                            // default nudge distance for 'move'

const dn = (e) => (e.name != null && e.name !== '' ? e.name : e.uuid);
const list = (es) => es.map(dn).join(', ');
const s = (n) => (n === 1 ? '' : 's');
const clampN = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const minBy = (es, f) => es.reduce((a, e) => (f(e) < f(a) ? e : a));
const maxBy = (es, f) => es.reduce((a, e) => (f(e) > f(a) ? e : a));
const clarify = (say, es) => ({ kind: 'clarify', say, options: es.map((e) => e.uuid) });
const err = (say) => ({ kind: 'error', say });
const info = (say) => ({ kind: 'info', say });

const Q_WORDS = new Set(['what', "what's", 'whats', 'which', 'who', "who's", 'whos', 'how']);

// ---- schema access ------------------------------------------------------------
// Everything the parser knows about the world's vocabulary comes through here.
const defs = (snap) => (Array.isArray(snap.schemaDefs) ? snap.schemaDefs : []);
const defOf = (snap, typeName) => defs(snap).find((d) => d.name === typeName) || null;
// a bare type word may arrive singular or plural: 'orb', 'orbs', 'boxes'
const defByNoun = (snap, p) =>
  defs(snap).find((d) => d.name.toLowerCase() === p) ||
  defs(snap).find((d) => `${d.name.toLowerCase()}s` === p) ||
  defs(snap).find((d) => `${d.name.toLowerCase()}es` === p) || null;
const fieldKey = (def, f) => {
  const want = String(f).toLowerCase();
  return Object.keys(def.fields).find((k) => k.toLowerCase() === want) || null;
};
const fieldList = (def) => Object.keys(def.fields).join(', ');
const typeNames = (snap) => defs(snap).map((d) => d.name).join(', ');
const rangeOf = (def, k) => {
  const r = def.fields[k] && def.fields[k].range;
  return Array.isArray(r) && r.length === 2 ? r : [-Infinity, Infinity];
};

// ---- noun-phrase resolution ---------------------------------------------------
// -> {one: entity} | {fail: <result to return verbatim>}
// Order: raw uuid verbatim; 'it'/'that'/'this' -> ctx.selected; exact name
// (case-insensitive); name prefix; bare TYPE name if exactly one entity of that
// type, else clarify listing them. The whole phrase is matched at once, so
// multi-word names win naturally (longest match = the full phrase).
function resolve(snap, phrase, ctx, verb) {
  const es = Array.isArray(snap.entities) ? snap.entities : [];
  const rawP = String(phrase == null ? '' : phrase).trim();
  const orig = rawP.replace(/^(?:the|a|an|some)\s+/i, '');
  const p = orig.toLowerCase();
  if (!p) {
    return { fail: es.length
      ? clarify(`${verb} what? there ${es.length === 1 ? 'is' : 'are'} ${es.length}: ${list(es)}`, es)
      : err('there is nothing in this world yet') };
  }
  const byUuid = es.find((e) => e.uuid === orig || e.uuid === rawP);
  if (byUuid) return { one: byUuid };

  if (/^(?:it|that|this)(?:\s+one)?$/.test(p)) {
    if (!ctx.selected)
      return { fail: clarify(`which one do you mean by '${p}'? nothing is selected — here: ${list(es) || 'nothing'}`, es) };
    const sel = es.find((e) => e.uuid === ctx.selected);
    return sel ? { one: sel } : { fail: err('the selected entity no longer exists') };
  }

  if (!es.length) return { fail: err('there is nothing in this world yet') };

  const exact = es.filter((e) => String(e.name || '').toLowerCase() === p);
  if (exact.length === 1) return { one: exact[0] };
  if (exact.length > 1)
    return { fail: clarify(`which '${orig}'? there are ${exact.length}: ${list(exact)}`, exact) };

  const pref = es.filter((e) => String(e.name || '').toLowerCase().startsWith(p));
  if (pref.length === 1) return { one: pref[0] };
  if (pref.length > 1)
    return { fail: clarify(`'${orig}' matches ${pref.length}: ${list(pref)}`, pref) };

  const def = defByNoun(snap, p);
  if (def) {
    const set = es.filter((e) => e.type === def.name);
    if (set.length === 1) return { one: set[0] };
    if (set.length > 1)
      return { fail: clarify(`which ${def.name}? there are ${set.length}: ${list(set)}`, set) };
    return { fail: err(`there are no ${def.name} entities right now`) };
  }
  return { fail: err(`I can't find anything called '${orig}' — here: ${list(es)}`) };
}

// ---- verbs ----------------------------------------------------------------------
// move <noun> up|down|left|right [by N] — only for types that declare spatial.
// Screen convention: up = the spatial y field DEcreases, left = x decreases.
function doMove(snap, rest, ctx) {
  const m = rest.match(/^(.+?)\s+(up|down|left|right)(?:\s+by\s+(\d+))?$/i);
  if (!m) return err("move what where? try: move <thing> up|down|left|right [by N]");
  const r = resolve(snap, m[1], ctx, 'move');
  if (r.fail) return r.fail;
  const e = r.one, def = defOf(snap, e.type);
  if (!def || !def.spatial)
    return err(`${dn(e)} is a ${e.type} — the ${e.type} type declares no coordinates, so it can't be moved`);
  const dir = m[2].toLowerCase();
  const step = m[3] ? +m[3] : STEP;
  const axis = dir === 'up' || dir === 'down' ? 'y' : 'x';
  const f = def.spatial[axis];
  const sign = dir === 'down' || dir === 'right' ? 1 : -1;
  const [lo, hi] = rangeOf(def, f);
  const old = e.fields[f];
  const want = old + sign * step;
  const v = clampN(want, lo, hi);
  const note = v !== want ? ` (clamped to ${lo}..${hi})` : '';
  return { kind: 'ops', ops: [{ kind: 'setfield', target: e.uuid, field: f, value: v }],
    say: `moving ${dn(e)} ${dir} — ${f} ${old} → ${v}${note}` };
}

// set <noun>['s] <field> to N / set <field> to N on <noun> / <noun>'s <field> = N
function doSet(snap, rest, ctx) {
  let m, noun, field, valueRaw;
  if ((m = rest.match(/^(\S+)\s+(?:to\s+|=\s*)(.+?)\s+(?:on|of|for)\s+(.+)$/i))) {
    field = m[1]; valueRaw = m[2]; noun = m[3];
  } else if ((m = rest.match(/^(.+?)'s\s+(\S+)\s+(?:to\s+|=\s*)(.+)$/i))) {
    noun = m[1]; field = m[2]; valueRaw = m[3];
  } else if ((m = rest.match(/^(.+?)\s+(\S+)\s+(?:to\s+|=\s*)(.+)$/i))) {
    noun = m[1]; field = m[2]; valueRaw = m[3];
  } else {
    return err("set what? try: set <thing>'s <field> to <number>, or set <field> to <number> on <thing>");
  }
  const r = resolve(snap, noun, ctx, 'set');
  if (r.fail) return r.fail;
  const e = r.one;
  if (String(field).toLowerCase() === 'name') {
    const name = valueRaw.trim();
    return { kind: 'ops', ops: [{ kind: 'setfield', target: e.uuid, field: 'name', value: name }],
      say: `renaming ${dn(e)} to "${name}"` };
  }
  const def = defOf(snap, e.type);
  const k = def && fieldKey(def, field);
  if (!k)
    return err(`${e.type} has no field '${field}' — its fields are: ${def ? fieldList(def) : 'unknown'}`);
  const n = Number(valueRaw.trim());
  const [lo, hi] = rangeOf(def, k);
  if (!Number.isFinite(n)) return err(`'${valueRaw.trim()}' isn't a number — ${k} takes ${lo}..${hi}`);
  const v = clampN(Math.round(n), lo, hi);
  const clamped = v !== Math.round(n);
  return { kind: 'ops', ops: [{ kind: 'setfield', target: e.uuid, field: k, value: v }],
    say: `setting ${dn(e)}'s ${k} to ${v} (was ${e.fields[k]})${clamped ? ` — clamped to ${lo}..${hi}` : ''}` };
}

function doSelect(snap, rest, ctx) {
  const r = resolve(snap, rest, ctx, 'select');
  if (r.fail) return r.fail;
  const e = r.one, def = defOf(snap, e.type);
  const keys = def ? Object.keys(def.fields).filter((k) => k in (e.fields || {})) : Object.keys(e.fields || {});
  return { kind: 'info', select: e.uuid,
    say: `selected ${dn(e)} (${e.type}: ${keys.map((k) => `${k} ${e.fields[k]}`).join(', ') || 'no fields'})` };
}

// create|spawn|add a <type> [named <name>] [at X,Y] — createChild, parent null,
// coords land on the type's own declared spatial field names.
function doCreate(snap, rest) {
  let w = String(rest || '').trim().replace(/^(?:a|an|the|some)\s+/i, '');
  if (!w) return err(`create what? this world's types: ${typeNames(snap) || 'none'}`);
  let coords = null, name = null, mm;
  if ((mm = w.match(/\s+at\s+(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/i))) {
    coords = [Number(mm[1]), Number(mm[2])];
    w = w.slice(0, mm.index);
  }
  if ((mm = w.match(/\s+(?:named|called)\s+(.+)$/i))) {      // name keeps its case
    name = mm[1].trim();
    w = w.slice(0, mm.index);
  }
  const tword = w.trim();
  const def = defByNoun(snap, tword.toLowerCase());
  if (!def) return err(`no type called '${tword}' — this world's types: ${typeNames(snap) || 'none'}`);
  const props = {};
  if (name) props.name = name;
  if (coords) {
    if (!def.spatial)
      return err(`${def.name} declares no coordinates — create it without 'at X,Y'`);
    const fx = def.spatial.x, fy = def.spatial.y;
    const [xlo, xhi] = rangeOf(def, fx), [ylo, yhi] = rangeOf(def, fy);
    props[fx] = clampN(Math.round(coords[0]), xlo, xhi);
    props[fy] = clampN(Math.round(coords[1]), ylo, yhi);
  }
  const at = coords ? ` at ${props[def.spatial.x]},${props[def.spatial.y]}` : '';
  return { kind: 'ops', ops: [{ kind: 'createChild', type: def.name, parent: null, props }],
    say: `creating a ${def.name}${name ? ` named "${name}"` : ''}${at}` };
}

function doDelete(snap, rest, ctx) {
  const r = resolve(snap, rest, ctx, 'delete');
  if (r.fail) return r.fail;
  const e = r.one;
  return { kind: 'ops', ops: [{ kind: 'delete', target: e.uuid }],
    say: `deleting ${dn(e)} (a ${e.type}) — this is permanent and cannot be undone` };
}

function doRename(snap, restWords, ctx) {
  const lowW = restWords.map((w) => w.toLowerCase());
  let i = lowW.indexOf('to');
  if (i < 0) i = lowW.indexOf('as');
  if (i < 1 || i === restWords.length - 1)
    return err('rename what to what? try: rename <thing> to <new name>');
  const r = resolve(snap, restWords.slice(0, i).join(' '), ctx, 'rename');
  if (r.fail) return r.fail;
  const name = restWords.slice(i + 1).join(' ');             // original case preserved
  return { kind: 'ops', ops: [{ kind: 'setfield', target: r.one.uuid, field: 'name', value: name }],
    say: `renaming ${dn(r.one)} to "${name}"` };
}

// ---- read-only questions ---------------------------------------------------------
function question(snap, qRaw, ctx = {}) {
  const q = qRaw.replace(/^(?:check|show|inspect)\s+/, '');
  const es = Array.isArray(snap.entities) ? snap.entities : [];
  if (/what\s+(?:types|kinds)\b|what\s+can\s+i\s+(?:make|create|spawn|add|build)/.test(q)) {
    if (!defs(snap).length) return info('this world declares no types');
    return info(`types in this world: ${defs(snap).map((d) => `${d.name} (${fieldList(d)})`).join('; ')}`);
  }
  let m;
  if ((m = q.match(/how\s+many\s+(.+?)(?:\s+are\s+there)?$/))) {
    const noun = m[1].replace(/^the\s+/, '');
    const def = defByNoun(snap, noun);
    if (!def) return err(`no type called '${noun}' — this world's types: ${typeNames(snap) || 'none'}`);
    const set = es.filter((e) => e.type === def.name);
    return info(`there ${set.length === 1 ? 'is' : 'are'} ${set.length} ${def.name}${s(set.length)}${set.length ? `: ${list(set)}` : ''}`);
  }
  if ((m = q.match(/who\s+has\s+the\s+(most|least)\s+(\S+)/))) {
    const dir = m[1], f = m[2];
    const owners = defs(snap).filter((d) => fieldKey(d, f));
    if (!owners.length)
      return err(`no type here has a field '${f}' — types: ${defs(snap).map((d) => `${d.name} (${fieldList(d)})`).join('; ')}`);
    const ownNames = new Set(owners.map((d) => d.name));
    const pool = es.filter((e) => ownNames.has(e.type));
    if (!pool.length) return err(`nothing with a '${f}' field exists right now`);
    const key = (e) => e.fields[fieldKey(defOf(snap, e.type), f)];
    const win = dir === 'most' ? maxBy(pool, key) : minBy(pool, key);
    return info(`${dn(win)} (a ${win.type}) has the ${dir} ${f}: ${key(win)}`);
  }
  if ((m = q.match(/^(?:what(?:'s|s| is)?\s+)?(.+?)'s\s+(\S+)$/))) {
    const r = resolve(snap, m[1], ctx, 'check');
    if (r.fail) return r.fail;
    const e = r.one, def = defOf(snap, e.type);
    const k = def && fieldKey(def, m[2]);
    if (!k)
      return err(`${e.type} has no field '${m[2]}' — its fields are: ${def ? fieldList(def) : 'unknown'}`);
    return info(`${dn(e)}'s ${k} is ${e.fields[k]}`);
  }
  return err("I can't answer that — try: what is <thing>'s <field>, how many <type>s are there, who has the most <field>, or what types are there");
}

// ---- entry --------------------------------------------------------------------------
function parse(snapshot, text, ctx = {}) {
  const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const raw = String(text == null ? '' : text).trim().replace(/\s+/g, ' ');
  const t = raw.replace(/[?!.]+$/, '').trim();
  if (!t)
    return err("say something — try: move <thing> up|down|left|right, set <thing>'s <field> to N, select <thing>, create a <type>, delete <thing>, rename <thing> to <name>, or ask a question");
  let words = t.split(' ');
  // strip leading politeness/filler so 'please move it up' still parses
  while (words.length > 1 && /^(?:please|can|could|would|you|just|now|hey|go)$/i.test(words[0])) words = words.slice(1);
  const low = words.map((w) => w.toLowerCase());
  const rest = words.slice(1).join(' ');
  const v = low[0];
  if (/^(?:move|nudge|shift|slide)$/.test(v)) return doMove(snap, rest, ctx);
  if (/^(?:set|change|make|adjust)$/.test(v)) return doSet(snap, rest, ctx);
  if (/^(?:select|choose|focus|highlight)$/.test(v)) return doSelect(snap, rest, ctx);
  if (/^(?:create|spawn|add)$/.test(v)) return doCreate(snap, rest);
  if (/^(?:delete|remove|destroy|kill)$/.test(v)) return doDelete(snap, rest, ctx);
  if (/^(?:rename|call)$/.test(v)) return doRename(snap, words.slice(1), ctx);
  if (/^(?:check|show|inspect)$/.test(v)) return question(snap, t.toLowerCase(), ctx);
  if (Q_WORDS.has(v) || /\?\s*$/.test(raw)) return question(snap, t.toLowerCase(), ctx);
  // bare possessive assignment: <noun>'s <field> = N
  if (/^.+?'s\s+\S+\s*=/.test(t)) return doSet(snap, t, ctx);
  return err(`I don't understand '${words[0]}' — try: move, set, select, create, delete, rename, or ask a question (what / how many / who has)`);
}

module.exports = { parse };
