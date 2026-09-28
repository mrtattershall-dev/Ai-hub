#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// actions.mjs — ONE structured action vocabulary, used by the PROBER and by the CHECKER.
//
// The observation layer decides how to interact with an application; the check harness then has to
// perform the SAME interactions to verify it. If the two had separate vocabularies, the manager could
// select an interaction it cannot later check - which is how BATCH-1 ended up able to observe only what
// it could already test.
//
//   { kind: 'key',   key: 'a', times?, delayMs? }           press a key
//   { kind: 'type',  selector: '#filter', text: 'al' }      focus, clear, type, dispatch input+change
//   { kind: 'click', selector: '#go' }                      click a named element
//   { kind: 'submit', selector: 'form' }                    dispatch a submit event
//   { kind: 'wait',  ms: 100 }                              let something settle
//
// UNSUPPORTED ACTIONS MUST BLOCK, NEVER PASS SILENTLY. `perform` throws `UnsupportedAction` for anything
// it does not implement, and callers are required to surface that as an error rather than skipping it.
// The check harness used to test `if (act.key) ... if (act.click) ...` and ignore anything else, so a
// step asking for an action it could not do would run zero interactions and could still be scored PASS.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export class UnsupportedAction extends Error {
  constructor(act) {
    super(`unsupported action: ${JSON.stringify(act).slice(0, 120)}`);
    this.name = 'UnsupportedAction';
    this.action = act;
  }
}

export const ACTION_KINDS = ['key', 'type', 'click', 'submit', 'wait'];

/** Interaction kinds this vocabulary does NOT cover. Reported, never silently skipped. */
export const NOT_SUPPORTED = ['drag', 'hover', 'scroll', 'select-option', 'file-upload', 'paste', 'touch', 'timer-driven updates', 'navigation'];

/** Normalise the older shorthand forms so one vocabulary covers both old specs and new ones. */
export function normalise(act) {
  if (!act || typeof act !== 'object') throw new UnsupportedAction(act);
  if (act.kind) return act;
  if (act.key !== undefined) return { kind: 'key', key: act.key, times: act.times, delayMs: act.delayMs };
  if (act.click !== undefined) return { kind: 'click', selector: act.click };
  if (act.waitMs !== undefined) return { kind: 'wait', ms: act.waitMs };
  // `{ type: 'abc' }` in the old specs meant "type at whatever has focus". That is ambiguous once a page
  // has more than one field, so it is only accepted with an explicit selector.
  if (act.type !== undefined && act.selector === undefined) throw new UnsupportedAction(act);
  if (act.type !== undefined) return { kind: 'type', selector: act.selector, text: String(act.type) };
  throw new UnsupportedAction(act);
}

export function isSupported(act) {
  try { const n = normalise(act); return ACTION_KINDS.includes(n.kind); }
  catch { return false; }
}

export function describe(act) {
  const a = normalise(act);
  if (a.kind === 'key') return `press ${a.key}`;
  if (a.kind === 'type') return `type ${JSON.stringify(a.text)} into ${a.selector}`;
  if (a.kind === 'click') return `click ${a.selector}`;
  if (a.kind === 'submit') return `submit ${a.selector}`;
  if (a.kind === 'wait') return `wait ${a.ms}ms`;
  return JSON.stringify(a);
}

/**
 * Perform one action on a puppeteer page. Throws UnsupportedAction for anything unimplemented, and lets
 * real failures (a missing selector, say) propagate - a check that cannot be performed is not a pass.
 */
export async function perform(page, actIn, { settleMs = 40 } = {}) {
  const act = normalise(actIn);
  switch (act.kind) {
    case 'key': {
      for (let i = 0; i < (act.times || 1); i++) {
        await page.keyboard.press(act.key);
        await new Promise((r) => setTimeout(r, act.delayMs ?? settleMs));
      }
      return;
    }
    case 'type': {
      await page.focus(act.selector);
      await page.evaluate((s) => { const e = document.querySelector(s); if (e) e.value = ''; }, act.selector);
      await page.type(act.selector, act.text, { delay: 5 });
      // Dispatch what pages actually listen for. `page.type` fires key events; a page bound to `input`
      // or `change` alone would otherwise look inert.
      await page.evaluate((s) => {
        const e = document.querySelector(s);
        if (!e) return;
        e.dispatchEvent(new Event('input', { bubbles: true }));
        e.dispatchEvent(new Event('change', { bubbles: true }));
      }, act.selector);
      await new Promise((r) => setTimeout(r, settleMs));
      return;
    }
    case 'click': {
      await page.click(act.selector);
      await new Promise((r) => setTimeout(r, settleMs));
      return;
    }
    case 'submit': {
      await page.evaluate((s) => {
        const f = document.querySelector(s);
        if (!f) throw new Error(`no element matches ${s}`);
        f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }, act.selector);
      await new Promise((r) => setTimeout(r, settleMs));
      return;
    }
    case 'wait': {
      await new Promise((r) => setTimeout(r, act.ms ?? settleMs));
      return;
    }
    default:
      throw new UnsupportedAction(act);
  }
}

/**
 * What the page shows, as structured data for expectations to read.
 *
 * `visible` is the DOWNSTREAM result - the text a user can see. `inputValues` is kept SEPARATE because
 * typing changes an input's own value whether or not the application does anything with it: a DOM digest
 * that folded the two together would call every keystroke "behaviour".
 */
export const DOM_VIEW = `() => {
  const visible = [];
  const hidden = [];
  for (const el of document.body ? document.body.querySelectorAll('*') : []) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
    const s = getComputedStyle(el);
    const shown = s.display !== 'none' && s.visibility !== 'hidden' && !el.hasAttribute('hidden');
    if (el.children.length === 0 && (el.textContent || '').trim()) {
      (shown ? visible : hidden).push((el.textContent || '').trim());
    }
  }
  const inputValues = {};
  for (const el of document.querySelectorAll('input, textarea, select')) {
    const key = el.id ? '#' + el.id : el.name || el.tagName.toLowerCase();
    inputValues[key] = el.value;
  }
  return { visible, hidden, inputValues, visibleCount: visible.length };
}`;

export async function readDom(page) {
  try { return await page.evaluate(`(${DOM_VIEW})()`); }
  catch (e) { return { visible: [], hidden: [], inputValues: {}, visibleCount: 0, __error: String(e.message || e) }; }
}
