#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// codeFacts.mjs — a task-relevant model of a program the system has not seen before.
//
// The question this exists to answer: when the next edit must change some state, WHAT CONSTRAINTS
// DOES THAT CHANGE HAVE TO OBEY? TRANSFER-1 failed because the model reassigned a `const` binding.
// The declaration was in the file it was given; it had the fact and did not use it. So the claim
// here is NOT "the model cannot see declarations" - it is that a prompt can spend its budget on
// extracted constraints instead of ordinary nearby code, and that this is testable.
//
// FOUR THINGS ARE EXTRACTED, and they are kept apart on purpose:
//   STRUCTURE     where the edit goes, and what encloses it
//   BEHAVIOUR     how the code ALREADY changes each piece of state (the existing handlers are the
//                 worked example; nothing here is invented)
//   CONSTRAINTS   what the declaration forbids - const/let/var, and what the initialiser is
//   UNCERTAINTY   every identifier written that could not be resolved, and every script that would
//                 not parse. An extractor that hides what it could not read is worse than none.
//
// WHAT IT IS NOT ALLOWED TO READ. It takes a file and a chosen site. It never receives the play
// spec, the diagnostic, the protected set or any check. `factsSourceReferencesNoChecks()` asserts
// that mechanically, the same way the guidance policy is held to it.
//
// Nothing here is specific to a lamp, a farm, a canvas or a key. The rule that would have caught
// TRANSFER-1 is general: report the declaration of every piece of state the code at this site
// ALREADY writes.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import * as acorn from 'acorn';

const sha = (t) => createHash('sha256').update(t).digest('hex');

// Array methods that change the receiver. A `const` array is mutable through exactly these plus
// index assignment and length; knowing that is the difference between LAMPS.fill(false) and a throw.
const MUTATING_METHODS = new Set([
  'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin',
  'set', 'add', 'delete', 'clear',
]);

// ══ 1. getting to an AST ═════════════════════════════════════════════════════════════════════════

/** Every inline <script> block, with the file offset needed to map a node back to a file line. */
export function scriptBlocks(file) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(file)) !== null) {
    if (/\bsrc\s*=/i.test(m[1])) continue;            // external: its text is not in this file
    out.push({ offset: m.index + m[0].indexOf(m[2]), text: m[2] });
  }
  if (!out.length && !/<\w+/.test(file.slice(0, 200))) out.push({ offset: 0, text: file });
  return out;
}

const lineOf = (file, offset) => file.slice(0, offset).split('\n').length;   // 1-based

function parseBlocks(file) {
  const asts = [];
  const unparsed = [];
  for (const b of scriptBlocks(file)) {
    try {
      asts.push({ ...b, ast: acorn.parse(b.text, { ecmaVersion: 2022, locations: false, ranges: true }) });
    } catch (err) {
      unparsed.push({ atFileLine: lineOf(file, b.offset), message: String(err.message) });
    }
  }
  return { asts, unparsed };
}

/** A generic walker: no acorn-walk dependency, and it cannot silently skip a node type it lacks. */
function walk(node, visit, parent = null) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const n of node) walk(n, visit, parent); return; }
  if (typeof node.type !== 'string') return;
  visit(node, parent);
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'start' || k === 'end' || k === 'range' || k === 'loc') continue;
    walk(node[k], visit, node);
  }
}

// ══ 2. STRUCTURE — what encloses the edit ════════════════════════════════════════════════════════

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/**
 * The innermost function in the file that contains this file line. For an R1 site that is the
 * dispatching listener's callback; for R2 it is the listener the new one goes after, which is still
 * the right worked example even though the new code lands outside it.
 */
export function enclosingFunction(file, fileLine, parsed) {
  let best = null;
  for (const blk of parsed.asts) {
    walk(blk.ast, (n) => {
      if (!FUNCTIONS.has(n.type)) return;
      const startLine = lineOf(file, blk.offset + n.start);
      const endLine = lineOf(file, blk.offset + n.end);
      if (fileLine < startLine || fileLine > endLine) return;
      const span = endLine - startLine;
      if (!best || span < best.span) best = { node: n, blk, startLine, endLine, span };
    });
  }
  return best;
}

// ══ 3. BEHAVIOUR — how the code already writes things ════════════════════════════════════════════

/** The identifier at the root of a write target, e.g. `a.b[i].c = x` -> `a`. */
function rootOf(node) {
  let cur = node;
  while (cur && cur.type === 'MemberExpression') cur = cur.object;
  return cur && cur.type === 'Identifier' ? cur : null;
}

const WRITE_KINDS = {
  assign: 'assigns the name itself',
  'member-assign': 'assigns one of its members or elements',
  update: 'increments or decrements it',
  'mutating-call': 'calls a method that changes it in place',
};

/** The parameter names of a function node - locals, never the page's state. */
function paramNames(node) {
  const out = new Set();
  for (const p of node.params || []) walk(p, (n) => { if (n.type === 'Identifier') out.add(n.name); });
  return out;
}

/** Every write performed by the code inside `scope`, with the source line that does it. */
export function writesIn(file, scope) {
  const { node, blk } = scope;
  const params = paramNames(node);
  const ownerStart = blk.offset + node.start, ownerEnd = blk.offset + node.end;
  const writes = [];
  const lines = file.split('\n');
  const at = (n) => lineOf(file, blk.offset + n.start);
  const record = (kind, target, n, detail = null) => {
    const root = rootOf(target);
    const fileLine = at(n);
    writes.push({
      kind, root: root ? root.name : null, detail,
      unresolvableTarget: root ? null : `a write whose target is not rooted in a plain name (${target.type})`,
      atLine: fileLine, text: (lines[fileLine - 1] || '').trim(),
      isParamOfOwner: !!(root && params.has(root.name)), ownerStart, ownerEnd,
    });
  };
  walk(node.body, (n) => {
    if (n.type === 'AssignmentExpression') {
      record(n.left.type === 'Identifier' ? 'assign' : 'member-assign', n.left, n,
        n.operator === '=' ? null : `compound ${n.operator}`);
    } else if (n.type === 'UpdateExpression') {
      record('update', n.argument, n, n.operator);
    } else if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression'
               && n.callee.property.type === 'Identifier' && MUTATING_METHODS.has(n.callee.property.name)) {
      record('mutating-call', n.callee.object, n, n.callee.property.name + '()');
    }
  });
  return writes;
}

/**
 * THE DEFECT THIS FIXES, recorded because it is the whole reason the extractor exists.
 *
 * The first version read only the writes performed INSIDE the chosen site, and on the first real
 * page it was pointed at it returned ZERO constraints - because that page's handler does not write
 * state, it calls `toggleLamp(index)`, and THAT writes it. An extractor that only looks at the
 * statements in front of it misses the state of any program organised into functions, which is most
 * of them. So the traversal follows calls to functions THIS FILE DECLARES, to a bounded depth, and
 * every fact carries the path it was reached by, so a reader can check the chain.
 *
 * It is still purely structural: no name, no key and no page shape is special-cased.
 */
export function reachableWrites(file, scope, decls, { maxDepth = 3 } = {}) {
  const writes = [];
  const calls = [];
  const seen = new Set();
  const visit = (fnScope, path, depth) => {
    for (const w of writesIn(file, fnScope)) writes.push({ ...w, viaPath: path });
    if (depth >= maxDepth) {
      walk(fnScope.node.body, (n) => {
        if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && decls.get(n.callee.name)?.isFunction) {
          calls.push({ name: n.callee.name, notFollowed: true, atDepth: depth });
        }
      });
      return;
    }
    walk(fnScope.node.body, (n) => {
      if (n.type !== 'CallExpression' || n.callee.type !== 'Identifier') return;
      const decl = decls.get(n.callee.name);
      if (!decl || !decl.isFunction || !decl.fnNode) return;
      const line = lineOf(file, fnScope.blk.offset + n.start);
      calls.push({ name: n.callee.name, arity: decl.arity, argCount: n.arguments.length,
                   declaredAtLine: decl.atLine, calledAtLine: line, viaPath: path });
      if (seen.has(n.callee.name)) return;                     // a cycle is not new information
      seen.add(n.callee.name);
      visit({ node: decl.fnNode, blk: decl.blk }, [...path, n.callee.name], depth + 1);
    });
  };
  visit(scope, [], 0);
  return { writes, calls };
}

/** Zero-argument calls to functions this file declares — the redraw, whatever it is called. */
export function zeroArgLocalCalls(file, scope, decls, { maxDepth = 3 } = {}) {
  const { calls } = reachableWrites(file, scope, decls, { maxDepth });
  const found = new Map();
  for (const c of calls) {
    if (c.notFollowed || c.argCount !== 0) continue;
    const decl = decls.get(c.name);
    if (!found.has(c.name)) found.set(c.name, { name: c.name, arity: decl.arity, declaredAtLine: decl.atLine, calledAtLines: [], viaPath: c.viaPath });
    found.get(c.name).calledAtLines.push(c.calledAtLine);
  }
  return [...found.values()];
}

// ══ 4. CONSTRAINTS — what the declaration forbids ════════════════════════════════════════════════

/** Every declaration in the file, by name, with the keyword and the initialiser's shape. */
export function declarations(file, parsed) {
  const map = new Map();
  for (const blk of parsed.asts) {
    walk(blk.ast, (n, parent) => {
      if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') {
        map.set(n.id.name, {
          name: n.id.name, keyword: parent && parent.kind ? parent.kind : 'var',
          isFunction: !!(n.init && FUNCTIONS.has(n.init.type)),
          arity: n.init && FUNCTIONS.has(n.init.type) ? n.init.params.length : null,
          initKind: n.init ? n.init.type : 'none',
          atLine: lineOf(file, blk.offset + n.start),
          // The KEYWORD goes in the quoted text. An earlier version quoted the declarator alone -
          // `LAMPS = [false, false, false]` - which omits the single word that IS the constraint.
          text: ((parent && parent.kind ? parent.kind + ' ' : '') + blk.text.slice(n.start, Math.min(n.end, n.start + 160)).split('\n')[0]).trim(),
          start: blk.offset + n.start, end: blk.offset + n.end,
          fnNode: n.init && FUNCTIONS.has(n.init.type) ? n.init : null, blk,
        });
      } else if (n.type === 'FunctionDeclaration' && n.id) {
        map.set(n.id.name, {
          name: n.id.name, keyword: 'function', isFunction: true, arity: n.params.length,
          initKind: 'FunctionDeclaration', atLine: lineOf(file, blk.offset + n.start),
          text: 'function ' + n.id.name + '(' + n.params.map((p) => p.name || '?').join(', ') + ')',
          start: blk.offset + n.start, end: blk.offset + n.end,
          fnNode: n, blk,
        });
      }
    });
  }
  return map;
}

const CONTAINERS = new Set(['ArrayExpression', 'ObjectExpression', 'NewExpression', 'CallExpression']);

/**
 * The constraint a declaration imposes on a change. This is the general form of the TRANSFER-1
 * failure: a `const` holding a container may be changed only THROUGH it.
 */
export function constraintOf(decl) {
  if (!decl) return { verdict: 'UNKNOWN', text: 'this file does not declare it, so how it may be changed cannot be stated from this file alone' };
  if (decl.keyword === 'function') return { verdict: 'FUNCTION', text: 'a function declaration' };
  if (decl.keyword !== 'const') {
    return { verdict: 'REASSIGNABLE', text: `declared with ${decl.keyword}, so it may be reassigned` };
  }
  if (CONTAINERS.has(decl.initKind)) {
    return {
      verdict: 'CONST_CONTAINER',
      text: 'declared const, so it must be changed IN PLACE through its elements or its own methods; assigning to the name throws TypeError: Assignment to constant variable',
    };
  }
  return { verdict: 'CONST_VALUE', text: 'declared const and does not hold a container, so it cannot be changed through this name at all' };
}

// ══ 5. the facts ═════════════════════════════════════════════════════════════════════════════════

/**
 * @param file      the whole program text
 * @param site      what chooseSite returned (only insertAfterLine / rule are read)
 * The requirement is deliberately NOT a parameter: every fact here is about the program, and mixing
 * the requirement's words in is how a derivation ends up contaminating what it was meant to measure.
 */
export function extractFacts(file, site) {
  const parsed = parseBlocks(file);
  const uncertainty = [];
  for (const u of parsed.unparsed) uncertainty.push(`a script block at line ${u.atFileLine} would not parse (${u.message}), so nothing in it was read`);
  if (!parsed.asts.length) {
    return { ok: false, why: 'NO_PARSEABLE_SCRIPT', structure: null, behaviour: [], constraints: [], redraws: [], uncertainty };
  }

  const anchorLine = (site && Number.isInteger(site.insertAfterLine)) ? site.insertAfterLine + 1 : 1;
  const scope = enclosingFunction(file, anchorLine, parsed);
  if (!scope) {
    return { ok: false, why: 'NO_ENCLOSING_FUNCTION', structure: null, behaviour: [], constraints: [], redraws: [],
             uncertainty: [...uncertainty, `no function in this file contains line ${anchorLine}, so there is no existing behaviour to read`] };
  }

  const decls = declarations(file, parsed);
  const { writes, calls } = reachableWrites(file, scope, decls);
  for (const c of calls) {
    if (c.notFollowed) uncertainty.push(`\`${c.name}()\` is called from here but was not followed: the traversal stops at depth 3, so anything it writes is unreported`);
  }

  // One entry per piece of state the code reachable from this site writes.
  const byName = new Map();
  for (const w of writes) {
    if (w.unresolvableTarget) { uncertainty.push(`${w.unresolvableTarget}, at line ${w.atLine}`); continue; }
    if (w.isParamOfOwner) continue;                    // writing a parameter changes nothing outside
    const decl = decls.get(w.root);
    // A binding declared INSIDE the function that writes it is that function's local, not the
    // page's state. This is checked against the writing function, not the site, because the write
    // may have been reached through a call.
    if (decl && decl.start >= w.ownerStart && decl.end <= w.ownerEnd) continue;
    if (!byName.has(w.root)) byName.set(w.root, { name: w.root, decl: decl || null, writes: [] });
    byName.get(w.root).writes.push(w);
  }

  const constraints = [];
  for (const s of byName.values()) {
    const c = constraintOf(s.decl);
    if (c.verdict === 'FUNCTION') continue;
    if (c.verdict === 'UNKNOWN') uncertainty.push(`\`${s.name}\` is written at this site but not declared in this file`);
    constraints.push({
      name: s.name,
      declaredAtLine: s.decl ? s.decl.atLine : null,
      declaration: s.decl ? s.decl.text : null,
      verdict: c.verdict,
      constraint: c.text,
      howExistingCodeWritesIt: s.writes.map((w) => ({
        kind: w.kind, meaning: WRITE_KINDS[w.kind], atLine: w.atLine, text: w.text,
        reachedVia: w.viaPath.length ? w.viaPath.join(' -> ') : 'the site itself',
      })),
    });
  }
  // WHAT ORDER, and why it is not "tightest constraint first". The first ranking put `ctx` - the
  // canvas context, const and written, but three calls away through the redraw - above `LAMPS`, and
  // the budget then truncated the fact that mattered. The defensible rank is how DIRECTLY the site's
  // own code changes the state: fewest calls from the site first. That is a property of the program,
  // not a guess about the task.
  for (const c of constraints) c.callDepth = Math.min(...c.howExistingCodeWritesIt.map((w) => (w.reachedVia === 'the site itself' ? 0 : w.reachedVia.split(' -> ').length)));
  const rank = { CONST_VALUE: 0, CONST_CONTAINER: 1, REASSIGNABLE: 2, UNKNOWN: 3 };
  constraints.sort((a, b) => a.callDepth - b.callDepth || rank[a.verdict] - rank[b.verdict] || a.name.localeCompare(b.name));

  const redraws = zeroArgLocalCalls(file, scope, decls);
  const keydownHandlers = (file.match(/addEventListener\(\s*['"]keydown['"]/g) || []).length;
  for (const r of redraws) {
    const callsInFile = (file.match(new RegExp('\\b' + r.name + '\\s*\\(\\s*\\)', 'g')) || []).length;
    r.calledByEveryKeydownHandler = keydownHandlers > 0 && callsInFile >= keydownHandlers;
  }

  return {
    ok: true,
    structure: {
      rule: site ? site.rule : null,
      enclosingFunctionLines: [scope.startLine, scope.endLine],
      enclosingKind: scope.node.type,
      keydownHandlersInFile: keydownHandlers,
    },
    behaviour: writes.filter((w) => !w.unresolvableTarget).map((w) => ({ root: w.root, kind: w.kind, atLine: w.atLine, text: w.text })),
    constraints,
    redraws,
    uncertainty,
  };
}

// ══ 6. rendering — the two arms, built to the same budget ════════════════════════════════════════

/**
 * ARM B: the extracted constraints, as English a model can act on. Every line is traceable to a
 * line number in the file, so a reader can check the extractor rather than trust it.
 */
export function renderConstraints(facts, { budget = 700 } = {}) {
  if (!facts.ok) return { text: `// the constraints could not be extracted: ${facts.why}`, lines: 1, complete: false, dropped: ['everything'] };

  // Each fact is a block whose parts have their own priority. When the budget binds, the OPTIONAL
  // parts of the LOWEST-priority facts go first - so a fact never keeps its worked example while a
  // more directly relevant fact has been cut to nothing.
  const blocks = facts.constraints.map((c, i) => {
    const where = c.declaredAtLine ? ` (line ${c.declaredAtLine}: ${c.declaration})` : '';
    const ex = c.howExistingCodeWritesIt[0];
    const via = ex && (ex.reachedVia === 'the site itself' ? 'existing code at this site' : `existing code reached from here through ${ex.reachedVia}`);
    return {
      order: i, label: c.name,
      required: [`// ${c.name}${where}`, `//   ${c.constraint}`],
      optional: ex ? [`//   ${via} ${ex.meaning}, line ${ex.atLine}: ${ex.text}`] : [],
    };
  });
  for (const r of facts.redraws) {
    blocks.push({ order: blocks.length, label: r.name + '()',
      required: [`// ${r.name}() takes ${r.arity} arguments (line ${r.declaredAtLine}) and the code here calls it after changing state`], optional: [] });
  }
  for (const u of facts.uncertainty) blocks.push({ order: blocks.length, label: 'uncertainty', required: [`// not established: ${u}`], optional: [] });

  const size = (ls) => ls.reduce((n, l) => n + l.length + 1, 0);
  const keepOptional = blocks.map(() => true);
  const keepBlock = blocks.map(() => true);
  const dropped = [];
  const total = () => blocks.reduce((n, b, i) => n + (keepBlock[i] ? size(b.required) + (keepOptional[i] ? size(b.optional) : 0) : 0), 0);

  for (let i = blocks.length - 1; i >= 0 && total() > budget; i--) {
    if (blocks[i].optional.length) { keepOptional[i] = false; dropped.push(`${blocks[i].label}: its worked example`); }
  }
  for (let i = blocks.length - 1; i >= 0 && total() > budget; i--) {
    keepBlock[i] = false; dropped.push(`${blocks[i].label}: the whole fact`);
  }

  const lines = [];
  blocks.forEach((b, i) => { if (!keepBlock[i]) return; lines.push(...b.required); if (keepOptional[i]) lines.push(...b.optional); });
  const text = lines.join('\n');
  return { text, lines: lines.length, complete: dropped.length === 0, dropped };
}

/**
 * ARM A: ordinary nearby code, to the SAME budget. This is the control, and it has to be a fair
 * one: the most useful thing a person would paste - the lines immediately around the site, which on
 * a page like this is exactly where the existing handlers are.
 */
export function renderNearbyCode(file, site, { budget = 700 } = {}) {
  const lines = file.split('\n');
  const anchor = (site && Number.isInteger(site.insertAfterLine)) ? site.insertAfterLine : 0;
  const out = [];
  let used = 0;
  let before = anchor, after = anchor + 1, complete = false;
  // Grow outwards from the site, alternating, so the window is centred on the edit.
  for (let guard = 0; guard < lines.length * 2; guard++) {
    const next = (guard % 2 === 0) ? (before >= 0 ? lines[before] : null) : (after < lines.length ? lines[after] : null);
    if (next === null || next === undefined) { if (before < 0 && after >= lines.length) { complete = true; break; } }
    else {
      const cost = next.length + 1;
      if (used + cost > budget) break;
      if (guard % 2 === 0) { out.unshift(next); before--; } else { out.push(next); after++; }
      used += cost;
    }
    if (guard % 2 === 0) { if (before < 0) before = -1; } else if (after >= lines.length) after = lines.length;
  }
  const text = out.join('\n');
  return { text, lines: out.length, complete, windowLines: [before + 2, after] };
}

/**
 * THE TWO ARMS OF THE COMPARISON, built so their sizes are a measured fact and not an aspiration.
 *
 * Both are capped by line granularity, so no two renderings land on the same character count. The
 * construction: build the constraints to `budget`, then build the nearby code to whatever the
 * constraints actually came to. Each arm's real size is returned, and so is the difference, because
 * "equal-sized prompts" is a claim the record has to be able to check.
 */
export function buildArms(file, site, { budget = 700 } = {}) {
  const facts = extractFacts(file, site);
  const constraints = renderConstraints(facts, { budget });
  const nearby = renderNearbyCode(file, site, { budget: Math.max(constraints.text.length, 1) });
  return {
    facts,
    constraints: { ...constraints, chars: constraints.text.length },
    nearby: { ...nearby, chars: nearby.text.length },
    sizeDifference: Math.abs(constraints.text.length - nearby.text.length),
    budget,
  };
}

// ══ 7. the discipline check ══════════════════════════════════════════════════════════════════════

/**
 * The extractor may read the program. It may not read the thing that judges the program. This is
 * the same assertion the guidance policy carries, and it is here because a fact derived from a
 * check is a leak that looks like a discovery.
 */
export function factsSourceReferencesNoChecks(src) {
  const banned = [
    /\bexpect\b/, /\bstateExpr\b/, /\bnoErrors\b/, /\bplayCheck\b/, /\bprotected\b/,
    /\bdiagnostic\b/, /\bbenchTasks\b/, /\brequirement\.effects\b/, /\binvariants\b/,
  ];
  // The header explains the rule and this section lists the banned words, so neither is part of what
  // is being checked: sections 1-6 are the code that actually reads the program. If the markers are
  // absent the WHOLE source is checked - an earlier version sliced between two -1s, got the empty
  // string, and pronounced every possible source clean, including one that was nothing but a banned
  // reference. A check that cannot fail is not a check.
  const a = src.indexOf('// ══ 1.'), b = src.indexOf('// ══ 7.');
  const body = (a >= 0 && b > a) ? src.slice(a, b) : src;
  const hits = banned.filter((re) => re.test(body)).map(String);
  return { clean: hits.length === 0, hits };
}

// ══ direct invocation: print the facts for a file ════════════════════════════════════════════════
const DIRECT = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (DIRECT) {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
  const path = opt('file', null);
  if (!path) { console.error('usage: node codeFacts.mjs --file <path> [--line N] [--budget N]'); process.exit(2); }
  const file = readFileSync(path, 'utf8');
  const line = parseInt(opt('line', '0'), 10);
  const budget = parseInt(opt('budget', '700'), 10);
  const site = { rule: opt('rule', 'R1'), insertAfterLine: line };
  const facts = extractFacts(file, site);
  console.log('file sha256   ', sha(file).slice(0, 16));
  console.log(JSON.stringify(facts, null, 2));
  const b = renderConstraints(facts, { budget });
  const a = renderNearbyCode(file, site, { budget });
  console.log('\n── ARM B (constraints, ' + b.text.length + ' chars, ' + b.lines + ' lines) ──\n' + b.text);
  console.log('\n── ARM A (nearby code, ' + a.text.length + ' chars, ' + a.lines + ' lines) ──\n' + a.text);
}
