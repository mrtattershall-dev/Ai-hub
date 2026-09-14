// BROWSER HARNESS for the DOM behavioural oracles (goals 49 and 59).
//
// Owns the http server, the puppeteer lifecycle and an ISOLATED storage context, and hands the
// probe a small set of behaviour-level helpers. Probes never touch puppeteer directly, so they
// cannot accidentally assert on implementation details.
//
// Storage isolation matters for goal 49 specifically: a probe that inherits storage from a previous
// run could pass by reading someone else's state. Each run gets a fresh browser context and clears
// storage before the first assertion.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const HUB = 'C:/Users/tatte/Projects/ai-coding-hub-indent/server/';
const require = createRequire(HUB + 'index.js');
const puppeteer = require('puppeteer');
const { launchOptions } = await import(pathToFileURL(HUB + 'browser.js').href);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runBrowserProbe(probe, ws, opts = {}) {
  const page0 = probe.lead || 's9_board.html';
  if (!existsSync(join(ws, page0))) return { pass: false, why: 'missing ' + page0 };

  const server = createServer((q, s) => {
    const f = join(ws, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (!f.startsWith(ws) || !existsSync(f) || statSync(f).isDirectory()) { s.writeHead(404); s.end('nope'); return; }
    s.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
    s.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port + '/' + page0;

  const browser = await puppeteer.launch(launchOptions());
  const context = browser.createBrowserContext ? await browser.createBrowserContext() : browser.defaultBrowserContext();
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).split('\n')[0]));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));

  const cardText = (el) => {
    const n = el.cloneNode(true);
    n.querySelectorAll('button, input').forEach((b) => b.remove());
    return n.textContent.replace(/\s+/g, ' ').trim();
  };

  const helpers = {
    cards: (col) => page.evaluate((c, fn) => {
      const f = new Function('return ' + fn)();
      return [...document.querySelectorAll('#' + c + ' .s9-card')].map(f);
    }, col, cardText.toString()),
    text: async (sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => null),
    storage: (key) => page.evaluate((k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, key),
    add: async (t) => {
      await page.$eval('#s9-new', (el) => { el.value = ''; el.focus(); });
      if (t) await page.type('#s9-new', t);
      await page.click('#s9-add');
      await sleep(50);
    },
    clickOn: async (col, label, cls) => {
      const ok = await page.evaluate((c, txt, k, fn) => {
        const f = new Function('return ' + fn)();
        for (const li of document.querySelectorAll('#' + c + ' .s9-card')) {
          if (f(li) === txt) { const b = li.querySelector('.' + k); if (!b) return false; b.click(); return true; }
        }
        return false;
      }, col, label, cls, cardText.toString());
      await sleep(50);
      return ok;
    },
    reload: async () => { await page.reload({ waitUntil: 'load' }); await sleep(120); },
  };

  let result;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 15000 });
    // Clean storage BEFORE the probe's first assertion, then reload so the page boots from empty.
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* blocked */ } });
    await page.reload({ waitUntil: 'load' });
    await sleep(120);
    result = await Promise.race([
      probe.run(page, helpers),
      sleep(opts.timeout || 30000).then(() => ({ pass: false, why: 'probe timed out' })),
    ]);
  } catch (e) {
    result = { pass: false, why: 'threw: ' + String(e.message).split('\n')[0].slice(0, 110) };
  } finally {
    await page.close().catch(() => {});
    if (context !== browser.defaultBrowserContext() && context.close) await context.close().catch(() => {});
    await browser.close().catch(() => {});
    server.close();
  }
  if (result && result.pass && errs.length) {
    return { pass: false, why: 'page error: ' + errs[0].slice(0, 90) };
  }
  return result;
}
