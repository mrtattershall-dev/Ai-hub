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
 * Probe the page by OBSERVING it: `observeState.observe` loads it, reads the state expression, presses
 * each declared key and reads again, returning structured values.
 *
 * The previous version asserted `false` on every step so that playCheck would print the state inside a
 * failure message, then parsed it back out with a regex. That regex returned null for a state which was a
 * JSON *string*, and would have disqualified a readable page while reporting NO_READABLE_STATE - a true
 * verdict reached for a false reason. Reading the value directly removes the whole class.
 */
export async function probe(html) {
  const { observe, respondingKeys } = await import('./observeState.mjs');
  const ws = mkdtempSync(join(tmpdir(), 'sealed-'));
  try {
    writeFileSync(join(ws, 'index.html'), html, 'utf8');
    const keys = [...PROBE_KEYS, ...RESET_KEY_CANDIDATES];
    const r = await observe(ws, { keys });
    if (!r.ok) return { ok: false, reason: r.reason };
    const responds = respondingKeys(r.observations);
    return {
      ok: true,
      loadState: r.atLoad.threw ? null : r.atLoad.value,
      loadReadThrew: r.atLoad.threw ? r.atLoad.message : null,
      loadErrorCount: r.loadErrors.length,
      loadErrors: r.loadErrors,
      observations: r.observations,
      responds,
      respondsExisting: responds.filter((k) => PROBE_KEYS.includes(k)),
      errorsTotal: r.errors.length,
      readyState: r.readyState,
      keysProbed: keys,
    };
  } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
}

/**
 * The six eligibility rules, applied mechanically. Returned as a list of failures so a page is rejected
 * with EVERY reason it failed, not just the first one found.
 */
export function eligibility({ gen, parses, pr }) {
  const fails = [];
  if (!gen.found) fails.push('NO_GENERATION_LOG: how this page was produced is not recorded');
  else if (gen.doneReason !== 'stop') fails.push(`TRUNCATED_GENERATION: doneReason was ${gen.doneReason}, so the page may be incomplete`);
  if (!parses.length) fails.push('NO_INLINE_SCRIPT');
  for (const q of parses) if (!q.ok) fails.push(`SCRIPT_DOES_NOT_PARSE: ${q.message}`);
  if (!pr) return { eligible: false, fails, trigger: null };
  if (!pr.ok) { fails.push(`CANNOT_OBSERVE: ${pr.reason}`); return { eligible: false, fails, trigger: null }; }
  if (pr.loadErrorCount > 0) fails.push(`ERRORS_AT_LOAD: ${pr.loadErrorCount} - ${(pr.loadErrors[0] || '').slice(0, 120)}`);
  if (pr.loadReadThrew) fails.push(`STATE_READ_THREW_AT_LOAD: ${pr.loadReadThrew}`);
  else if (pr.loadState === null) fails.push('NO_READABLE_STATE: the state expression yielded nothing');
  if (!pr.respondsExisting.length) fails.push('NO_EXISTING_BEHAVIOUR: no probed key changed the state');
  const trigger = RESET_KEY_CANDIDATES.find((k) => !pr.responds.includes(k)) || null;
  if (!trigger) fails.push('NO_FREE_TRIGGER_KEY: the page already responds to every candidate trigger');
  // A state that becomes unreadable partway through is not a usable subject either: the checks would
  // fail for a reason that has nothing to do with the candidate.
  if (pr.observations.some((o) => o.threw)) fails.push('STATE_BECAME_UNREADABLE: reading the state threw after some key press');
  return { eligible: fails.length === 0, fails, trigger };
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
    console.log(`errors AT LOAD ${pr.loadErrorCount}   readyState ${pr.readyState}`);
    console.log(`state at load  ${pr.loadReadThrew ? 'READ THREW: ' + pr.loadReadThrew : JSON.stringify(pr.loadState)}`);
    for (const o of pr.observations.slice(1)) {
      console.log(`  after ${String(o.after).padEnd(12)} ${o.threw ? 'READ THREW' : JSON.stringify(o.value)}`);
    }
    console.log(`responds to    ${pr.respondsExisting.join(', ') || 'NOTHING'}`);
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
