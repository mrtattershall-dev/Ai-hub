/**
 * browser.js - find the Chromium the verifiers drive.
 *
 * Both puppeteer.launch() call sites used to rely on puppeteer's own download cache
 * (~/.cache/puppeteer). That exists on a developer machine because `npm install` put
 * it there - it does NOT exist for someone who installed a packaged build, so the
 * Game tab and the agent's test_web would fail on a fresh machine with a confusing
 * "Could not find Chrome" error.
 *
 * Resolution order:
 *   1. PUPPETEER_EXECUTABLE_PATH   - explicit override
 *   2. vendor/chromium/            - bundled with a packaged build
 *   3. puppeteer's own cache       - the dev-machine case
 *   4. an installed Chrome/Edge    - so a slim build still works
 *
 * A packaged build should ship vendor/chromium/ plus its LICENSE (Chromium is BSD-3-
 * Clause plus other notices; ship the LICENSE file from the distribution you bundle).
 */
import { existsSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WIN = process.platform === 'win32';
const MAC = process.platform === 'darwin';

function firstFile(paths) {
  for (const p of paths) {
    try { if (p && existsSync(p) && statSync(p).isFile()) return p; } catch {}
  }
  return null;
}

// Walk a vendored browser directory looking for the executable, whatever the layout.
function findInVendor(root) {
  if (!existsSync(root)) return null;
  // ORDER MATTERS. chrome-headless-shell is a headless-only binary that does not accept
  // `headless: 'new'`; pairing them silently produced a browser that could not load the
  // CDN, and the Chromium verifier started reporting "Phaser never loaded" for code that
  // was perfectly fine. Full chrome first, headless-shell only as a fallback - and a
  // depth-first walk used to return whichever it happened to hit first.
  const names = WIN ? ['chrome.exe', 'msedge.exe', 'chrome-headless-shell.exe']
    : MAC ? ['Google Chrome', 'Chromium', 'chrome-headless-shell']
    : ['google-chrome', 'chrome', 'chromium', 'chrome-headless-shell'];
  const found = new Map();
  const stack = [root];
  let depth = 0;
  while (stack.length && depth < 5000) {
    depth++;
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (names.includes(e.name) && !found.has(e.name)) found.set(e.name, full);
    }
  }
  for (const n of names) if (found.has(n)) return found.get(n);   // preference order, not walk order
  return null;
}

export function resolveBrowser() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;

  const vendored = findInVendor(join(__dirname, '..', 'vendor', 'chromium'));
  if (vendored) return vendored;

  // puppeteer's own cache (present after npm install on a dev machine)
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const cache = join(home, '.cache', 'puppeteer');
  const fromCache = findInVendor(cache);
  if (fromCache) return fromCache;

  // A normal browser install, so a slim build still works.
  return firstFile(WIN ? [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ] : MAC ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ] : [
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ]);
}

const RESOLVED = resolveBrowser();

/** Launch options shared by every headless-browser caller. */
export function launchOptions(extra = {}) {
  // chrome-headless-shell is already headless and rejects the 'new' mode flag; full
  // chrome needs it. Match the flag to the binary rather than assuming.
  const shell = !!RESOLVED && /headless[-_]shell/i.test(RESOLVED);
  const opts = { headless: shell ? true : 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'], ...extra };
  if (RESOLVED) opts.executablePath = RESOLVED;
  return opts;
}

export function browserPath() { return RESOLVED; }
