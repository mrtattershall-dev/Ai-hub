// gradeweb.mjs <setA-workspace> <setB-workspace> : drive the 8 web/game goals the way each goal describes.
// Uses the hub's own puppeteer + launchOptions, so pages load exactly as test_web loads them.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const HUB = 'C:/Users/tatte/Projects/ai-coding-hub/server/';
const require = createRequire(HUB + 'index.js');
const puppeteer = require('puppeteer');
const { launchOptions } = await import(pathToFileURL(HUB + 'browser.js').href);
const [WA, WB] = process.argv.slice(2);
const browser = await puppeteer.launch(launchOptions());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(file) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.split('\n')[0]));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 100)); });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' }).catch((e) => errs.push('goto ' + e.message));
  await sleep(300);
  return { page, errs };
}
const ev = (page, js) => page.evaluate(js).catch((e) => 'EVAL-ERR ' + e.message.split('\n')[0]);
const bodyText = (page) => ev(page, 'document.body.innerText.split(/\\s+/).join(" ").slice(0, 160)');
async function report(name, fn) {
  try { console.log(name.padEnd(4), JSON.stringify(await fn())); }
  catch (e) { console.log(name.padEnd(4), 'CHECK-ERR', e.message.split('\n')[0]); }
}
async function textInput(page) { return (await page.$('input[type=text]')) || (await page.$('input:not([type])')) || (await page.$('input')); }

// A9: typing text and pressing Enter adds it to the list
await report('A9', async () => {
  const { page, errs } = await open(WA + '/t5_page.html');
  const before = await ev(page, 'document.querySelectorAll("li").length');
  const inp = await textInput(page);
  if (!inp) return { errs, input: 'NONE' };
  await inp.type('hello'); await page.keyboard.press('Enter'); await sleep(200);
  return { errs, liBefore: before, liAfter: await ev(page, 'document.querySelectorAll("li").length'),
    items: await ev(page, '[...document.querySelectorAll("li")].map(l => l.textContent.trim()).join("|")') };
});

// A10: a Clear button empties the list
await report('A10', async () => {
  const { page, errs } = await open(WA + '/t5_page.html');
  const inp = await textInput(page);
  if (inp) { await inp.type('one'); await page.keyboard.press('Enter'); await inp.type('two'); await page.keyboard.press('Enter'); }
  const liBefore = await ev(page, 'document.querySelectorAll("li").length');
  const clicked = await ev(page, '(() => { const b = [...document.querySelectorAll("button")].find(b => /clear/i.test(b.textContent + b.id)); if (!b) return "NO CLEAR BUTTON"; b.click(); return "clicked #" + b.id; })()');
  await sleep(200);
  return { errs, liBefore, clicked, liAfter: await ev(page, 'document.querySelectorAll("li").length'),
    buttons: await ev(page, 'document.querySelectorAll("button").length'), lists: await ev(page, 'document.querySelectorAll("ul,ol").length') };
});

async function track(page, n, ms) {
  const pts = [];
  for (let i = 0; i < n; i++) { pts.push(await ev(page, 'typeof ball !== "undefined" ? { x: ball.x, y: ball.y } : null')); await sleep(ms); }
  return pts;
}
function flips(pts) {
  let fx = 0, fy = 0;
  for (let i = 2; i < pts.length; i++) {
    const a = pts[i - 2], b = pts[i - 1], c = pts[i];
    if (!a || !b || !c || typeof a !== 'object') continue;
    if (Math.sign(b.x - a.x) * Math.sign(c.x - b.x) < 0) fx++;
    if (Math.sign(b.y - a.y) * Math.sign(c.y - b.y) < 0) fy++;
  }
  return { xReversals: fx, yReversals: fy };
}

// A14: a ball bounces off all four walls forever
await report('A14', async () => {
  const { page, errs } = await open(WA + '/t8_game.html');
  const cv = await ev(page, '(() => { const c = document.querySelector("canvas"); return c ? { w: c.width, h: c.height } : null; })()');
  const pts = await track(page, 100, 60);
  const ok = pts.filter((p) => p && typeof p === 'object');
  const inside = cv && ok.every((p) => p.x >= -5 && p.y >= -5 && p.x <= cv.w + 5 && p.y <= cv.h + 5);
  return { errs, canvas: cv, samples: ok.length, moved: ok.length > 1 && (ok[0].x !== ok.at(-1).x || ok[0].y !== ok.at(-1).y),
    stayedInside: inside, ...flips(pts) };
});

// A15: a paddle at the bottom, moved with arrow keys, that the ball bounces off
await report('A15', async () => {
  const { page, errs } = await open(WA + '/t8_game.html');
  const paddle = await ev(page, 'typeof paddle !== "undefined" ? JSON.stringify(paddle) : "NO paddle"');
  const x0 = await ev(page, 'typeof paddle !== "undefined" ? paddle.x : null');
  for (let i = 0; i < 8; i++) { await page.keyboard.down('ArrowLeft'); await sleep(40); await page.keyboard.up('ArrowLeft'); }
  const x1 = await ev(page, 'typeof paddle !== "undefined" ? paddle.x : null');
  // drop the ball onto the middle of the paddle and see whether it comes back up
  const setup = await ev(page, `(() => {
    if (typeof paddle === "undefined" || typeof ball === "undefined") return "no ball/paddle";
    const vel = Object.keys(ball).filter(k => !["x", "y", "radius", "r", "color", "size"].includes(k) && typeof ball[k] === "number");
    const vy = vel.find(k => /y/i.test(k));
    ball.x = paddle.x + paddle.width / 2; ball.y = paddle.y - (ball.radius || ball.r || 10) - 15;
    if (vy) ball[vy] = Math.abs(ball[vy]) || 3;
    return { vel, vy };
  })()`);
  const ys = [];
  for (let i = 0; i < 25; i++) { ys.push(await ev(page, 'typeof ball !== "undefined" ? Math.round(ball.y) : null')); await sleep(40); }
  return { errs, paddle, arrowKeysMove: x0 !== x1 ? x0 + ' -> ' + x1 : 'no', setup, ys: ys.join(','),
    canvasH: await ev(page, 'document.querySelector("canvas") ? document.querySelector("canvas").height : null') };
});

// B9: two number inputs and a button that shows their sum
await report('B9', async () => {
  const { page, errs } = await open(WB + '/u5_page.html');
  const ins = await page.$$('input');
  if (ins.length < 2) return { errs, inputs: ins.length };
  await ins[0].type('2'); await ins[1].type('3');
  await ev(page, 'document.querySelector("button").click()'); await sleep(200);
  return { errs, inputs: ins.length, body: await bodyText(page) };
});

// B10: empty or non-numeric input shows an error instead of a sum
await report('B10', async () => {
  const out = {};
  for (const [label, a, b] of [['empty', '', '3'], ['nonNumber', 'abc', '3'], ['valid', '4', '5']]) {
    const { page, errs } = await open(WB + '/u5_page.html');
    await ev(page, '(() => { document.querySelectorAll("input").forEach(i => { i.type = "text"; }); })()'); // so 'abc' can be typed
    const ins = await page.$$('input');
    if (a) await ins[0].type(a);
    if (b) await ins[1].type(b);
    await ev(page, 'document.querySelector("button").click()'); await sleep(200);
    out[label] = { errs, body: await bodyText(page) };
  }
  return out;
});

// B14: the player circle moves with WASD and wraps around the edges
await report('B14', async () => {
  const { page, errs } = await open(WB + '/u8_game.html');
  const pos = () => ev(page, 'typeof player !== "undefined" ? { x: Math.round(player.x), y: Math.round(player.y) } : "NO player"');
  const start = await pos();
  await page.keyboard.down('d'); await sleep(500); await page.keyboard.up('d');
  const afterD = await pos();
  await page.keyboard.down('s'); await sleep(400); await page.keyboard.up('s');
  const afterS = await pos();
  await ev(page, '(() => { const c = document.querySelector("canvas"); player.x = c.width - 2; })()');
  await page.keyboard.down('d'); await sleep(300); await page.keyboard.up('d');
  const pushedPastRight = await pos();
  return { errs, start, afterD, afterS, pushedPastRight, canvasW: await ev(page, 'document.querySelector("canvas").width') };
});

// B15: three moving obstacles and a 'Game Over' message on contact
await report('B15', async () => {
  const { page, errs } = await open(WB + '/u8_game.html');
  const snap = () => ev(page, 'typeof obstacles !== "undefined" ? JSON.stringify(obstacles.map(o => [Math.round(o.x), Math.round(o.y)])) : "NO obstacles"');
  const o1 = await snap(); await sleep(500); const o2 = await snap();
  await ev(page, '(() => { if (typeof obstacles === "undefined" || !obstacles.length) return; const o = obstacles[0]; player.x = o.x + (o.width || 0) / 2; player.y = o.y + (o.height || 0) / 2; })()');
  await sleep(400);
  const flags = await ev(page, '["gameOver", "isGameOver", "over"].filter(n => { try { return eval(n) === true; } catch { return false; } })');
  return { errs, obstacles: o1, movedAfter500ms: o1 !== o2, bodyText: await bodyText(page), gameOverFlags: flags };
});

await browser.close();
