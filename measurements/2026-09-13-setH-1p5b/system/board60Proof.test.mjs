// BEHAVIOURAL PROOF FOR THE POST-GOAL-60 BOARD, driven through a real browser.
//
// Goals 49 and 59 INTERACT, so proving them independently is not enough. The cumulative invariant is
// not "persistence works" and "the limit works" side by side, but:
//
//     persistence still works UNDER the Doing constraint, and a REJECTED operation does not become
//     persisted state.
//
// Two independently correct per-goal implementations could both pass their own probe and still fail
// that - which is exactly why the seed is proven as a whole rather than assembled from parts.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync, copyFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const HUB = 'C:/Users/tatte/Projects/ai-coding-hub-indent/server/';
const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const require = createRequire(HUB + 'index.js');
const puppeteer = require('puppeteer');
const { launchOptions } = await import(pathToFileURL(HUB + 'browser.js').href);

let pass = 0;
let fail = 0;
const t = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '   got ' + JSON.stringify(detail) : '')); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

// The workspace is the post-40 seed overlaid with the post-60 files, exactly as the seed will ship.
const ws = mkdtempSync(join(tmpdir(), 'board60-'));
for (const f of readdirSync(join(HERE, 'seed'))) {
  const p = join(HERE, 'seed', f);
  if (statSync(p).isFile()) copyFileSync(p, join(ws, f));
}
for (const f of readdirSync(join(HERE, 'seed60'))) copyFileSync(join(HERE, 'seed60', f), join(ws, f));

const server = createServer((q, s) => {
  const f = join(ws, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  if (!existsSync(f) || statSync(f).isDirectory()) { s.writeHead(404); s.end('nope'); return; }
  s.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
  s.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = 'http://127.0.0.1:' + server.address().port + '/s9_board.html';

const browser = await puppeteer.launch(launchOptions());
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).split('\n')[0]));
await page.goto(url, { waitUntil: 'load', timeout: 15000 });
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* blocked */ } });
await page.reload({ waitUntil: 'load' });
await sleep(120);

const cardText = (el) => {
  const n = el.cloneNode(true);
  n.querySelectorAll('button, input').forEach((b) => b.remove());
  return n.textContent.replace(/\s+/g, ' ').trim();
};
const cards = (col) => page.evaluate((c, fn) => {
  const f = new Function('return ' + fn)();
  return [...document.querySelectorAll('#' + c + ' .s9-card')].map(f);
}, col, cardText.toString());
const board = async () => [await cards('s9-todo'), await cards('s9-doing'), await cards('s9-done')];
const msg = () => page.$eval('#s9-msg', (el) => el.textContent.trim()).catch(() => null);
const counts = () => page.evaluate(() => ['todo', 'doing', 'done'].map((k) => document.getElementById('s9-count-' + k).textContent));
const stored = () => page.evaluate(() => { try { return localStorage.getItem('s9-board'); } catch (e) { return null; } });
const reload = async () => { await page.reload({ waitUntil: 'load' }); await sleep(120); };
const add = async (text) => {
  await page.$eval('#s9-new', (el) => { el.value = ''; el.focus(); });
  if (text) await page.type('#s9-new', text);
  await page.click('#s9-add');
  await sleep(45);
};
const clickOn = async (col, label, cls) => {
  const ok = await page.evaluate((c, txt, k, fn) => {
    const f = new Function('return ' + fn)();
    for (const li of document.querySelectorAll('#' + c + ' .s9-card')) {
      if (f(li) === txt) { const b = li.querySelector('.' + k); if (!b) return false; b.click(); return true; }
    }
    return false;
  }, col, label, cls, cardText.toString());
  await sleep(45);
  return ok;
};

console.log('  goals 9/19/29/39 must still hold\n');
await add('one');
// Checked immediately after a REAL add: a blank add returns early and does not clear, which is the
// same behaviour the post-40 seed was proven with. Asserting it after a blank add tests the wrong
// thing.
t('goal 9: the input is cleared after a real add', (await page.$eval('#s9-new', (el) => el.value)) === '');
await add('two');
await add('  ');
t('goal 9: cards append to To Do, blank adds nothing', eq(await cards('s9-todo'), ['one', 'two']), await cards('s9-todo'));
await clickOn('s9-todo', 'one', 's9-right');
t('goal 19: right moves To Do -> Doing', eq(await cards('s9-doing'), ['one']));
await clickOn('s9-doing', 'one', 's9-left');
t('goal 19: left moves back', eq(await cards('s9-todo'), ['two', 'one']), await cards('s9-todo'));
t('goal 29: counts track the columns', eq(await counts(), ['2', '0', '0']), await counts());
await clickOn('s9-todo', 'one', 's9-del');
t('goal 39: delete removes the card', eq(await cards('s9-todo'), ['two']));

console.log('\n  goal 49 - persistence\n');
t('something is stored under "s9-board"', (await stored()) !== null);
const beforeReload = await board();
await reload();
t('a reload restores the same cards in the same columns and order', eq(await board(), beforeReload), await board());
await add('three');
await clickOn('s9-todo', 'three', 's9-right');
const afterChange = await board();
await reload();
t('a LATER change also persists', eq(await board(), afterChange), await board());
await clickOn('s9-doing', 'three', 's9-del');
const afterDelete = await board();
await reload();
t('a deletion persists too', eq(await board(), afterDelete), await board());

console.log('\n  goal 59 - the Doing limit\n');
await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* blocked */ } });
await reload();
for (const x of ['a', 'b', 'c', 'd']) await add(x);
for (const x of ['a', 'b', 'c']) await clickOn('s9-todo', x, 's9-right');
t('Doing accepts its first three', eq(await cards('s9-doing'), ['a', 'b', 'c']), await cards('s9-doing'));
t('no message while nothing was rejected', (await msg()) === '', await msg());
const doingBefore = await cards('s9-doing');
const todoBefore = await cards('s9-todo');
await clickOn('s9-todo', 'd', 's9-right');
t('a 4th is REJECTED', eq(await cards('s9-doing'), doingBefore), await cards('s9-doing'));
t('the rejected card did not move', eq(await cards('s9-todo'), todoBefore));
t('the message says "Doing is full"', (await msg()) === 'Doing is full', await msg());
await clickOn('s9-doing', 'a', 's9-right');
t('the next SUCCESSFUL action empties the message', (await msg()) === '', await msg());
for (const x of ['e', 'f', 'g', 'h']) await add(x);
t('To Do is NOT capped by the same rule', (await cards('s9-todo')).length >= 4, (await cards('s9-todo')).length);

console.log('\n  THE INTERACTION - a rejected operation must not become persisted state\n');
{
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* blocked */ } });
  await reload();
  for (const x of ['p', 'q', 'r', 's'] ) await add(x);
  for (const x of ['p', 'q', 'r']) await clickOn('s9-todo', x, 's9-right');
  const good = await board();
  const savedBefore = await stored();
  await clickOn('s9-todo', 's', 's9-right');          // rejected
  t('the rejected move did not change the board', eq(await board(), good), await board());
  t('the rejected move did not change STORAGE', (await stored()) === savedBefore);
  await reload();
  t('after a reload the board is the pre-rejection state, not a half-applied one',
    eq(await board(), good), await board());
  t('the restored Doing column still holds exactly three', (await cards('s9-doing')).length === 3);
}
{
  // Persistence must survive the limit: a restored board is still subject to it.
  await clickOn('s9-todo', 's', 's9-right');
  t('the limit still applies after a restore', (await cards('s9-doing')).length === 3);
  t('and it reports the same message', (await msg()) === 'Doing is full', await msg());
  await clickOn('s9-doing', 'p', 's9-right');          // frees a slot, succeeds
  t('freeing a slot clears the message', (await msg()) === '');
  await clickOn('s9-todo', 's', 's9-right');
  t('now the 4th card can enter Doing', (await cards('s9-doing')).includes('s'), await cards('s9-doing'));
  const now = await board();
  await reload();
  t('that whole sequence persisted correctly', eq(await board(), now), await board());
}

t('no page errors were raised at any point', errs.length === 0, errs);

await browser.close();
server.close();
console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
