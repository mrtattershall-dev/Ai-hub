#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// adapters/browser.mjs — the browser adapters. Each proposes itself ONLY from evidence found in the
// running application: which listeners were registered, and which interaction surfaces exist.
//
// NOTHING HERE READS A NAME. Not a filename, not a task id, not a heading, not a comment. Page text and
// source comments are application DATA - a page that says "this is a filter" gets no different treatment
// from one that says nothing, and a file called `keyboard-game.html` containing a text input is probed
// as a text input.
//
// Evidence comes from `surfaceScan`: `registrations` are captured by patching addEventListener BEFORE
// any page script runs, so dynamically added and delegated handlers are seen too. A delegated handler is
// a listener on document/body that dispatches internally; the registration is visible even though the
// individual element has none, which is why registration capture beats element-level inspection.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { register } from './interface.mjs';

const has = (regs, type) => regs.some((r) => r.type === type);
const onGlobal = (regs, type) => regs.some((r) => r.type === type && ['document', 'window', 'body', 'html'].includes(r.target));

/** Keys tried, in this order. Declared once, never chosen per application. */
export const KEY_SET = ['a', 'b', 'c', '1', '2', '3', 'r', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
/**
 * Text typed into an input when probing it. BOTH HALVES ARE NEEDED.
 *
 * OBSEVAL-1 typed a fixed ['a', 'zzqq'] into a list of "Book 1".."Book 5". Neither matches, so the
 * filter was only ever exercised on its NEGATIVE half - it hid everything, correctly - and whether it
 * SHOWS matching items was never tested at all.
 *
 * A matching term is therefore derived FROM THE PAGE'S OWN VISIBLE TEXT. That is example input, not an
 * expected result: what the page SHOULD then show is judged against the filtering requirement, never
 * against what the page happens to do.
 */
export const NON_MATCHING = 'zzqq';
export function matchingTermFrom(samples) {
  for (const t of samples || []) {
    const word = String(t).trim().split(/\s+/).find((w) => /[A-Za-z]{3,}/.test(w));
    if (word) return word.slice(0, 4).toLowerCase();
  }
  return null;
}

register({
  id: 'browser.keyboard',
  domain: 'browser',
  propose(ev) {
    const kb = ev.registrations.filter((r) => ['keydown', 'keyup', 'keypress'].includes(r.type));
    if (!kb.length) {
      return [];
    }
    const global = kb.some((r) => ['document', 'window', 'body', 'html'].includes(r.target));
    return [{
      id: 'keyboard',
      adapterId: 'browser.keyboard',
      what: 'press keys and look for an observable effect',
      interactions: KEY_SET.map((k) => ({ kind: 'key', key: k })),
      evidence: kb.map((r) => `a ${r.type} listener was registered on ${r.target}`),
      uncertainty: global ? [] : [`the key listeners are on ${[...new Set(kb.map((r) => r.target))].join(', ')} and not on the document, so a key press may need that element focused first`],
      priority: global ? 10 : 6,
    }];
  },
  async probe(ctx, plan) { return ctx.runInteractions(plan.interactions); },
});

register({
  id: 'browser.input',
  domain: 'browser',
  propose(ev) {
    const fields = ev.surfaces.inputs.filter((i) => ['text', 'search', 'email', 'number', 'tel', 'url', ''].includes(i.type));
    if (!fields.length) return [];
    const listens = ev.registrations.filter((r) => ['input', 'change', 'keyup', 'keydown'].includes(r.type));
    // A field with no listener anywhere is still worth typing into: the page may re-render from a
    // framework-free polling loop, or the listener may be an inline attribute. The uncertainty says so.
    const match = matchingTermFrom(ev.atLoad && ev.atLoad.visibleSample);
    const texts = match ? [match, NON_MATCHING] : [NON_MATCHING];
    return fields.slice(0, 4).map((f) => ({
      id: `input:${f.selector}`,
      adapterId: 'browser.input',
      what: `type into ${f.selector} and look for an observable effect`,
      interactions: texts.map((t) => ({ kind: 'type', selector: f.selector, text: t })),
      evidence: [
        `a text-like input exists at ${f.selector}`,
        ...(match ? [`"${match}" is taken from the page's own visible text, so it should MATCH something`] : ['no word could be taken from the page to build a matching term, so only a non-matching one is tried']),
        ...(listens.length ? listens.map((r) => `a ${r.type} listener was registered on ${r.target}`) : []),
      ],
      uncertainty: [
        ...(listens.length ? [] : ['no input/change/key listener was recorded, so typing may produce nothing; that would be NO CHANGE OBSERVED, not an absence of behaviour']),
        ...(match ? [] : ['without a matching term only the negative half of a filter can be exercised']),
      ],
      priority: listens.length ? 9 : 4,
    }));
  },
  async probe(ctx, plan) { return ctx.runInteractions(plan.interactions); },
});

register({
  id: 'browser.click',
  domain: 'browser',
  propose(ev) {
    const targets = ev.surfaces.clickables.slice(0, 6);
    if (!targets.length) return [];
    const listens = ev.registrations.filter((r) => ['click', 'mousedown', 'mouseup', 'submit'].includes(r.type));
    const delegated = listens.some((r) => ['document', 'window', 'body', 'html'].includes(r.target));
    return [{
      id: 'click',
      adapterId: 'browser.click',
      what: 'click each clickable control and look for an observable effect',
      interactions: targets.map((t) => ({ kind: 'click', selector: t.selector })),
      evidence: [
        `${targets.length} clickable control(s): ${targets.map((t) => t.selector).join(', ')}`,
        ...listens.map((r) => `a ${r.type} listener was registered on ${r.target}`),
        ...(delegated ? ['at least one is on the document, so handling may be DELEGATED - individual elements need no listener of their own'] : []),
      ],
      uncertainty: listens.length ? [] : ['no click listener was recorded; the controls may be inert or handled by an inline attribute'],
      priority: listens.length ? 8 : 3,
    }];
  },
  async probe(ctx, plan) { return ctx.runInteractions(plan.interactions); },
});

register({
  id: 'browser.form',
  domain: 'browser',
  propose(ev) {
    if (!ev.surfaces.forms.length) return [];
    const listens = ev.registrations.filter((r) => r.type === 'submit');
    return ev.surfaces.forms.slice(0, 2).map((f) => ({
      id: `submit:${f.selector}`,
      adapterId: 'browser.form',
      what: `submit ${f.selector} and look for an observable effect`,
      interactions: [{ kind: 'submit', selector: f.selector }],
      evidence: [`a form exists at ${f.selector}`, ...listens.map((r) => `a submit listener was registered on ${r.target}`)],
      uncertainty: listens.length ? [] : ['no submit listener was recorded; submitting may navigate instead of updating in place'],
      priority: listens.length ? 7 : 2,
    }));
  },
  async probe(ctx, plan) { return ctx.runInteractions(plan.interactions); },
});

export const BROWSER_ADAPTER_IDS = ['browser.keyboard', 'browser.input', 'browser.click', 'browser.form'];
