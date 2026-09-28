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
 * Probe the page: what is its state at load, and which declared keys change it? This is the page's
 * observed behaviour, discovered rather than interpreted.
 */
/**
 * The state a failing case reports, pulled back out of playCheck's message.
 *
 * Everything after `state ` is taken verbatim. The first version tried to recognise the VALUE with a
 * regex of alternatives, and returned null for `state "{\"value\":0}"` - a page whose state() hands back
 * a JSON *string* rather than an object. That is unusual but perfectly readable, and the regex would
 * have disqualified the page while reporting NO_READABLE_STATE, which is the wrong reason. Never let a
 * parser decide eligibility.
 */
const stateFromText = (text) => {
  const t = String(text || '').trim();
  const i = t.indexOf('; state ');
  if (i < 0) return null;
  const raw = t.slice(i + '; state '.length).trim();
  return raw.length ? raw : null;
};

/**
 * Probe the page. TWO runs, because they answer different questions and the first version conflated
 * them: a LOAD-ONLY run to see whether the page loads clean (eligibility rule 3 is about loading, not
 * about surviving a dozen key presses), then a KEY run to see which keys change the state.
 *
 * Every probe step asserts `false` ON PURPOSE. playCheck reports the state it saw only in a FAILING
 * case's message, so a probe whose steps pass tells you nothing - the first version printed seventeen
 * blank lines and would have let me "read" a page by inventing what it must have done.
 */
export async function probe(html, { playCheck }) {
  const run = async (steps) => {
    const ws = mkdtempSync(join(tmpdir(), 'sealed-'));
    try {
      writeFileSync(join(ws, 'index.html'), html, 'utf8');
      const spec = { entry: 'index.html', stateExpr: 'window.app.state()', contract: 'probe', steps };
      const r = await playCheck(ws, spec);
      return r;
    } finally { if (existsSync(ws)) { try { rmSync(ws, { recursive: true, force: true }); } catch { /* best effort */ } } }
  };

  const loadRun = await run([{ n: 1, name: 'load', do: [], expect: 'false' }]);
  if (loadRun.status !== 'OK') return { ok: false, reason: `the browser could not run the probe: ${loadRun.reason || ''}` };
  const loadState = stateFromText((loadRun.cases || [])[0]?.text);
  const loadErrors = loadRun.errors || [];

  const keys = [...PROBE_KEYS, ...RESET_KEY_CANDIDATES];
  const steps = [{ n: 1, name: 'load', do: [], expect: 'false' }];
  let n = 2;
  for (const k of keys) steps.push({ n: n++, name: `press ${k}`, do: [{ key: k }], expect: 'false' });
  const keyRun = await run(steps);
  if (keyRun.status !== 'OK') return { ok: false, reason: `the browser could not run the key probe: ${keyRun.reason || ''}` };

  const seen = (keyRun.cases || []).map((c) => ({ n: c.n, name: c.name, state: stateFromText(c.text) }));
  // A key RESPONDS if the state after pressing it differs from the state before. The presses are
  // cumulative, which is what a real user does, so "responds" means "changed something at that point".
  const responds = [];
  for (let i = 1; i < seen.length; i++) {
    const k = keys[i - 1];
    if (seen[i].state !== null && seen[i - 1].state !== null && seen[i].state !== seen[i - 1].state) responds.push(k);
  }
  return {
    ok: true, loadState, loadErrors, loadErrorCount: loadErrors.length,
    cases: seen, responds, keysProbed: keys,
    errorsDuringKeyRun: (keyRun.errors || []).length,
    dom: loadRun.dom, raw: { loadRun, keyRun },
  };
}

const DIRECT = process.argv[1] && (await import('node:url')).pathToFileURL(process.argv[1]).href === import.meta.url;
if (DIRECT) {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
  const DIR = opt('dir', null);
  if (!DIR) { console.error('usage: node server/sealedPage.mjs --dir <dir> [--emit]'); process.exit(2); }
  const file = join(DIR, 'baseline-as-delivered.html');
  const html = readFileSync(file, 'utf8');
  const gen = generationFacts(DIR);
  const parses = parseCheck(html);

  const fails = [];
  if (!gen.found) fails.push('NO_GENERATION_LOG: how this page was produced is not recorded');
  else if (gen.doneReason !== 'stop') fails.push(`TRUNCATED_GENERATION: doneReason was ${gen.doneReason}, so the page may be incomplete`);
  if (!parses.length) fails.push('NO_INLINE_SCRIPT');
  for (const p of parses) if (!p.ok) fails.push(`SCRIPT_DOES_NOT_PARSE: ${p.message}`);

  console.log(`dir            ${DIR}`);
  console.log(`sha256         ${sha(html).slice(0, 16)}   chars ${html.length}`);
  console.log(`generation     doneReason=${gen.doneReason}  attempts=${gen.attempts}`);
  console.log(`scripts        ${parses.length} inline, ${parses.filter((p) => p.ok).length} parse`);

  if (fails.length) {
    console.log(`\nINELIGIBLE:`);
    for (const f of fails) console.log(`  ${f}`);
    console.log('\nThis is an eligibility FAILURE and is recorded as one. The declared page order continues.');
    process.exit(0);
  }

  const { playCheck } = await import('./playCheck.js');
  const pr = await probe(html, { playCheck });
  if (!pr.ok) { console.log(`\nINELIGIBLE:\n  ${pr.reason}`); process.exit(0); }

  console.log(`errors AT LOAD  ${pr.loadErrorCount}`);
  console.log(`state at load   ${pr.loadState}`);
  console.log(`errors during the key run  ${pr.errorsDuringKeyRun}  (not an eligibility rule - rule 3 is about loading)`);
  console.log('\nprobe (cumulative presses, state after each):');
  for (const c of pr.cases) console.log(`  ${String(c.n).padStart(2)}. ${c.name.padEnd(16)} ${String(c.state).slice(0, 110)}`);
  console.log(`\nresponds to     ${pr.responds.length ? pr.responds.join(', ') : 'NOTHING'}`);

  const trigger = RESET_KEY_CANDIDATES.find((k) => !pr.responds.includes(k)) || null;
  if (pr.loadErrorCount > 0) fails.push(`ERRORS_AT_LOAD: ${pr.loadErrorCount}`);
  if (pr.loadState === null) fails.push('NO_READABLE_STATE: window.app.state() did not yield a readable value');
  if (!pr.responds.filter((k) => PROBE_KEYS.includes(k)).length) fails.push('NO_EXISTING_BEHAVIOUR: no probed key changed the state');
  if (!trigger) fails.push('NO_FREE_TRIGGER_KEY: the page already responds to every candidate trigger');

  if (fails.length) {
    console.log(`\nINELIGIBLE:`);
    for (const f of fails) console.log(`  ${f}`);
    console.log('\nThis is an eligibility FAILURE and is recorded as one. The declared page order continues.');
    process.exit(0);
  }
  console.log(`\nELIGIBLE. trigger key '${trigger}', existing behaviour on ${pr.responds.filter((k) => PROBE_KEYS.includes(k)).join(', ')}`);
}
