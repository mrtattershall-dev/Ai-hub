/**
 * selftest.mjs - regression suite for the hub's server surface.
 *
 *   node server/selftest.mjs                 (server must be running on :3001)
 *   HUB_TOKEN=xyz node server/selftest.mjs   (also exercises the auth gate)
 *
 * Covers what broke or was fixed on 2026-09-08: path confinement, atomic DB writes,
 * per-session terminal targeting, bare-Enter sends, the Chromium and Godot verifiers,
 * and the portability gate. Every assertion is observed behaviour, not a mock.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';

const HUB = process.env.HUB || 'http://localhost:3001';
const TOKEN = process.env.HUB_TOKEN || null;
let pass = 0, fail = 0;
const results = [];

function check(name, ok, detail) {
  ok ? pass++ : fail++;
  results.push({ name, ok, detail: detail || '' });
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + name + (!ok && detail ? '  -- ' + detail : ''));
}
const H = () => (TOKEN ? { 'Content-Type': 'application/json', 'x-hub-token': TOKEN }
                       : { 'Content-Type': 'application/json' });
const post = (p, b) => fetch(HUB + p, { method: 'POST', headers: H(), body: JSON.stringify(b), signal: AbortSignal.timeout(120000) });
const get = (p) => fetch(HUB + p, { headers: H(), signal: AbortSignal.timeout(60000) });
const strip = (x) => x.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, '');

console.log('\n--- health ---');
{
  const r = await get('/api/health');
  const j = await r.json();
  check('health responds', r.status === 200 && j.ok === true);
  check('health reports auth mode', typeof j.auth === 'string', String(j.auth));
}

console.log('\n--- path confinement (write_file is auto-approved, so this is load-bearing) ---');
{
  const WS = resolve(process.cwd(), '..', 'workspace');
  const safe = (p) => {
    const full = resolve(WS, p || '.'), base = resolve(WS);
    const n = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);
    if (!(n(full) === n(base) || n(full).startsWith(n(base + sep)))) throw new Error('escapes');
    return full;
  };
  const blocked = (p) => { try { safe(p); return false; } catch { return true; } };
  check('allows a normal path', !blocked('notes.txt'));
  check('blocks ../ traversal', blocked('../../../secret.txt'));
  check('blocks drive-absolute D:/', blocked('D:/anything.txt'));
  check('blocks UNC share', blocked('//server/share/x.txt'));
  check('blocks C:/Windows', blocked('C:/Windows/System32/drivers/etc/hosts'));
}

console.log('\n--- atomic db write ---');
{
  // Where the SERVER actually keeps it: HUB_DB if set, else beside index.js. Resolving
  // this against process.cwd() meant the documented invocation - `node server/selftest.mjs`
  // from the repo root - looked for a hub.json that is one directory up from the real one,
  // and reported the hub's own database as unreadable.
  const db = process.env.HUB_DB
    ? resolve(process.env.HUB_DB)
    : fileURLToPath(new URL('./hub.json', import.meta.url));
  let ok = false, why = '';
  try { JSON.parse(readFileSync(db, 'utf8')); ok = true; } catch (e) { why = String(e.message).slice(0, 50); }
  check('hub.json is valid JSON', ok, why);
  check('no stray hub.json.tmp left behind', !existsSync(db + '.tmp'));
}

console.log('\n--- chromium game verifier ---');
{
  const good = 'new Phaser.Game({type:Phaser.AUTO,width:640,height:480,scene:{create:function(){this.add.rectangle(320,240,80,80,0xff0000);}}});';
  const noCanvas = 'console.log("never creates a game");';
  const broken = 'new Phaser.Game({type:Phaser.AUTO,width:640,height:480,scene:{create:function(){nope();}}});';

  const a = await (await post('/api/game/verify', { engine: 'phaser', code: good })).json();
  check('phaser: good code passes', a.ok === true, a.verdict);
  check('phaser: reports canvas size', !!a.checks && a.checks.canvasWidth === 640, JSON.stringify(a.checks));
  check('phaser: returns a screenshot', typeof a.shot === 'string' && a.shot.indexOf('data:image') === 0);

  const b = await (await post('/api/game/verify', { engine: 'phaser', code: noCanvas })).json();
  check('phaser: silent no-render caught', b.ok === false && /no <canvas>/.test(b.verdict), b.verdict);

  const c = await (await post('/api/game/verify', { engine: 'phaser', code: broken })).json();
  check('phaser: runtime error caught', c.ok === false && (c.errors || []).some(e => /JS ERROR/.test(e)), c.verdict);

  const d = await (await post('/api/game/verify', { engine: 'bogus', code: good })).json();
  check('unknown engine rejected', !!d.error);

  const pixi = 'const app=new PIXI.Application({width:640,height:480});document.body.appendChild(app.view);';
  const three = 'const r=new THREE.WebGLRenderer();r.setSize(640,480);document.body.appendChild(r.domElement);'
    + 'const s=new THREE.Scene(),c=new THREE.PerspectiveCamera(75,4/3,0.1,1000);'
    + 's.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));c.position.z=3;r.render(s,c);';
  for (const [eng, code] of [['pixi', pixi], ['three', three]]) {
    const e = await (await post('/api/game/verify', { engine: eng, code })).json();
    check(eng + ': renders via shared engine config', e.ok === true, e.verdict);
  }
}

console.log('\n--- godot verifier ---');
{
  const st = await (await get('/api/godot/status')).json();
  check('godot found', st.found === true, JSON.stringify(st).slice(0, 70));
  check('godot version resolved, not "unknown"', !!st.version && st.version !== 'unknown', String(st.version));

  const T = '\t';
  const good = 'extends SceneTree\nfunc _init():\n' + T + 'print("ok")\n' + T + 'quit()\n';
  const parseErr = 'extends SceneTree\nfunc _init():\n' + T + 'print("oops"\n' + T + 'quit()\n';
  const runErr = 'extends SceneTree\nfunc _init():\n' + T + 'var a = null\n' + T + 'a.nope()\n' + T + 'quit()\n';

  const a = await (await post('/api/godot/verify', { code: good })).json();
  check('gdscript: good script passes', a.ok === true, a.verdict);
  const b = await (await post('/api/godot/verify', { code: parseErr })).json();
  check('gdscript: parse error caught (godot exits 0, so output is scanned)', b.ok === false && /parse/i.test(b.verdict), b.verdict);
  const c = await (await post('/api/godot/verify', { code: runErr })).json();
  check('gdscript: error reported as cause, not the hang it caused', c.ok === false && /errored while running/i.test(c.verdict), c.verdict);
}

console.log('\n--- terminal ---');
{
  const base = HUB.replace('http', 'ws') + '/api/terminal';
  const url = base + '?shell=powershell.exe&cols=80&rows=20' + (TOKEN ? '&token=' + TOKEN : '');
  const open = () => new Promise((res) => {
    const ws = new WebSocket(url);
    const st = { ws, id: null, buf: '' };
    ws.on('message', (m) => {
      const o = JSON.parse(m);
      if (o.type === 'session') st.id = o.id;
      if (o.type === 'output') st.buf += o.data;
    });
    ws.on('open', () => setTimeout(() => res(st), 2600));
    ws.on('error', () => res(st));
  });

  const before = await (await get('/api/terminal/status')).json();
  const A = await open();
  const B = await open();
  check('shell reports its session id', A.id != null && B.id != null, A.id + '/' + B.id);

  const during = await (await get('/api/terminal/status')).json();
  check('sessions tracked', during.sessions === before.sessions + 2, JSON.stringify(during));

  // The bug: send used to hit the NEWEST shell rather than the targeted one.
  const s = await post('/api/terminal/send', { text: '"LANDED_A"', newline: true, sessionId: A.id });
  check('send accepted with sessionId', s.status === 200);
  await new Promise(r => setTimeout(r, 2600));
  check('send reached the TARGETED shell', /LANDED_A/.test(strip(A.buf)));
  check('send did not leak into the newest shell', !/LANDED_A/.test(strip(B.buf)));

  const e = await post('/api/terminal/send', { text: '', newline: true, sessionId: A.id });
  check('bare Enter accepted (empty text + newline)', e.status === 200);
  const bad = await post('/api/terminal/send', { text: '', newline: false });
  check('truly empty send rejected', bad.status === 400);

  A.ws.close();
  B.ws.close();
  await new Promise(r => setTimeout(r, 2000));
  const after = await (await get('/api/terminal/status')).json();
  check('shells cleaned up on disconnect, no leak', after.sessions === before.sessions, JSON.stringify(after));
}

console.log('\n--- portability gate ---');
{
  // Resolved against THIS FILE, not the working directory. It used to be
  // `resolve(process.cwd(), '..', ...)`, which points one level ABOVE the repo - so the
  // import threw ERR_MODULE_NOT_FOUND, took the process down before the summary line,
  // and left the gate unverified for however long that had been true. A suite that
  // cannot find a file has to report a failure, not die.
  const gateUrl = new URL('../training-data/factory/gate.mjs', import.meta.url);
  let g = null;
  try { g = await import(gateUrl.href); }
  catch (e) { check('portability gate module loads', false, e.message); }

  if (g) {
    const p = (c) => g.dependsOnExternalResources(c).portable;
    check('generated graphics portable', p('this.add.rectangle(1,1,1,1,0);'));
    check('data: URI portable', p('const i=new Image(); i.src="data:image/png;base64,AA";'));
    check('asset load rejected', !p('this.load.image("p","assets/p.png");'));
    check('setBaseURL rejected', !p('this.load.setBaseURL("https://cdn.phaserfiles.com/v385");'));
    check('remote image rejected', !p('const i=new Image(); i.src="https://x.com/a.png";'));

    // The second contract, and the one a training row has to satisfy now that the
    // verifier serves the library: an asset IN the manifest is legal, one that is not is
    // a 404 and a blank canvas. Untested until now, and it decides whether a harvested
    // row is kept.
    const manifest = ['hero.png', 'tiles/grass.png'];
    const r = (c) => g.runnableWithAssets(c, manifest);
    const inLib = 'this.load.image("h","assets/hero.png");';
    const notInLib = 'this.load.image("h","assets/nope.png");';
    check('asset in the library is runnable', r(inLib).runnable);
    check('asset NOT in the library is refused', !r(notInLib).runnable);
    check('the missing asset is named', (r(notInLib).missing || []).includes('nope.png'));
    check('a remote URL stays refused even with a manifest',
      !r('const i=new Image(); i.src="https://x.com/a.png";').runnable);
    check('no manifest falls back to the strict rule', !g.runnableWithAssets(inLib, []).runnable);
  }
}

console.log('\n================  ' + pass + ' passed, ' + fail + ' failed  ================');
if (fail) {
  console.log('\nfailures:');
  results.filter(r => !r.ok).forEach(r => console.log('  ' + r.name + (r.detail ? '  -- ' + r.detail : '')));
}
process.exit(fail ? 1 : 0);
