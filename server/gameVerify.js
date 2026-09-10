/**
 * gameVerify.js — run Game-tab code in REAL headless Chromium and report whether it
 * actually works, instead of only showing it in an iframe.
 *
 * The iframe preview tells you what a game LOOKS like; it can't tell you whether the
 * engine loaded, whether anything rendered, or whether an error fired before first
 * paint. This does, by loading the identical wrapper HTML in Chromium (already on disk
 * via puppeteer, same launch flags as agent.js `test_web`) and collecting:
 *   - page errors / console errors / failed network requests (e.g. a dead CDN)
 *   - whether the engine global (Phaser / PIXI / THREE) actually exists
 *   - whether a <canvas> was created and has non-zero size  -> "it rendered"
 *   - a screenshot, so a human sees the real frame
 *
 * POST /api/game/verify  { engine, code }  ->  { ok, verdict, checks, errors, shot }
 */
import { Router } from 'express';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { launchOptions } from './browser.js';
import { ENGINES, engineOr, engineHead } from '../shared/engines.js';
import * as assets from './assets.js';

const require = createRequire(import.meta.url);

const MAX_CODE = 200_000;
const NAV_TIMEOUT = 20_000;
const SETTLE_MS = 1200;          // let the engine boot + render a frame or two

// Same document the iframe preview builds (shared head), minus the postMessage
// bridge - here we read errors from the CDP session instead of the parent window.
// A base URL so RELATIVE asset paths resolve to something interceptable.
//
// page.setContent() leaves the document at about:blank, against which `assets/hero.png`
// resolves to nothing at all - which is the entire reason asset-loading code could not be
// verified, and therefore why the training gate had to reject it outright. Giving the
// document a base turns that into an ordinary absolute request we can answer from the
// manifest. The host is deliberately unroutable: every request to it is served locally or
// fails loudly, never silently over the network.
const ASSET_HOST = 'http://hub-assets.invalid/';

/**
 * Serve the asset library to the page under test.
 *
 * Returns { used, missing } so the verdict can say WHICH asset was wrong. A missing
 * sprite otherwise shows up as a blank canvas and an unexplained failure - and telling a
 * model "you asked for assets/hero.png, which does not exist" is the difference between
 * a fixable error and a mystery.
 */
async function attachAssetInterception(page, errors) {
  const used = [];
  const missing = [];
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(ASSET_HOST)) { req.continue().catch(() => {}); return; }
    const want = url.slice(ASSET_HOST.length);
    let hit = null;
    try { hit = assets.resolve(want); } catch { hit = null; }
    if (!hit) {
      if (!missing.includes(want)) missing.push(want);
      errors.push(`[ASSET 404] ${want} - not in the asset library`);
      req.respond({
        status: 404, contentType: 'text/plain',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: 'not in the asset library',
      }).catch(() => {});
      return;
    }
    try {
      const body = readFileSync(hit.full);
      if (!used.includes(hit.path)) used.push(hit.path);
      req.respond({ status: 200, contentType: hit.mime, headers: { 'Access-Control-Allow-Origin': '*' }, body })
        .catch(() => {});
    } catch (e) {
      errors.push(`[ASSET READ] ${want} - ${e.message}`);
      req.respond({
        status: 500, contentType: 'text/plain',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: 'read failed',
      }).catch(() => {});
    }
  });
  return { used, missing };
}

function buildDoc(engineId, code) {
  return '<!DOCTYPE html><html><head>\n<base href="' + ASSET_HOST + '">\n' + engineHead(engineId) + '\n</head><body>\n'
    + '<script>\ntry {\n' + code
    + '\n} catch (err) { window.__gameError = String((err && err.message) || err); throw err; }\n<\/script>\n'
    + '</body></html>';
}

export default function gameVerifyRouter() {
  const router = Router();

  router.post('/verify', async (req, res) => {
    const { engine = 'phaser', code = '' } = req.body || {};
    if (!ENGINES[engine]) return res.status(400).json({ error: `unknown engine "${engine}"` });
    if (typeof code !== 'string' || !code.trim()) return res.status(400).json({ error: 'no code supplied' });
    if (code.length > MAX_CODE) return res.status(413).json({ error: `code too large (${code.length} > ${MAX_CODE})` });

    let puppeteer;
    try { puppeteer = require('puppeteer'); }
    catch { return res.status(500).json({ error: 'puppeteer is not installed on the server' }); }

    const eng = engineOr(engine);
    const errors = [];
    let browser;
    try {
      browser = await puppeteer.launch(launchOptions());
      const page = await browser.newPage();
      await page.setViewport({ width: 800, height: 600 });

      page.on('pageerror', (e) => errors.push(`[JS ERROR] ${e.message}`));
      page.on('console', (m) => {
        if (m.type() !== 'error' && m.type() !== 'warning') return;
        const t = m.text();
        if (/Failed to load resource/i.test(t)) return;   // real 404s captured below, with URL
        errors.push(`[console.${m.type()}] ${t}`);
      });
      page.on('requestfailed', (r) => errors.push(`[NETWORK] ${r.failure()?.errorText || 'failed'} — ${r.url()}`));
      page.on('response', (r) => { if (r.status() >= 400) errors.push(`[HTTP ${r.status()}] ${r.url()}`); });

      const assetTrace = await attachAssetInterception(page, errors);

      await page.setContent(buildDoc(engine, code), { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
      await new Promise((r) => setTimeout(r, SETTLE_MS));

      const checks = await page.evaluate((globalName) => {
        const c = document.querySelector('canvas');
        return {
          engineLoaded: typeof window[globalName] !== 'undefined',
          canvasFound: !!c,
          canvasWidth: c ? c.width : 0,
          canvasHeight: c ? c.height : 0,
          thrownAtTopLevel: window.__gameError || null,
        };
      }, eng.global);

      const shot = await page.screenshot({ type: 'jpeg', quality: 60, encoding: 'base64' });
      await browser.close();
      browser = null;

      checks.rendered = checks.canvasFound && checks.canvasWidth > 0 && checks.canvasHeight > 0;
      const hardErrors = errors.filter((e) => e.startsWith('[JS ERROR]') || e.startsWith('[NETWORK]'));
      // A missing asset is a FAILURE, not a warning. Phaser paints a green placeholder for
      // a texture that 404'd and carries on, so the canvas renders and every other check
      // passes - measured 2026-09-09: a game whose sprite did not exist came back
      // "Runs clean". If that stood, the training gate (which rejects unknown asset
      // paths) and the verifier (which is meant to be the ground truth) would disagree,
      // and the eval would pass code that draws a placeholder where the art should be.
      const missingAssets = assetTrace.missing.length > 0;
      const ok = checks.engineLoaded && checks.rendered && hardErrors.length === 0 && !checks.thrownAtTopLevel && !missingAssets;

      let verdict;
      if (!checks.engineLoaded) verdict = `${eng.label} never loaded — the CDN script failed or was blocked.`;
      else if (checks.thrownAtTopLevel) verdict = `Code threw before it finished: ${checks.thrownAtTopLevel}`;
      else if (missingAssets) verdict = `Loads ${assetTrace.missing.length} asset(s) that do not exist: ${assetTrace.missing.slice(0, 3).join(', ')}${assetTrace.missing.length > 3 ? ', …' : ''}. Use list_assets for exact names.`;
      else if (!checks.canvasFound) verdict = `${eng.label} loaded but no <canvas> was created — nothing rendered.`;
      else if (!checks.rendered) verdict = `A <canvas> exists but has zero size (${checks.canvasWidth}x${checks.canvasHeight}).`;
      else if (hardErrors.length) verdict = `Rendered, but ${hardErrors.length} runtime error(s) fired.`;
      else if (errors.length) verdict = `Runs clean. ${errors.length} warning(s) worth a look.`;
      else verdict = `Runs clean in Chromium — ${eng.label} loaded and rendered ${checks.canvasWidth}x${checks.canvasHeight}.`;

      res.json({
        ok, verdict, engine, checks,
        // What the code actually asked the library for. `assetsMissing` is the useful
        // half: it names the exact filename that does not exist.
        assetsUsed: assetTrace.used,
        assetsMissing: assetTrace.missing,
        assetVersion: assets.version(),
        errors: errors.slice(0, 30),
        shot: `data:image/jpeg;base64,${shot}`,
      });
    } catch (e) {
      try { if (browser) await browser.close(); } catch {}
      res.status(500).json({
        ok: false,
        verdict: `Verification failed to run: ${e.message}`,
        engine,
        checks: null,
        errors: errors.slice(0, 30),
        shot: null,
      });
    }
  });

  return router;
}
