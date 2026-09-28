#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// editPlanner.mjs — WHERE should the change go, and what shape should it take?
//
//   node server/editPlanner.mjs --dir <page dir>
//
// THE ASSUMPTION THIS REPLACES. `autoGuide.chooseSite` knows two moves: put a branch inside an existing
// keydown listener, or add a keydown listener after the last one. On a page with no keyboard handling at
// all it declines - correctly, by name - and OBSEVAL-1 stopped there. The fix is NOT "add a keyboard
// listener when none exists". That would keep the keyboard assumption and bolt a shortcut onto a website.
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
  const fnNames = [...file.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1])
    .concat([...file.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)].map((m) => m[1]));
  relevantCode.functions = [...new Set(fnNames)];
  if (facts && facts.constraints) relevantCode.state = facts.constraints.map((c) => `${c.name} (${c.verdict}${c.declaredAtLine ? `, line ${c.declaredAtLine}` : ''})`);

  // A shared renderer is worth naming: an effect that must be VISIBLE usually has to go through it.
  const renderer = (facts && facts.redraws && facts.redraws[0]) ? facts.redraws[0].name : null;
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
      // THE CASE THAT USED TO DECLINE. A key requirement on a page with no key handling is a genuine
      // mismatch between the requirement and the application, and the planner says so rather than
      // bolting a keyboard shortcut onto a website.
      move = MOVE.DECLINE;
      needed = 'the requirement is triggered by a key press, and this application has no key handling at all. Adding one would give a website a keyboard shortcut nobody asked for. A requirement stated in the modality the application actually uses - a control to click, or a change to an existing handler - would fit it.';
      evidence.push(`no key listener is registered anywhere; the application is driven by ${selected.join(', ') || 'something this planner did not identify'}`);
    }
  } else {
    move = MOVE.DECLINE;
    needed = `this planner handles requirements triggered by a key press or a click; this one is ${JSON.stringify(trigger)}`;
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
      inUserTerms: `${trigger.kind === 'click' ? `clicking ${trigger.selector || 'a control'}` : `pressing ${trigger.key}`} must result in: ${(requirement.effects || []).join('; ')}`,
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
