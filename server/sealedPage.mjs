#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// sealedPage.mjs — decide ELIGIBILITY and build the task, mechanically, for a sealed page.
//
//   node server/sealedPage.mjs --dir legasus/bench/counter          (eligibility only)
//   node server/sealedPage.mjs --dir legasus/bench/counter --emit   (also write the play spec)
//
// WHY THIS EXISTS. In ASSISTED-1 I chose the page, read it, decided what its own behaviour was, and
// picked the addition. Every one of those is a place where "the page that happened to be easiest" could
// win without anyone noticing. So for a sealed page all four are taken out of my hands:
//
//   THE ORDER          pages are tried in a FIXED, pre-declared order. The first ELIGIBLE one is used.
//                      Ineligibility is never a reason to move to a page that looks easier - it is
//                      recorded as a failure with its reason, and the order continues.
//   ELIGIBILITY        mechanical checks only, listed below, decided before the page is read by anyone.
//                      A TRUNCATED GENERATION IS AN ELIGIBILITY FAILURE: a page whose generation hit the
//                      token cap is not a valid subject, however good it might look.
//   OWN BEHAVIOUR      discovered by PROBING - which of a declared key list changes the state - not by
//                      reading the source and deciding what the page "meant".
//   THE ADDITION       one page-independent rule, fixed in advance: pressing a key the page does not
//                      currently handle returns every piece of state to what it was at load.
//
// ELIGIBILITY DOES NOT REQUIRE THE PAGE TO SATISFY THE ORIGINAL REQUEST, and that is a deliberate
// decision recorded here. Requiring it would let me discard pages until one complied, which is exactly
// the selection pressure this module exists to remove; and the experiment is about editing unfamiliar
// code, not about a page's fidelity to a prompt. What IS recorded, separately, is whether the request
// was fulfilled - because the carried-forward checks establish PRESERVATION of observed behaviour and
// nothing more. They never establish that the page did what was asked.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import * as acorn from 'acorn';

const sha = (t) => createHash('sha256').update(t).digest('hex');
const NL = String.fromCharCode(10);

/** The keys probed for existing behaviour, in this order. Declared, not chosen per page. */
export const PROBE_KEYS = ['1', '2', '3', 'a', 'b', 'c', 'r', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
/** The addition's trigger is the first of these the page does NOT respond to. */
export const RESET_KEY_CANDIDATES = ['0', 'z', 'Escape', 'Backspace'];

export function parseCheck(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (/\bsrc\s*=/i.test(m[1])) continue;
    const isModule = /\btype\s*=\s*['"]?module['"]?/i.test(m[1]);
    try { acorn.parse(m[2], { ecmaVersion: 2022, sourceType: isModule ? 'module' : 'script' }); out.push({ ok: true }); }
    catch (e) { out.push({ ok: false, message: String(e.message) }); }
  }
  return out;
}

/** What the generation log says about how this page was produced. Truncation is disqualifying. */
export function generationFacts(dir) {
  const p = join(dir, 'GENERATION-LOG.txt');
  if (!existsSync(p)) return { found: false };
  const text = readFileSync(p, 'utf8');
  const blocks = text.split(/\n\s*\n/).filter((b) => b.includes('sha256'));
  const last = blocks[blocks.length - 1] || '';
  const field = (n) => (new RegExp(`^${n}\\s+(.*)$`, 'm').exec(last) || [])[1];
  const dr = /doneReason\s+(\S+)/.exec(last);
  return {
    found: true, sha256: field('sha256'), outName: field('out'),
    doneReason: dr ? dr[1] : null, ask: field('ask'), attempts: blocks.length,
  };
}

/**
 * Probe the page by SELECTING AN OBSERVATION METHOD FOR IT.
 *
 * This used to press a fixed list of keys and nothing else. On BATCH-1 that reported a working
 * input-driven filter as having no behaviour - conflating "our observation method is unsuitable" with
 * "the application does nothing", and writing off two of four applications on the strength of it.
 *
 * It now asks `observationSelect`, which inspects the application's real interaction surfaces and
 * listener registrations, proposes candidate methods with their evidence and uncertainty, probes them in
 * isolated pages within a frozen budget, and keeps the ones that produced an observable effect. No name,
 * filename or comment influences the choice.
 */
export async function probe(html) {
  const { selectObservation } = await import('./observationSelect.mjs');
  const ws = mkdtempSync(join(tmpdir(), 'sealed-'));
  try {
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    const sel = await selectObservation(ws);
    if (!sel.ok) return { ok: false, reason: sel.reason };

    // The keys that were CONFIRMED to do something, taken from the probes rather than assumed. Used by
    // the task emitter, which today can only build key-driven checks.
    const keyEffects = [];
    for (const pr of sel.probes) {
      if (pr.adapterId !== 'browser.keyboard') continue;
      for (const e of pr.effective) if (e.interaction.kind === 'key') keyEffects.push(e.interaction.key);
    }
    return {
      ok: true,
      selection: sel,
      outcome: sel.outcome,
      selectedAdapters: sel.selected.map((x) => x.adapterId),
      loadErrorCount: sel.loadErrors.length,
      loadErrors: sel.loadErrors,
      loadState: sel.atLoad ? sel.atLoad.seam : null,
      loadReadThrew: sel.atLoad ? sel.atLoad.seamThrew : null,
      respondsExisting: [...new Set(keyEffects)],
      responds: [...new Set(keyEffects)],
      observations: [],
      unresolved: sel.unresolved,
    };
  } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
}

/**
 * The eligibility rules, applied mechanically, now expressed over the OBSERVATION OUTCOMES rather than
 * over a fixed key probe. A page is rejected with every reason it failed, and the reasons distinguish a
 * fault in the application from a limit of ours.
 */
export function eligibility({ gen, parses, pr }) {
  const fails = [];
  if (!gen.found) fails.push('NO_GENERATION_LOG: how this page was produced is not recorded');
  else if (gen.doneReason !== 'stop') fails.push(`TRUNCATED_GENERATION: doneReason was ${gen.doneReason}, so the page may be incomplete`);
  if (!parses.length) fails.push('NO_INLINE_SCRIPT');
  for (const q of parses) if (!q.ok) fails.push(`SCRIPT_DOES_NOT_PARSE: ${q.message}`);
  if (!pr) return { eligible: false, fails, trigger: null };
  if (!pr.ok) { fails.push(`CANNOT_OBSERVE: ${pr.reason}`); return { eligible: false, fails, trigger: null }; }

  switch (pr.outcome) {
    case 'BASELINE_ERROR':
      fails.push(`ERRORS_AT_LOAD: ${pr.loadErrorCount} - ${(pr.loadErrors[0] || '').slice(0, 120)}`);
      break;
    case 'UNSUPPORTED_OBSERVATION':
      fails.push('UNSUPPORTED_OBSERVATION: no registered adapter could propose a way to interact with this application. This is a limit of our adapters, NOT a finding about the application.');
      break;
    case 'PROBE_ERROR':
      fails.push('PROBE_ERROR: the probes could not be executed, so nothing is known about the application');
      break;
    case 'NO_CHANGE_OBSERVED':
      fails.push('NO_CHANGE_OBSERVED_UNDER_THE_PROBES_ATTEMPTED: every proposed interaction ran and none changed the seam, the DOM or the canvas. This is NOT a finding that the application has no behaviour.');
      break;
    default: break;
  }

  // THE CHECK HARNESS IS NARROWER THAN THE OBSERVER, and that gap is reported rather than hidden.
  // `playCheck` executes `{ key }` steps only, so an application whose confirmed behaviour is
  // input-driven or click-driven can be OBSERVED but its checks cannot yet be RUN. A required check that
  // cannot run must never become a pass, so such a page is not eligible for a task - and the reason says
  // which adapter would be needed.
  if (pr.outcome === 'CONFIRMED_BEHAVIOUR') {
    const nonKey = (pr.selectedAdapters || []).filter((a) => a !== 'browser.keyboard');
    if (!pr.respondsExisting.length) {
      fails.push(`CHECKS_UNSUPPORTED_FOR_SELECTED_ADAPTER: behaviour was CONFIRMED via ${nonKey.join(', ') || 'a non-keyboard adapter'}, but the check harness executes key interactions only. The application is observable; our checks are not yet. NOT a defect of the application.`);
    }
  }

  const trigger = RESET_KEY_CANDIDATES.find((k) => !pr.responds.includes(k)) || null;
  if (pr.outcome === 'CONFIRMED_BEHAVIOUR' && pr.respondsExisting.length && !trigger) {
    fails.push('NO_FREE_TRIGGER_KEY: the page already responds to every candidate trigger');
  }
  return { eligible: fails.length === 0, fails, trigger, outcome: pr.outcome, selectedAdapters: pr.selectedAdapters || [] };
}

const DIRECT = process.argv[1] && (await import('node:url')).pathToFileURL(process.argv[1]).href === import.meta.url;
if (DIRECT) {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
  const DIR = opt('dir', null);
  const NAME = opt('name', 'baseline-as-delivered.html');
  if (!DIR) { console.error('usage: node server/sealedPage.mjs --dir <dir> [--name <file>]'); process.exit(2); }
  const file = join(DIR, NAME);
  const html = readFileSync(file, 'utf8');
  const gen = generationFacts(DIR);
  const parses = parseCheck(html);
  const cheapFails = eligibility({ gen, parses, pr: null }).fails;

  console.log(`dir            ${DIR}/${NAME}`);
  console.log(`sha256         ${sha(html).slice(0, 16)}   chars ${html.length}`);
  console.log(`generation     doneReason=${gen.doneReason}`);
  console.log(`scripts        ${parses.length} inline, ${parses.filter((q) => q.ok).length} parse`);

  // Only observe if the cheap rules pass - there is nothing to learn from driving a truncated file.
  const pr = cheapFails.length ? null : await probe(html);
  const v = eligibility({ gen, parses, pr });

  if (pr && pr.ok) {
    console.log(`errors AT LOAD ${pr.loadErrorCount}`);
    console.log(`observation    ${pr.outcome}   adapters selected: ${pr.selectedAdapters.join(', ') || 'none'}`);
    console.log(`state at load  ${pr.loadReadThrew ? 'READ THREW: ' + pr.loadReadThrew : JSON.stringify(pr.loadState)}`);
    console.log(`keys confirmed ${pr.respondsExisting.join(', ') || 'none'}`);
    for (const u of pr.unresolved || []) console.log(`  unresolved: ${String(u).slice(0, 150)}`);
  }

  if (!v.eligible) {
    console.log(`\nINELIGIBLE:`);
    for (const f of v.fails) console.log(`  ${f}`);
    console.log('\nRecorded as an eligibility FAILURE. The declared page order continues.');
    process.exit(1);
  }
  console.log(`\nELIGIBLE. trigger key '${v.trigger}', existing behaviour on ${pr.respondsExisting.join(', ')}`);
  process.exit(0);
}
