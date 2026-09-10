/**
 * engineCache.js - external script bytes, fetched once and kept on disk.
 *
 * WHY IT IS SHARED
 * ----------------
 * Two different paths load a page in Chromium and judge what happens:
 *
 *   gameVerify.js  the Game tab / POST /api/game/verify - wraps a code string
 *   agent.js       test_web - loads the agent's OWN index.html from the workspace
 *
 * The cache lived inside gameVerify, so only the first was protected. `test_web` had no
 * request interception at all: every `<script src="https://cdn...">` in a page the agent
 * wrote went to the live network on every run. Measured 2026-09-10: jsdelivr answered with
 * something HTML-ish, the browser reported `Unexpected token '<'`, and that landed in the
 * tool result as a JS ERROR in the model's game. The model is then told its correct code
 * is broken - and that verdict feeds the finish gate, eval and harvest.
 *
 * A CDN blip must never be scored as broken code. That requires the SAME cache on both
 * paths, which requires it to live somewhere neither owns.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ENGINE_CACHE = join(__dirname, '.engine-cache');

const bytes = new Map();   // url -> Buffer, for the life of the process

/** Cache key. Flattened so one URL is one file, and no URL can escape the directory. */
const fileFor = (url) => join(ENGINE_CACHE, url.replace(/[^a-z0-9.]+/gi, '_'));

/**
 * The bytes for an external script, or null when it genuinely cannot be had.
 *
 * Null is a real answer and callers must treat it as INFRASTRUCTURE - refuse the request
 * and say so - never as evidence about the page.
 */
export async function loadEngineScript(url) {
  if (bytes.has(url)) return bytes.get(url);
  try {
    const cached = readFileSync(fileFor(url));
    bytes.set(url, cached);
    return cached;
  } catch { /* not cached yet - fall through to the network */ }

  // Twice, because the cold fetch is the one that matters: lose it and the page goes to
  // the CDN itself, where a slow 1.2MB download eats the navigation timeout and comes
  // back looking like broken code. A single retry turned that failure into a 4s pass.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      // A CDN answering 200 with an HTML error page is the exact shape of the bug this
      // module exists to stop: hand that to a <script> tag and the browser reports
      // `Unexpected token '<'` as a runtime error in the page. Refuse it rather than cache
      // a page of HTML under a .js name and reproduce the failure for ever.
      if (/^\s*</.test(buf.subarray(0, 64).toString('utf8'))) throw new Error('CDN returned HTML, not JavaScript');
      try { mkdirSync(ENGINE_CACHE, { recursive: true }); writeFileSync(fileFor(url), buf); }
      catch { /* an uncacheable disk is slow, not broken */ }
      bytes.set(url, buf);
      return buf;
    } catch {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

/**
 * Serve every external script in a page from the cache, and report the ones we could not.
 *
 * Attach before navigating. Returns the list of URLs that failed - which the caller MUST
 * report as infrastructure rather than as an error in the page.
 */
export async function serveScriptsFromCache(page, { onFailure } = {}) {
  const failures = [];
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const url = req.url();
    if (req.resourceType() !== 'script' || !/^https?:\/\//i.test(url) || /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(url)) {
      req.continue().catch(() => {});
      return;
    }
    const body = await loadEngineScript(url);
    if (body) {
      req.respond({ status: 200, contentType: 'application/javascript', body }).catch(() => {});
      return;
    }
    if (!failures.includes(url)) { failures.push(url); onFailure?.(url); }
    req.abort().catch(() => {});
  });
  return failures;
}
