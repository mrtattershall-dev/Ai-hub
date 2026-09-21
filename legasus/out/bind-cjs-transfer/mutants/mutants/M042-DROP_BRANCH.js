'use strict';
// =============================================================================
// 037 — INTENT: deterministic plain-English -> ops parser. The NL half of the
// ai-native editor ("engine only speaks code language" finding, 2026-07-16).
// PURE: no I/O, no engine imports, no mutation of the snapshot. The caller
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
// snapshot: { tick, zone, tally, you,
//             crops:[{uuid, name, displayName?, water, growth}],
//             claims:[{uuid, holder, until}] }
// =============================================================================

const OPS_CAP = 32;                       // sanitizeOps rejects > 32 ops per submission
const RIPE = 100, DRY = 25;               // homestead: ripe at growth>=100; dry = below the water-25 planting default
const WATER_TO = 200, CLAIM_TICKS = 40, PLANT_WATER = 25, PLANT_GROWTH = 0;

const dn = (c) => c.displayName || c.name || c.uuid;
const list = (cs) => cs.map(dn).join(', ');
const s = (arr) => (arr.length === 1 ? '' : 's');
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const minBy = (cs, f) => cs.reduce((a, c) => (f(c) < f(a) ? c : a));
const maxBy = (cs, f) => cs.reduce((a, c) => (f(c) > f(a) ? c : a));
const clarify = (say, cs) => ({ kind: 'clarify', say, options: cs.map((c) => c.uuid) });
const err = (say) => ({ kind: 'error', say });
const info = (say) => ({ kind: 'info', say });
const claimOf = (snap, uuid) => (snap.claims || []).find((cl) => cl.uuid === uuid) || null;

const VERB = {
  water: 'water', irrigate: 'water', hydrate: 'water',
  plant: 'plant', sow: 'plant',
  harvest: 'harvest', reap: 'harvest', pick: 'harvest', gather: 'harvest', cut: 'harvest', grab: 'harvest',
  claim: 'claim', reserve: 'claim',
  release: 'release', unclaim: 'release', free: 'release',
  rename: 'rename', name: 'rename', call: 'rename',
  select: 'select', choose: 'select', focus: 'select', highlight: 'select',
};
const Q_WORDS = new Set(['what', "what's", 'whats', 'which', 'who', "who's", 'whos', 'how']);

// ---- word roles ---------------------------------------------------------------
// The domain has brutal role collisions: 'water'/'plant'/'harvest' are verbs AND
// nouns; 'dry'/'ripe' are adjectives that SELECT crops. Disambiguation is by
// grammar position: sentence-initial -> verb (parse()); inside a noun phrase
// (resolve() is only ever called on noun phrases) the same word is a noun.
const GENERIC = new Set(['one', 'ones', 'crop', 'crops', 'plant', 'plants', 'seed', 'seeds', 'them']);
const PLURAL_MARK = new Set(['all', 'every', 'everything', 'crops', 'plants', 'ones', 'seeds', 'them']);
const FIELDS = new Set(['water', 'growth', 'name']);
// adjective -> predicate over a crop (claimed/unclaimed need the snapshot)
const ADJ = {
  dry: (c) => c.water < DRY, parched: (c) => c.water < DRY, thirsty: (c) => c.water < DRY,
  wet: (c) => c.water >= 200, watered: (c) => c.water >= 200, soaked: (c) => c.water >= 200,
  ripe: (c) => c.growth >= RIPE, ready: (c) => c.growth >= RIPE, mature: (c) => c.growth >= RIPE, grown: (c) => c.growth >= RIPE,
  unripe: (c) => c.growth < RIPE, green: (c) => c.growth < RIPE, growing: (c) => c.growth < RIPE,
};
const ADJ_CLAIM = {
  claimed: (snap) => (c) => !!claimOf(snap, c.uuid),
  unclaimed: (snap) => (c) => !claimOf(snap, c.uuid),
};
// superlative -> selector over a set ('old'/'young' read as oldest/newest)
const SUPS = {
  driest: (set) => minBy(set, (c) => c.water), thirstiest: (set) => minBy(set, (c) => c.water),
  wettest: (set) => maxBy(set, (c) => c.water),
  ripest: (set) => maxBy(set, (c) => c.growth),
  youngest: (set) => set[set.length - 1], newest: (set) => set[set.length - 1], latest: (set) => set[set.length - 1],
  young: (set) => set[set.length - 1], new: (set) => set[set.length - 1],
  oldest: (set) => set[0], first: (set) => set[0], old: (set) => set[0],
};
const ADJ_DESC = { dry: `water < ${DRY}`, parched: `water < ${DRY}`, thirsty: `water < ${DRY}`,
  wet: 'water >= 200', watered: 'water >= 200', soaked: 'water >= 200',
  ripe: `growth >= ${RIPE}`, ready: `growth >= ${RIPE}`, mature: `growth >= ${RIPE}`, grown: `growth >= ${RIPE}`,
  unripe: `growth < ${RIPE}`, green: `growth < ${RIPE}`, growing: `growth < ${RIPE}`,
  claimed: 'claimed', unclaimed: 'unclaimed' };

// ---- noun-phrase resolution -------------------------------------------------
// -> {one:crop} | {many:[crops], label} | {fail: <result to return verbatim>}
function resolve(snap, phrase, ctx) {
  const cs = snap.crops || [];
  const orig = String(phrase || '').trim().replace(/^(?:the|a|an|some)\s+/i, '');
  const p = orig.toLowerCase();
  if (!p) {
    return { fail: cs.length
      ? clarify(`which crop? there ${cs.length === 1 ? 'is' : 'are'} ${cs.length}: ${list(cs)}`, cs)
      : err('there are no crops in the field') };
  }
  // uuids verbatim (power users) — case-sensitive against the snapshot
  const byUuid = cs.find((c) => c.uuid === orig || c.uuid === String(phrase).trim());
  if (byUuid) return { one: byUuid };

  // 'it', 'that', 'this' — optionally with a generic noun: 'that plant', 'this crop'
  if (/^(?:it|that|this)(?:\s+(?:one|crop|plant|seed))?$/.test(p) || p === 'that one' || p === 'this one') {
    if (!ctx.selected)
      return { fail: clarify(`which crop do you mean by '${p}'? nothing is selected — crops here: ${list(cs) || 'none'}`, cs) };
    const sel = cs.find((c) => c.uuid === ctx.selected);
    return sel ? { one: sel } : { fail: err('the selected crop no longer exists') };
  }

  if (!cs.length) return { fail: err('there are no crops in the field') };

  // a bare generic noun ('the plant', 'the crop', 'the one'): here 'plant' is a
  // NOUN — role decided by position (inside a noun phrase, not sentence-initial).
  if (/^(?:one|crop|plant|seed)$/.test(p)) {
    if (ctx.selected) { const sel = cs.find((c) => c.uuid === ctx.selected); if (sel) return { one: sel }; }
    return cs.length === 1 ? { one: cs[0] }
      : { fail: clarify(`which crop? there are ${cs.length}: ${list(cs)}`, cs) };
  }

  // plural families first ('everything ripe' must not be swallowed by 'everything')
  const pluralish = /\b(?:all|every|everything|crops|ones)\b/.test(p);
  if (/\bripe\b/.test(p) && pluralish) {
    const set = cs.filter((c) => c.growth >= RIPE);
    if (!set.length) {
      const top = maxBy(cs, (c) => c.growth);
      return { fail: err(`no crops are ripe right now — the ripest is ${dn(top)} at growth ${top.growth}/${RIPE}`) };
    }
    return { many: set, label: `${set.length} ripe crop${s(set)}` };
  }
  if (/\b(?:dry|parched|thirsty)\b/.test(p) && pluralish) {
    const set = cs.filter((c) => c.water < DRY);
    if (!set.length) return { fail: err(`no crops are dry right now (all have water >= ${DRY})`) };
    return { many: set, label: `${set.length} dry crop${s(set)}` };
  }
  if (/^(?:all(?:\s+(?:the\s+)?crops?|\s+of\s+them)?|everything|every\s+crop|crops)$/.test(p))
    return { many: cs.slice(), label: `all ${cs.length} crops` };

  // claim-based phrases
  const claimedSet = cs.filter((c) => claimOf(snap, c.uuid));
  const pickOne = (set, what, none) => {
    if (!set.length) return { fail: err(none) };
    if (set.length === 1) return { one: set[0] };
    return { fail: clarify(`which ${what}? there are ${set.length}: ${list(set)}`, set) };
  };
  if (/^claimed(?:\s+(?:crops?|ones?))?$/.test(p))
    return pickOne(claimedSet, 'claimed crop', 'nothing is claimed right now');
  if (/^(?:unclaimed(?:\s+(?:crops?|ones?))?|ones?\s+(?:nobody|no[\s-]?one)\s+claimed)$/.test(p))
    return pickOne(cs.filter((c) => !claimOf(snap, c.uuid)), 'unclaimed crop', 'every crop is claimed right now');
  if (/^(?:mine|my\s+crops?)$/.test(p)) {
    const set = cs.filter((c) => { const cl = claimOf(snap, c.uuid); return cl && cl.holder === snap.you; });
    if (!set.length) return { fail: err(`you (${snap.you}) haven't claimed any crops`) };
    return set.length === 1 ? { one: set[0] } : { many: set, label: `your ${set.length} crops` };
  }
  const poss = p.match(/^(\S+?)'s\s+crops?$/);
  if (poss) {
    const who = poss[1];
    const set = cs.filter((c) => { const cl = claimOf(snap, c.uuid); return cl && String(cl.holder).toLowerCase() === who; });
    if (!set.length) return { fail: err(`${who} hasn't claimed any crops`) };
    return set.length === 1 ? { one: set[0] } : { many: set, label: `${who}'s ${set.length} crops` };
  }

  // superlatives (optionally suffixed 'crop'/'one')
  const p2 = p.replace(/\s+(?:crop|one)$/, '');
  const SUP = {
    driest: () => minBy(cs, (c) => c.water), thirstiest: () => minBy(cs, (c) => c.water),
    wettest: () => maxBy(cs, (c) => c.water),
    ripest: () => maxBy(cs, (c) => c.growth),
    youngest: () => cs[cs.length - 1], newest: () => cs[cs.length - 1], latest: () => cs[cs.length - 1],
    oldest: () => cs[0], first: () => cs[0],
  };
  if (SUP[p2]) return { one: SUP[p2]() };

  // ---- adjective engine: [determiners] adjective* [superlative] [generic noun] ----
  // 'the dry one', 'all ripe plants', 'the ripest dry crop', 'unclaimed wet ones'.
  // Every token must classify (ADJ | SUP | GENERIC | plural marker) — one unknown
  // word and we fall through to name matching, so crops named 'sweet corn' are safe.
  {
    const toks = p.split(' ').filter((w) => !/^(?:the|a|an|some|of)$/.test(w));
    let plural = false, sup = null, preds = [], descs = [], ok = toks.length > 0;
    for (const w of toks) {
      if (PLURAL_MARK.has(w)) { plural = true; if (!GENERIC.has(w) && w !== 'everything') continue; }
      if (w === 'everything' || w === 'all' || w === 'every') { plural = true; continue; }
      if (GENERIC.has(w)) { if (/s$/.test(w) || w === 'them') plural = true; continue; }
      if (SUPS[w]) { if (sup) { ok = false; break; } sup = SUPS[w]; continue; }
      if (ADJ[w]) { preds.push(ADJ[w]); descs.push(w); continue; }
      if (ADJ_CLAIM[w]) { preds.push(ADJ_CLAIM[w](snap)); descs.push(w); continue; }
      ok = false; break;
    }
    if (ok && (sup || preds.length)) {
      const set = cs.filter((c) => preds.every((f) => f(c)));
      const what = descs.join(' ') || 'matching';
      if (!set.length) {
        const why = descs.map((d) => ADJ_DESC[d]).join(' and ');
        return { fail: err(`no crops are ${what} right now${why ? ` (${what} = ${why})` : ''} — crops here: ${list(cs)}`) };
      }
      if (sup) return { one: sup(set) };
      if (plural) return { many: set, label: `${set.length} ${what} crop${s(set)}` };
      if (set.length === 1) return { one: set[0] };
      return { fail: clarify(`which ${what} crop? there are ${set.length}: ${list(set)}`, set) };
    }
  }

  // by displayName or name: exact (case-insensitive), then prefix
  const exact = cs.filter((c) => dn(c).toLowerCase() === p || String(c.name).toLowerCase() === p);
  if (exact.length === 1) return { one: exact[0] };
  if (exact.length > 1) return { fail: clarify(`which '${orig}'? there are ${exact.length}: ${list(exact)}`, exact) };
  const pref = cs.filter((c) => dn(c).toLowerCase().startsWith(p) || String(c.name).toLowerCase().startsWith(p));
  if (pref.length === 1) return { one: pref[0] };
  if (pref.length > 1) return { fail: clarify(`'${orig}' matches ${pref.length} crops: ${list(pref)}`, pref) };
  return { fail: err(`I can't find a crop called '${orig}' — crops here: ${list(cs)}`) };
}

// singular-only verbs (rename/select/release)
function resolveOne(snap, phrase, ctx, verb) {
  const r = resolve(snap, phrase, ctx);
  if (r.fail) return r;
  if (r.many) return { fail: clarify(`${verb} which one? that is ${r.many.length} crops: ${list(r.many)}`, r.many) };
  return r;
}
// fan-out verbs (water/harvest/claim), with the 32-op cap
function resolveSet(snap, phrase, ctx) {
  const r = resolve(snap, phrase, ctx);
  if (r.fail) return r;
  const set = r.one ? [r.one] : r.many;
  if (set.length > OPS_CAP)
    return { fail: clarify(`that is ${set.length} crops but one command caps at ${OPS_CAP} ops — narrow it down (e.g. 'all dry crops')`, set) };
  return { set, label: r.label || dn(set[0]) };
}

// ---- verbs -------------------------------------------------------------------
function doWater(snap, rest, ctx) {
  let mode = 'to', amt = WATER_TO, noun = rest, m;
  if ((m = rest.match(/\s+to\s+(\d+)\s*$/i))) { amt = +m[1]; noun = rest.slice(0, m.index); }
  else if ((m = rest.match(/\s*(?:\+\s*|by\s+)(\d+)\s*$/i))) { mode = 'add'; amt = +m[1]; noun = rest.slice(0, m.index); }
  const r = resolveSet(snap, noun, ctx);
  if (r.fail) return r.fail;
  const tgt = (c) => (mode === 'add' ? clamp(c.water + amt, 0, 255) : clamp(amt, 0, 255));
  const ops = r.set.map((c) => ({ kind: 'setfield', target: c.uuid, field: 'water', value: tgt(c) }));
  const parts = r.set.map((c) => `${dn(c)} (water ${c.water} → ${tgt(c)})`);
  return { kind: 'ops', ops,
    say: r.set.length === 1 ? `watering ${parts[0]}` : `watering ${r.label} — ${parts.join(', ')}` };
}

function doHarvest(snap, rest, ctx) {
  let force = false, noun = rest;
  const m = rest.match(/\s+anyway\s*$/i);
  if (m) { force = true; noun = rest.slice(0, m.index); }
  const r = resolveSet(snap, noun, ctx);
  if (r.fail) return r.fail;
  if (r.set.length === 1) {
    const c = r.set[0];
    if (c.growth >= RIPE || force) {
      const note = c.growth >= RIPE ? `growth ${c.growth} — ripe` : `growth ${c.growth}/${RIPE} — NOT ripe, it will be wasted`;
      return { kind: 'ops', ops: [{ kind: 'delete', target: c.uuid }], say: `harvesting ${dn(c)} (${note})` };
    }
    return { kind: 'clarify', options: [c.uuid],
      say: `${dn(c)} isn't ripe yet (growth ${c.growth}/${RIPE}) — harvesting now would waste it. say 'harvest ${dn(c)} anyway' to do it regardless` };
  }
  const ripe = r.set.filter((c) => c.growth >= RIPE);
  const take = force ? r.set : ripe;
  if (!take.length) {
    const top = maxBy(r.set, (c) => c.growth);
    return err(`none of those ${r.set.length} crops are ripe — the ripest is ${dn(top)} at growth ${top.growth}/${RIPE}. add 'anyway' to harvest them regardless`);
  }
  const skipped = r.set.filter((c) => take.indexOf(c) < 0);
  let say = `harvesting ${take.length} crop${s(take)}: ${list(take)}`;
  if (force && take.length !== ripe.length) say += ` (${take.length - ripe.length} unripe — wasted)`;
  if (skipped.length) say += ` — skipping ${skipped.length} unripe: ${list(skipped)}`;
  return { kind: 'ops', ops: take.map((c) => ({ kind: 'delete', target: c.uuid })), say };
}

function doClaim(snap, rest, ctx) {
  let ticks = CLAIM_TICKS, noun = rest, m;
  if ((m = rest.match(/\s+for\s+(\d+)(?:\s+ticks?)?\s*$/i))) { ticks = +m[1]; noun = rest.slice(0, m.index); }
  if (ticks < 1) return err('claim needs a positive tick count');
  const r = resolveSet(snap, noun, ctx);
  if (r.fail) return r.fail;
  const until = (snap.tick ?? 0) + ticks;
  const held = (c) => {
    const cl = claimOf(snap, c.uuid);
    return cl && cl.holder !== snap.you ? ` — note: currently held by ${cl.holder} until tick ${cl.until}` : '';
  };
  const ops = r.set.map((c) => ({ kind: 'claim', target: c.uuid, ticks }));
  const say = r.set.length === 1
    ? `claiming ${dn(r.set[0])} for ${ticks} ticks (until ~tick ${until})${held(r.set[0])}`
    : `claiming ${r.label} for ${ticks} ticks (until ~tick ${until}): ${r.set.map((c) => dn(c) + held(c)).join('; ')}`;
  return { kind: 'ops', ops, say };
}

function doRelease(snap, rest, ctx) {
  const r = resolveOne(snap, rest, ctx, 'release');
  if (r.fail) return r.fail;
  const c = r.one, cl = claimOf(snap, c.uuid);
  if (!cl) return err(`${dn(c)} isn't claimed by anyone — nothing to release (claims expire on their own)`);
  const eta = snap.tick != null ? ` (${cl.until - snap.tick} ticks from now)` : '';
  return err(`there is no release command — claims expire on their own. ${dn(c)}'s claim, held by ${cl.holder}, lapses at tick ${cl.until}${eta}`);
}

function doRename(snap, restWords, ctx) {
  const lowW = restWords.map((w) => w.toLowerCase());
  let i = lowW.indexOf('to');
  if (i < 0) i = lowW.indexOf('as');
  if (i < 1 || i === restWords.length - 1)
    return err('rename what to what? try: rename <crop> to <new name>');
  const r = resolveOne(snap, restWords.slice(0, i).join(' '), ctx, 'rename');
  if (r.fail) return r.fail;
  const name = restWords.slice(i + 1).join(' ');           // original case preserved
  return { kind: 'ops', ops: [{ kind: 'setfield', target: r.one.uuid, field: 'name', value: name }],
    say: `renaming ${dn(r.one)} to "${name}"` };
}

function doSelect(snap, rest, ctx) {
  const r = resolveOne(snap, rest, ctx, 'select');
  if (r.fail) return r.fail;
  const c = r.one, cl = claimOf(snap, c.uuid);
  return { kind: 'info', select: c.uuid,
    say: `selected ${dn(c)} (water ${c.water}, growth ${c.growth}${c.growth >= RIPE ? ' — ripe' : ''}${cl ? `, claimed by ${cl.holder} until tick ${cl.until}` : ''})` };
}

function doPlant(snap, restWords) {
  let w = restWords.slice(), n = 1, m;
  if (w[0] && /^(?:a|an|some|the)$/i.test(w[0])) w = w.slice(1);
  if (w[0] && /^\d+$/.test(w[0])) n = +w.shift();
  else if (w.length && (m = w[w.length - 1].match(/^x(\d+)$/i))) { n = +m[1]; w = w.slice(0, -1); }
  else if (w.length >= 2 && /^x$/i.test(w[w.length - 2]) && /^\d+$/.test(w[w.length - 1])) { n = +w[w.length - 1]; w = w.slice(0, -2); }
  const base = w.join(' ');
  if (!base) return err("plant what? try: 'plant corn' or 'plant 3 corn'");
  if (n < 1) return err('plant how many? the count must be at least 1');
  if (n > OPS_CAP)
    return { kind: 'clarify', options: [], say: `planting ${n} at once exceeds the ${OPS_CAP}-op cap — plant ${OPS_CAP} or fewer per command` };
  if (!snap.zone) return err('this snapshot has no zone to plant into');
  const names = Array.from({ length: n }, (_, i) => (i === 0 ? base : `${base} ${i + 1}`));
  const ops = names.map((nm) => ({ kind: 'createChild', type: 'crop', parent: snap.zone,
    props: { name: nm, water: PLANT_WATER, growth: PLANT_GROWTH } }));
  const say = n === 1
    ? `planting "${base}" (water ${PLANT_WATER}, growth ${PLANT_GROWTH})`
    : `planting ${n} crops: ${names.map((x) => `"${x}"`).join(', ')} (each water ${PLANT_WATER}, growth ${PLANT_GROWTH})`;
  return { kind: 'ops', ops, say };
}

// set/make/change — 'water' and 'growth' as FIELD NOUNS, written explicitly.
// 'set water to 50 on Elm', "set Elm's water to 50", "make the dry one's growth 10".
function doSetField(snap, rest, ctx) {
  let m, field, noun, valueRaw;
  if ((m = rest.match(/^(water|growth|name)\s+(?:to\s+|=\s*)?(.+?)\s+(?:on|of|for)\s+(.+)$/i))) {
    field = m[1].toLowerCase(); valueRaw = m[2]; noun = m[3];
  } else if ((m = rest.match(/^(.+?)(?:'s)?\s+(water|growth|name)\s+(?:to\s+|=\s*)?(.+)$/i)) && FIELDS.has(m[2].toLowerCase())) {
    noun = m[1]; field = m[2].toLowerCase(); valueRaw = m[3];
  } else {
    return err("set what? try: 'set water to 50 on Elm', \"set Elm's growth to 10\", or 'rename <crop> to <name>'");
  }
  const r = resolveOne(snap, noun, ctx, 'set');
  if (r.fail) return r.fail;
  const c = r.one;
  if (field === 'name')
    return { kind: 'ops', ops: [{ kind: 'setfield', target: c.uuid, field: 'name', value: valueRaw.trim() }],
      say: `renaming ${dn(c)} to "${valueRaw.trim()}"` };
  const n = Number(valueRaw.trim());
  if (!Number.isFinite(n)) return err(`'${valueRaw.trim()}' isn't a number — ${field} takes 0-255`);
  const v = clamp(Math.round(n), 0, 255);
  return { kind: 'ops', ops: [{ kind: 'setfield', target: c.uuid, field, value: v }],
    say: `setting ${dn(c)}'s ${field} to ${v} (was ${c[field]})${v !== n ? ' — clamped to 0-255' : ''}` };
}

// ---- read-only questions -----------------------------------------------------
function question(snap, q, ctx = {}) {
  const cs = snap.crops || [];
  // per-crop field queries — 'water' as a FIELD NOUN in question position:
  // "what's the water on Elm", "Elm's growth", "how much water does the ripest crop have"
  let fm = q.match(/\b(water|growth)\b(?:\s+level)?\s+(?:on|of|for)\s+(.+)$/)
        || q.match(/^(?:.*\s)?(.+?)'s\s+(water|growth)\b/) && [null,
             q.match(/^(?:.*\s)?(.+?)'s\s+(water|growth)\b/)[2], q.match(/^(?:.*\s)?(.+?)'s\s+(water|growth)\b/)[1]]
        || q.match(/how much (water|growth) does\s+(.+?)\s+have/);
  if (fm) {
    const field = fm[1], noun = fm[2].replace(/\s+have$/, '');
    const r = resolveOne(snap, noun, ctx, 'check');
    if (r.fail) return r.fail;
    const c = r.one;
    return info(`${dn(c)} has ${field} ${c[field]}${field === 'growth' && c.growth >= RIPE ? ' — ripe' : ''}`);
  }
  if (/\bhow many\b|\bcount\b/.test(q)) {
    const ripe = cs.filter((c) => c.growth >= RIPE), dry = cs.filter((c) => c.water < DRY);
    if (/\bripe\b/.test(q)) return info(ripe.length ? `${ripe.length} crop${s(ripe)} ripe: ${list(ripe)}` : 'no crops are ripe right now');
    if (/\bdry\b/.test(q)) return info(dry.length ? `${dry.length} crop${s(dry)} dry (water < ${DRY}): ${list(dry)}` : 'no crops are dry right now');
    return info(`there are ${cs.length} crops (${ripe.length} ripe, ${dry.length} dry)`);
  }
  if (/\bclaim/.test(q)) {
    const cls = (snap.claims || []).map((cl) => {
      const c = cs.find((x) => x.uuid === cl.uuid);
      return `${cl.holder} holds ${c ? dn(c) : 'an entity'} until tick ${cl.until}`;
    });
    return info(cls.length ? cls.join('; ') : 'nothing is claimed right now');
  }
  if (/\bscore\b|\btally\b|\bpoints\b/.test(q)) return info(`the tally is ${snap.tally ?? 0} at tick ${snap.tick ?? '?'}`);
  if (!cs.length) return info('there are no crops in the field');
  if (/dri\w*|thirst/.test(q)) { const c = minBy(cs, (x) => x.water); return info(`the driest crop is ${dn(c)} (water ${c.water})`); }
  if (/wettest/.test(q)) { const c = maxBy(cs, (x) => x.water); return info(`the wettest crop is ${dn(c)} (water ${c.water})`); }
  if (/ripest|closest to ripe/.test(q)) { const c = maxBy(cs, (x) => x.growth); return info(`the ripest crop is ${dn(c)} (growth ${c.growth}${c.growth >= RIPE ? ' — ripe' : ''})`); }
  return err("I can't answer that — try: what's the driest crop, who claimed what, what's the score, how many crops are ripe");
}

// ---- entry -------------------------------------------------------------------
function parse(snapshot, text, ctx = {}) {
  const snap = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const raw = String(text == null ? '' : text).trim().replace(/\s+/g, ' ');
  const t = raw.replace(/[?!.]+$/, '').trim();
  if (!t) return err('say something — try: water <crop>, plant <name>, harvest <crop>, claim <crop>, rename <crop> to <name>, select <crop>, or ask a question');
  let words = t.split(' ');
  // strip leading politeness/filler so 'please water the corn' still parses
  while (words.length > 1 && /^(?:please|can|could|would|you|just|now|hey|go)$/i.test(words[0])) words = words.slice(1);
  const low = words.map((w) => w.toLowerCase());
  const rest = words.slice(1).join(' ');
  const verb = VERB[low[0]];
  if (verb === 'water') return doWater(snap, rest, ctx);
  if (verb === 'plant') return doPlant(snap, words.slice(1));
  if (verb === 'harvest') return doHarvest(snap, rest, ctx);
  if (verb === 'claim') return doClaim(snap, rest, ctx);
  if (verb === 'release') return doRelease(snap, rest, ctx);
  if (verb === 'rename') return doRename(snap, words.slice(1), ctx);
  if (verb === 'select') return doSelect(snap, rest, ctx);
  if (/^(?:set|make|change)$/.test(low[0])) return doSetField(snap, rest, ctx);
  if (/^(?:check|show|inspect)$/.test(low[0])) {}
  if (Q_WORDS.has(low[0]) || low[0] === 'score' || /\?\s*$/.test(raw)) return question(snap, t.toLowerCase(), ctx);
  return err(`I don't understand '${words[0]}' — try: water, plant, harvest, claim, release, rename, select, set, or ask a question`);
}

module.exports = { parse };
