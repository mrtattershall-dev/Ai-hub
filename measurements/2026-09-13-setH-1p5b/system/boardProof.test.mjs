// BEHAVIOURAL PROOF FOR THE CANONICAL BOARD SEED, driven through a real browser.
//
// The board is the only DOM / multi-artifact / stateful part of the benchmark, and it is exactly
// where structural contracts are weakest - goals 49 and 59 have no derivable structural obligation
// at all. So the seed's board must be proven behaviourally before it can serve as a predecessor.
//
// It proves goals 9, 19, 29, 39 and ASSERTS THE ABSENCE of the held-out ones: no persistence
// (goal 49) and no Doing capacity or #s9-msg (goal 59). A seed that accidentally implemented either
// would silently pre-solve a held-out goal.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const HUB = 'C:/Users/tatte/Projects/ai-coding-hub-indent/server/';
const SEED = new URL('./seed/', import.meta.url).pathname.replace(/^\//, '');
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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = createServer((q, s) => {
  const f = join(SEED, decodeURIComponent(new URL(q.url, 'http://x').pathname));
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

const cards = (col) => page.evaluate((c) => [...document.querySelectorAll('#' + c + ' .s9-card')]
  .map((li) => { const n = li.cloneNode(true); n.querySelectorAll('button').forEach((b) => b.remove());
    return n.textContent.trim(); }), col);
const counts = () => page.evaluate(() => ['todo', 'doing', 'done']
  .map((k) => (document.getElementById('s9-count-' + k) || {}).textContent));
const add = async (text) => {
  await page.$eval('#s9-new', (el) => { el.value = ''; });
  if (text) await page.type('#s9-new', text);
  await page.click('#s9-add');
  await sleep(40);
};
const clickOn = async (col, text, cls) => {
  const ok = await page.evaluate((c, txt, k) => {
    for (const li of document.querySelectorAll('#' + c + ' .s9-card')) {
      const n = li.cloneNode(true);
      n.querySelectorAll('button').forEach((b) => b.remove());
      if (n.textContent.trim() === txt) { const b = li.querySelector('.' + k); if (!b) return false; b.click(); return true; }
    }
    return false;
  }, col, text, cls);
  await sleep(40);
  return ok;
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('  goal 9 - add, order, clearing, blank input\n');
t('a fresh load starts empty', eq(await cards('s9-todo'), []) && eq(await counts(), ['0', '0', '0']),
  [await cards('s9-todo'), await counts()]);
await add('Write spec');
t('the input is cleared after adding', (await page.$eval('#s9-new', (el) => el.value)) === '');
await add('Build it');
t('cards append at the END of To Do', eq(await cards('s9-todo'), ['Write spec', 'Build it']), await cards('s9-todo'));
await add('   ');
t('blank text adds nothing', eq(await cards('s9-todo'), ['Write spec', 'Build it']), await cards('s9-todo'));
t('the other columns are still empty', eq(await cards('s9-doing'), []) && eq(await cards('s9-done'), []));

console.log('\n  goal 29 - counts track each column\n');
t('counts after two adds', eq(await counts(), ['2', '0', '0']), await counts());

console.log('\n  goal 19 - move right and left, to the END of the target column\n');
await clickOn('s9-todo', 'Write spec', 's9-right');
t('right moves To Do -> Doing', eq(await cards('s9-doing'), ['Write spec']), await cards('s9-doing'));
t('counts follow the move', eq(await counts(), ['1', '1', '0']), await counts());
await clickOn('s9-doing', 'Write spec', 's9-right');
t('right moves Doing -> Done', eq(await cards('s9-done'), ['Write spec']), await cards('s9-done'));
await clickOn('s9-done', 'Write spec', 's9-right');
t('right from Done does NOTHING', eq(await cards('s9-done'), ['Write spec']), await cards('s9-done'));
await clickOn('s9-todo', 'Build it', 's9-left');
t('left from To Do does NOTHING', eq(await cards('s9-todo'), ['Build it']), await cards('s9-todo'));
await clickOn('s9-done', 'Write spec', 's9-left');
t('left moves Done -> Doing', eq(await cards('s9-doing'), ['Write spec']) && eq(await cards('s9-done'), []));
await add('Third');
await clickOn('s9-todo', 'Third', 's9-right');
t('a moved card lands at the END of the target column',
  eq(await cards('s9-doing'), ['Write spec', 'Third']), await cards('s9-doing'));

console.log('\n  goal 39 - delete\n');
await clickOn('s9-doing', 'Third', 's9-del');
t('the delete button removes that card', eq(await cards('s9-doing'), ['Write spec']), await cards('s9-doing'));
t('counts follow the delete', eq(await counts(), ['1', '1', '0']), await counts());

console.log('\n  HELD OUT - these must be ABSENT from the seed\n');
{
  const stored = await page.evaluate(() => { try { return localStorage.getItem('s9-board'); } catch (e) { return null; } });
  t('goal 49 is NOT pre-solved: nothing is saved under "s9-board"', stored === null, stored);
  await page.reload({ waitUntil: 'load' });
  await sleep(80);
  t('goal 49 is NOT pre-solved: a reload starts empty again',
    eq(await cards('s9-todo'), []) && eq(await cards('s9-doing'), []), [await cards('s9-todo'), await cards('s9-doing')]);
}
{
  const hasMsg = await page.evaluate(() => !!document.getElementById('s9-msg'));
  t('goal 59 is NOT pre-solved: there is no #s9-msg element', hasMsg === false);
  for (const x of ['a', 'b', 'c', 'd']) await add(x);
  for (const x of ['a', 'b', 'c', 'd']) await clickOn('s9-todo', x, 's9-right');
  t('goal 59 is NOT pre-solved: Doing accepts a 4th card',
    (await cards('s9-doing')).length === 4, await cards('s9-doing'));
}

t('no page errors were raised at any point', errs.length === 0, errs);

await browser.close();
server.close();
console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
