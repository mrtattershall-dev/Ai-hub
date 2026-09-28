#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// editPlanner.mjs — WHERE should the change go, and what shape should it take?
//
//   node server/editPlanner.mjs --dir <page dir>
//
// THE ASSUMPTION THIS REPLACES. `autoGuide.chooseSite` knows two moves: put a branch inside an existing
// keydown listener, or add a keydown listener after the last one. Both are keyboard moves, so a
// requirement about a BUTTON has nowhere to go, and OBSEVAL-1 stopped there.
//
// The fix is not to add a third keyboard move. It is to choose the move from what was ASKED FOR and what
// the application IS. If a requirement asks for a key, the requested listener is created - someone asked
// for it, and refusing because the selected adapter is browser.input would let the ADAPTER DICTATE THE
// IMPLEMENTATION, which is the restriction being removed. If it asks for a button, a button is wired.
//
// The planner chooses from THE REQUESTED BEHAVIOUR and THE APPLICATION'S STRUCTURE. The selected
// observation adapter INFORMS the choice - it says how the application is driven - but does not dictate
// the implementation: a page observed through typing may still need a button, and a page with a button
// may need a shared function changed instead of a new handler.
//
// IT PRODUCES A REVIEWABLE PROPOSAL, not an edit:
//   requestedEffect          what must change for the user
//   relevantCode             the handlers, functions and state tied to that effect
//   proposedSite + scope     with the evidence for choosing it
//   preservationObligations  what must still pass afterwards
//   uncertainty              what would need another probe, or a decline
//
// A proposal is a hypothesis about where work belongs. It is not permission to retain anything, and it
// never defines what the correct result is - that comes from the requirement and its checks.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);

/** The moves the planner can propose. Each is a SHAPE of change, not a page. */
export const MOVE = {
  EXTEND_HANDLER: 'EXTEND_AN_EXISTING_HANDLER',
  ATTACH_TO_CONTROL: 'ATTACH_A_HANDLER_TO_AN_EXISTING_CONTROL',
  CREATE_CONTROL: 'CREATE_A_CONTROL_AND_WIRE_IT',
  MODIFY_SHARED: 'MODIFY_A_SHARED_FUNCTION',
  NEW_LISTENER: 'CREATE_A_NEW_LISTENER',
  DECLINE: 'DECLINE',
};

const lines = (t) => t.split(NL);

/** Script text with strings, template literals and comments blanked, so braces mean structure. */
function structural(t) {
  return String(t)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split(NL).map((l) => l.replace(/\/\/.*$/, (m) => ' '.repeat(m.length))).join(NL)
    .replace(/`(?:\\.|[^`\\])*`/g, (m) => ' '.repeat(m.length))
    .replace(/'(?:\\.|[^'\\])*'/g, (m) => ' '.repeat(m.length))
    .replace(/"(?:\\.|[^"\\])*"/g, (m) => ' '.repeat(m.length));
}

/** Every `<script>` body in the page. */
function scriptBodies(file) {
  const out = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(file))) out.push(m[1]);
  return out;
}

/**
 * Functions declared at the TOP LEVEL of a script - reachable from code appended at the end of it.
 *
 * This replaced a regex sweep over the whole document with no notion of scope. On a page wrapping its
 * script in an IIFE that sweep produced the guidance line "this file defines render()" for a binding
 * that throws `render is not defined` at the planned site: a stated fact that is false where it would
 * be used, which is worse than saying nothing. Brace depth alone is not enough - a declaration inside
 * `(function () { ... })()` sits at brace depth 0 - so parenthesis depth is tracked too.
 */
export function topLevelFunctions(file) {
  const found = [];
  for (const body of scriptBodies(file)) {
    const src = structural(body);
    const depth = new Array(src.length);
    const pdepth = new Array(src.length);
    let d = 0, pd = 0;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (c === '}') d--; if (c === ')') pd--;
      depth[i] = d; pdepth[i] = pd;
      if (c === '{') d++; if (c === '(') pd++;
    }
    let m;
    const decl = /(?:^|[^.\w$])function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g;
    while ((m = decl.exec(src))) {
      const at = m.index + m[0].indexOf('function');
      if (depth[at] === 0 && pdepth[at] === 0) found.push({ name: m[1], params: m[2].trim() ? m[2].split(',').length : 0 });
    }
    const arrow = /(?:^|[^.\w$])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*=>/g;
    while ((m = arrow.exec(src))) {
      const at = m.index + m[0].search(/(?:const|let|var)/);
      if (depth[at] !== 0 || pdepth[at] !== 0) continue;
      const ps = m[2] !== undefined ? m[2] : m[3];
      found.push({ name: m[1], params: String(ps).trim() ? String(ps).split(',').length : 0 });
    }
  }
  const seen = new Set();
  return found.filter((f) => (seen.has(f.name) ? false : (seen.add(f.name), true)));
}

/** Every function name declared at any depth. Used only to RECORD what is out of reach from the site. */
export function allDeclaredFunctions(file) {
  const names = [];
  for (const body of scriptBodies(file)) {
    const src = structural(body);
    for (const m of src.matchAll(/(?:^|[^.\w$])function\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.push(m[1]);
    for (const m of src.matchAll(/(?:^|[^.\w$])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)) names.push(m[1]);
  }
  return [...new Set(names)];
}

/**
 * Does existing code already call this function, or hand it to a listener? A zero-argument function
 * nobody invokes is not the page's renderer; one that other code runs after changing something is the
 * route a new effect has to travel to become visible.
 */
export function referencedElsewhere(file, fn) {
  let uses = 0;
  for (const body of scriptBodies(file)) {
    const src = structural(body);
    for (const m of src.matchAll(new RegExp(`(?:^|[^.\\w$])${fn.name}\\s*(?:\\(|[,)])`, 'g'))) {
      const before = src.slice(Math.max(0, m.index - 24), m.index + m[0].indexOf(fn.name));
      if (/function\s*$/.test(before) || /(?:const|let|var)\s+$/.test(before)) continue;
      uses++;
    }
  }
  return uses > 0;
}

/** Where the page's script ends - the natural place for code that must run after everything exists. */
function endOfScript(file) {
  const ls = lines(file);
  for (let i = ls.length - 1; i >= 0; i--) if (/<\/script>/i.test(ls[i])) return i - 1;
  return ls.length - 1;
}

/** The last statement of the last handler body, for extending an existing handler. */
function findHandlerRegion(file, typeRe) {
  const ls = lines(file);
  for (let i = 0; i < ls.length; i++) {
    if (!typeRe.test(ls[i])) continue;
    let depth = 0, end = i;
    for (let j = i; j < ls.length; j++) {
      depth += (ls[j].match(/\{/g) || []).length - (ls[j].match(/\}/g) || []).length;
      end = j;
      if (j > i && depth <= 0) break;
    }
    return { start: i, end, text: ls.slice(i, end + 1).join(NL) };
  }
  return null;
}

/**
 * @param file        the application's source
 * @param requirement the structured requirement - trigger, effects, invariants
 * @param observation what `observationSelect` returned
 * @param facts       what `codeFacts.extractFacts` found, if available
 */
export function plan({ file, requirement, observation, facts = null }) {
  const surfaces = observation.surfaces || { inputs: [], clickables: [], forms: [], canvases: [] };
  const regs = observation.registrations || [];
  const selected = (observation.selected || []).map((s) => s.adapterId);
  const trigger = requirement.trigger || {};
  const evidence = [];
  const uncertainty = [];

  // ── the code tied to the requested effect ──
  const relevantCode = { handlers: [], functions: [], state: [] };
  for (const r of regs) relevantCode.handlers.push(`${r.type} on ${r.target}`);
  // FUNCTIONS REACHABLE FROM THE SITE, not every `function NAME(` in the file. This was a regex over the
  // whole document with no notion of scope, so a page wrapping its script in an IIFE produced the
  // guidance line "this file defines render()" for a binding that throws `render is not defined` at the
  // end of the script - guidance that actively misleads, which is worse than none. The moves that site
  // at end-of-script can only reach TOP-LEVEL declarations, so that is what is reported.
  const top = topLevelFunctions(file);
  relevantCode.functions = top.map((f) => f.name);
  relevantCode.notReachable = allDeclaredFunctions(file).filter((n) => !relevantCode.functions.includes(n));
  if (facts && facts.constraints) relevantCode.state = facts.constraints.map((c) => `${c.name} (${c.verdict}${c.declaredAtLine ? `, line ${c.declaredAtLine}` : ''})`);

  // A shared renderer is worth naming: an effect that must be VISIBLE usually has to go through it.
  // The renderer used to be read from `facts.redraws`, which the runner computes for a site at line 0 -
  // not the site being planned - and which fails outright on a page whose script is top-level. It was
  // null on every real filter page, so the single most useful thing to say ("the page updates through
  // refresh()") was never said. It is now derived from the file: a top-level zero-argument function that
  // other code already calls or hands to a listener.
  const rendererFn = top.find((f) => f.params === 0 && referencedElsewhere(file, f));
  const renderer = rendererFn ? rendererFn.name : ((facts && facts.redraws && facts.redraws[0]) ? facts.redraws[0].name : null);
  if (renderer) evidence.push(`the page has a zero-argument function ${renderer}() that existing code calls after changing state`);

  // ── the move, chosen from the requested behaviour and the structure ──
  let move = MOVE.DECLINE, site = null, scope = null, needed = null;

  if (trigger.kind === 'click') {
    // A click requirement may name a control that exists, or ask for one that does not.
    const wanted = trigger.selector || null;
    const existing = wanted ? surfaces.clickables.find((c) => c.selector === wanted) : null;
    if (existing) {
      const hasHandler = regs.some((r) => r.type === 'click');
      move = hasHandler ? MOVE.EXTEND_HANDLER : MOVE.ATTACH_TO_CONTROL;
      const region = findHandlerRegion(file, /addEventListener\(\s*['"]click['"]/);
      site = region ? { insertAfterLine: region.start, why: 'inside the existing click handling' } : { insertAfterLine: endOfScript(file), why: 'after the existing script, where the control is already in the document' };
      evidence.push(`the requirement names ${wanted}, and a control with that selector already exists`);
      evidence.push(hasHandler ? 'a click listener is already registered, so the change extends existing handling' : 'no click listener is registered, so a handler must be attached');
      scope = { creates: [], attaches: [wanted], calls: renderer ? [renderer] : [] };
    } else {
      move = MOVE.CREATE_CONTROL;
      site = { insertAfterLine: endOfScript(file), why: 'at the end of the script, after every element and function it must reference exists' };
      evidence.push(wanted ? `the requirement names ${wanted} and NO control with that selector exists, so one must be created and wired` : 'the requirement is triggered by a click and names no existing control');
      evidence.push(`the page's clickable controls are: ${surfaces.clickables.map((c) => c.selector).join(', ') || 'none'}`);
      scope = { creates: [wanted || 'a control'], attaches: [wanted || 'the new control'], calls: renderer ? [renderer] : [] };
      uncertainty.push('creating a control changes what the page shows, so the carried-forward checks must be read for anything that counts visible elements');
    }
  } else if (trigger.kind === 'key') {
    const kb = regs.filter((r) => ['keydown', 'keyup', 'keypress'].includes(r.type));
    if (kb.length) {
      move = MOVE.EXTEND_HANDLER;
      const region = findHandlerRegion(file, /addEventListener\(\s*['"]key(down|press|up)['"]/);
      site = { insertAfterLine: region ? region.start : endOfScript(file), why: 'inside the existing key handling' };
      evidence.push(`key handling already exists (${kb.map((r) => `${r.type} on ${r.target}`).join(', ')})`);
      scope = { creates: [], attaches: [], calls: renderer ? [renderer] : [] };
    } else {
      // IF THE REQUIREMENT ASKS FOR A KEY, SOMEONE ASKED FOR A KEY.
      //
      // An earlier version DECLINED here, reasoning that adding key handling to an input-driven page
      // would be "a keyboard shortcut nobody asked for". That was wrong twice over: the requirement is
      // exactly who asked for it, and refusing on the grounds that the selected adapter is browser.input
      // lets the ADAPTER DICTATE THE IMPLEMENTATION - the restriction this planner exists to remove. An
      // input-driven application can legitimately gain keyboard controls.
      //
      // So the requested listener is proposed. A decline is reserved for a concrete unsupported
      // capability or a requirement that cannot be resolved.
      move = MOVE.NEW_LISTENER;
      site = { insertAfterLine: endOfScript(file), why: 'at the end of the script, after every element and function the listener must reference exists' };
      evidence.push(`the requirement asks for key '${trigger.key}', and no key listener is registered anywhere, so the requested listener must be created`);
      evidence.push(`the application is driven by ${selected.join(', ') || 'a modality this planner did not identify'} - that informs how the effect is achieved, NOT whether the request is honoured`);
      scope = { creates: ['a keydown listener'], attaches: ['document'], calls: renderer ? [renderer] : [] };
      uncertainty.push('this application had no key handling before, so nothing establishes that a key press reaches it in the way the requirement assumes; the checks will settle it');
    }
  } else if (trigger.kind === 'type') {
    // A TYPING-TRIGGERED REQUIREMENT. This used to DECLINE, and AUDIT-2 stage 4 showed what that
    // costs: the manager could not attempt a match-count feature that the direct control completed
    // on its first call, on three pages out of three. A decline is not a neutral abstention when
    // the requirement is ordinary and the control can express it.
    //
    // The shape mirrors the click branch. What decides it is whether the EFFECTS name something
    // that does not exist yet:
    //   they do      create it and keep it current whenever the field changes
    //   they do not  extend the handling the field already has
    const field = trigger.selector || null;
    const wantedInEffects = (requirement.effects || []).join(' ').match(/#[A-Za-z][\w-]*/);
    const named = wantedInEffects ? wantedInEffects[0] : null;
    const existsAlready = named ? new RegExp(`id=["']${named.slice(1)}["']`).test(file) : false;
    const typeRegs = regs.filter((r) => ['input', 'change', 'keyup', 'keydown'].includes(r.type));
    if (named && !existsAlready) {
      move = MOVE.CREATE_CONTROL;
      site = { insertAfterLine: endOfScript(file), why: 'at the end of the script, after the field and every function it must reference exists' };
      evidence.push(`the requirement is triggered by typing into ${field || 'a field'} and its effects name ${named}, which does not exist, so it must be created`);
      evidence.push(`the effect must hold WHENEVER the field changes, so the new element has to be brought up to date from the field's own events, not once at load`);
      if (typeRegs.length) evidence.push(`the field already has ${typeRegs.map((r) => `${r.type} on ${r.target}`).join(', ')}, which is what existing code listens to`);
      scope = { creates: [named], attaches: [field || 'the field'], calls: renderer ? [renderer] : [] };
      uncertainty.push('adding a visible element changes what the page shows, so the carried-forward checks must be read for anything that counts visible elements');
      uncertainty.push('the effect must also be correct at LOAD, before anything is typed; nothing here establishes that a listener alone achieves that');
    } else if (typeRegs.length) {
      move = MOVE.EXTEND_HANDLER;
      const region = findHandlerRegion(file, /addEventListener\(\s*['"](input|change|keyup|keydown)['"]/);
      site = { insertAfterLine: region ? region.start : endOfScript(file), why: region ? 'inside the existing handling for this field' : 'after the existing script' };
      evidence.push(`typing into ${field || 'the field'} is already handled (${typeRegs.map((r) => `${r.type} on ${r.target}`).join(', ')}), so the change extends that handling`);
      scope = { creates: [], attaches: [], calls: renderer ? [renderer] : [] };
    } else {
      move = MOVE.NEW_LISTENER;
      site = { insertAfterLine: endOfScript(file), why: 'at the end of the script, after the field exists' };
      evidence.push(`the requirement is triggered by typing into ${field || 'a field'} and no input listener is registered anywhere, so one must be created`);
      scope = { creates: ['an input listener'], attaches: [field || 'the field'], calls: renderer ? [renderer] : [] };
    }
  } else {
    move = MOVE.DECLINE;
    needed = `this planner handles requirements triggered by a key press, a click or typing; this one is ${JSON.stringify(trigger)}`;
  }

  // The adapter INFORMS, it does not dictate: it is recorded as context for the choice, not as its cause.
  if (selected.length) evidence.push(`observation selected ${selected.join(', ')}, which says how the application is driven - it informs this choice and does not determine the implementation`);

  // ── what must still pass ──
  const preservationObligations = [
    'every carried-forward check, exactly as recorded from the baseline',
    ...(observation.selected || []).flatMap((s) => (s.effects || []).map((e) => `the confirmed behaviour: ${JSON.stringify(e.interaction)} must still produce its effect`)),
  ];

  // ── uncertainty ──
  if (observation.coverageLimits && observation.coverageLimits.anyDetected) {
    uncertainty.push('this application uses handler mechanisms the observer does not capture, so some behaviour may be unobserved and therefore unprotected');
  }
  for (const u of (observation.unresolved || [])) uncertainty.push(u);
  if (!renderer && move !== MOVE.DECLINE) uncertainty.push('no shared zero-argument renderer was identified, so a change may need to update the page itself rather than delegating');

  return {
    requestedEffect: {
      trigger, effects: requirement.effects || [], invariants: requirement.invariants || [],
      inUserTerms: `${trigger.kind === 'click' ? `clicking ${trigger.selector || 'a control'}`
        : trigger.kind === 'type' ? `typing into ${trigger.selector || 'the field'}`
          : `pressing ${trigger.key}`} must result in: ${(requirement.effects || []).join('; ')}`,
    },
    relevantCode,
    move, site, scope, needed,
    evidence,
    preservationObligations,
    uncertainty,
    declined: move === MOVE.DECLINE,
    observationInformed: selected,
    note: 'a proposal is a hypothesis about where work belongs. It is not permission to retain anything, and it does not define what the correct result is.',
  };
}

const DIRECT = process.argv[1] && (await import('node:url')).pathToFileURL(process.argv[1]).href === import.meta.url;
if (DIRECT) {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
  const DIR = opt('dir', null);
  const NAME = opt('name', 'baseline-as-delivered.html');
  const TRIGGER = opt('trigger', null);
  if (!DIR) { console.error('usage: node server/editPlanner.mjs --dir <page dir> [--trigger \'{"kind":"click","selector":"#clear"}\']'); process.exit(2); }
  const file = readFileSync(join(DIR, NAME), 'utf8');
  const { selectObservation } = await import('./observationSelect.mjs');
  const { extractFacts } = await import('./codeFacts.mjs');
  const ws = mkdtempSync(join(tmpdir(), 'plan-'));
  let obs;
  try { writeFileSync(join(ws, 'index.html'), file, 'utf8'); obs = await selectObservation(ws); }
  finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }

  let requirement;
  if (TRIGGER) requirement = { trigger: JSON.parse(TRIGGER), effects: ['the full list is shown again'], invariants: ['the filter keeps working'] };
  else if (existsSync(join(DIR, 'task.json'))) requirement = JSON.parse(readFileSync(join(DIR, 'task.json'), 'utf8')).requirement;
  else { console.error('no --trigger and no task.json'); process.exit(3); }

  let facts = null;
  try { facts = extractFacts(file, { rule: 'R2', insertAfterLine: endOfScript(file) }); } catch { /* optional */ }
  const p = plan({ file, requirement, observation: obs, facts });
  console.log(`${join(DIR, NAME)}   sha ${sha(file).slice(0, 16)}`);
  console.log(`\nREQUESTED EFFECT\n  ${p.requestedEffect.inUserTerms}`);
  console.log(`\nRELEVANT CODE\n  handlers : ${p.relevantCode.handlers.join(', ') || 'none'}\n  functions: ${p.relevantCode.functions.join(', ') || 'none'}\n  state    : ${p.relevantCode.state.join(', ') || 'none identified'}`);
  console.log(`\nPROPOSED MOVE\n  ${p.move}`);
  if (p.site) console.log(`  site: after line ${p.site.insertAfterLine} - ${p.site.why}`);
  if (p.scope) console.log(`  scope: creates [${p.scope.creates.join(', ') || '-'}], attaches [${p.scope.attaches.join(', ') || '-'}], calls [${p.scope.calls.join(', ') || '-'}]`);
  if (p.needed) console.log(`  DECLINED, and what would fit instead:\n    ${p.needed}`);
  console.log(`\nEVIDENCE`);
  for (const e of p.evidence) console.log(`  - ${e}`);
  console.log(`\nPRESERVATION OBLIGATIONS`);
  for (const o of p.preservationObligations) console.log(`  - ${o}`);
  console.log(`\nUNCERTAINTY`);
  for (const u of p.uncertainty) console.log(`  - ${String(u).slice(0, 150)}`);
}

export { endOfScript };

/**
 * The SCAFFOLD the proposal implies, and the guidance that goes with it.
 *
 * The move decides the shape: extending a key handler needs a trigger branch; creating a control or a
 * listener needs a bare slot at a point where everything it references already exists. The guidance
 * lines come from the proposal's own scope and evidence, so what the model is shown is what the planner
 * decided - not a second, parallel set of rules.
 */
export function planToScaffold(proposal, requirement, file) {
  const t = requirement.trigger || {};
  // INDENT FROM THE FILE AT THE SITE, not a constant. The constant eight spaces was written for a slot
  // inside a handler inside a function; at the top level of a page script it put the scaffold and every
  // guidance line eight columns out from the code around them, which is a prompt that does not look like
  // the file it is supposed to continue.
  const indent = (() => {
    if (typeof file !== 'string') return '        ';
    const ls = file.split(NL);
    for (let i = Math.min(proposal.site.insertAfterLine, ls.length - 1); i >= 0; i--) {
      if (ls[i].trim()) return (ls[i].match(/^[ 	]*/) || [''])[0];
    }
    return '';
  })();
  if (proposal.move === MOVE.EXTEND_HANDLER && t.kind === 'key') {
    return {
      lines: [`${indent}    if (e.key === '${t.key}') {`, `${indent}        // FILL IN`, `${indent}    }`],
      why: ['the trigger filter is supplied because the site is inside an existing key handler'],
    };
  }
  // Every other move is a bare slot: the model writes the whole construction, because creating a
  // control, attaching a handler or adding a listener has no fixed surrounding shape to supply.
  const why = [];
  if (proposal.scope && proposal.scope.creates.length) why.push(`the proposal is to create ${proposal.scope.creates.join(', ')} and wire it`);
  if (proposal.scope && proposal.scope.attaches.length) why.push(`attaching to ${proposal.scope.attaches.join(', ')}`);
  if (proposal.scope && proposal.scope.calls.length) why.push(`the page renders through ${proposal.scope.calls.join(', ')}`);
  return { lines: [`${indent}// FILL IN`], why };
}

/** The guidance lines the runner shows the model, taken from the proposal itself. */
export function planToGuidance(proposal) {
  const out = [];
  if (proposal.scope && proposal.scope.creates.length) out.push(`// create ${proposal.scope.creates.join(', ')} and attach the handler that does the work`);
  if (proposal.scope && proposal.scope.calls.length) out.push(`// the page updates through ${proposal.scope.calls.join(', ')}, which existing code calls after changing state`);
  for (const f of (proposal.relevantCode.functions || []).slice(0, 4)) out.push(`// FACT: this file defines ${f}()`);
  for (const h of (proposal.relevantCode.handlers || []).slice(0, 3)) out.push(`// FACT: a ${h} handler is registered`);
  return out;
}
