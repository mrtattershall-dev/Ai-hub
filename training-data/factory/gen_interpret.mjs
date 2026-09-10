/**
 * gen_interpret.mjs — the interpretation-logic set: casual/light request -> correctly
 * interpreted code (right scope, right domain, sensible defaults). The fix for "writes
 * correct code but misreads what a casual prompt actually wants."
 *
 *   node factory/gen_interpret.mjs 2000
 *
 * Six interpretation rules (the failures observed):
 *   right-size   — "simple/just/quick X" => the MINIMAL correct thing, not over-built
 *   defaults     — a bare noun ("a timer") => the obvious sensible behavior (counts down, stops)
 *   add          — "add X to Y" => the focused addition, NOT a rewrite of Y
 *   domain       — ambiguous noun => the RIGHT domain (a personality is traits, not combat stats)
 *   core         — a genre name => its DEFINING mechanic (a snake grows + dies on self-collision)
 *   slang        — "smarter/harder/juicy" => the concrete intent behind the casual phrasing
 *
 * Each row: a casual user request -> code that LEADS with a one-line "Interpreting: ..."
 * comment (teaching the model to state the interpretation), then the right-sized correct
 * code with an assert self-check. Many casual phrasings map to the same correct answer on
 * purpose (robustness to phrasing). Every row is gate-clean + node-executed before it counts.
 */
import { execFileSync } from 'child_process';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { analyze } from './gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FACTORY = HERE;
const TARGET = parseInt(process.argv[2] || '2000', 10);
const TMP = join(HERE, '_interp_tmp');
const SYSTEM = ('You correctly interpret what the user actually wants — the right scope, the right '
  + 'domain, and sensible defaults — even from a short or casual request. Lead with a one-line '
  + 'comment stating your interpretation, then write the right code: not over-built, not '
  + 'under-built, in the correct domain. Return code that runs as given.');
const ASSERT = "function assert(c,m){if(!c)throw new Error('FAIL: '+m);}\n";

let seed = 1234;
// NOTE: plain `seed * 1103515245` overflows float64 (~2.4e18 vs 9.0e15 safe-int max), which
// destroyed precision before the mask and collapsed the LCG to a 10,466-state cycle — capping
// the whole generator at 2,945 unique rows. Math.imul does exact 32-bit multiply: full period.
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));   // varied params -> distinct code
const CASUAL = ['just ', 'a quick ', 'a simple ', 'gimme ', 'i need ', 'a basic ', 'make me ', '', 'small ', 'can you do ', 'something like ', 'a little '];
const casual = (s) => (pick(CASUAL) + s).replace(/^\w/, c => c).trim();
const ITEMS = ['apple', 'potion', 'gem', 'coin', 'arrow', 'key', 'herb', 'ore', 'scroll', 'bone'];
const FACTIONS = ['guild', 'kingdom', 'rebels', 'merchants', 'cult', 'order', 'clan', 'syndicate'];

// ---------- rule generators: parametric, asserts computed from varied values ----------
const R = {};

R.rightsize = () => {
  const builders = {
    counter: () => { const A = ri(2, 9), B = ri(1, A); return `// Interpreting: a MINIMAL counter — increment, decrement, reset. Nothing extra.
class Counter{constructor(){this.value=0;}inc(){return ++this.value;}dec(){return --this.value;}reset(){this.value=0;}}
const c=new Counter();for(let i=0;i<${A};i++)c.inc();assert(c.value===${A},'inc');for(let i=0;i<${B};i++)c.dec();assert(c.value===${A - B},'dec');c.reset();assert(c.value===0,'reset');console.log('ok');`; },
    toggle: () => { const init = pick([true, false]), F = ri(1, 6), fin = (F % 2 ? !init : init); return `// Interpreting: a MINIMAL on/off toggle. Just flip and read.
class Toggle{constructor(on=false){this.on=on;}flip(){this.on=!this.on;return this.on;}}
const t=new Toggle(${init});let r;for(let i=0;i<${F};i++)r=t.flip();assert(r===${fin},'flips');console.log('ok');`; },
    stopwatch: () => { const T1 = ri(10, 200), T2 = ri(10, 200), T3 = ri(10, 100); return `// Interpreting: a MINIMAL stopwatch — accumulate elapsed ticks, reset. No formatting, no UI.
class Stopwatch{constructor(){this.ms=0;this.running=false;}start(){this.running=true;}tick(dt){if(this.running)this.ms+=dt;}stop(){this.running=false;}reset(){this.ms=0;}}
const s=new Stopwatch();s.start();s.tick(${T1});s.tick(${T2});assert(s.ms===${T1 + T2},'elapsed');s.stop();s.tick(${T3});assert(s.ms===${T1 + T2},'stopped');console.log('ok');`; },
    stack: () => { const K = ri(2, 6); return `// Interpreting: a MINIMAL stack — push/pop/peek. Nothing more.
class Stack{constructor(){this.items=[];}push(x){this.items.push(x);}pop(){return this.items.pop();}peek(){return this.items[this.items.length-1];}get size(){return this.items.length;}}
const s=new Stack();for(let i=1;i<=${K};i++)s.push(i);assert(s.peek()===${K},'peek');assert(s.pop()===${K}&&s.size===${K - 1},'pop');console.log('ok');`; },
    accumulator: () => { const A = ri(2, 50), B = ri(2, 50); return `// Interpreting: a MINIMAL running total — add values, read the sum, reset.
class Total{constructor(){this.sum=0;}add(n){this.sum+=n;return this.sum;}reset(){this.sum=0;}}
const t=new Total();assert(t.add(${A})===${A}&&t.add(${B})===${A + B},'sum');t.reset();assert(t.sum===0,'reset');console.log('ok');`; },
  };
  const k = pick(Object.keys(builders));
  return { tag: 'rightsize', request: casual('a simple ' + k), code: ASSERT + builders[k]() };
};

R.defaults = () => {
  const builders = {
    timer: () => { const S = ri(8, 60), T = ri(1, S - 1); return `// Interpreting: "a timer" most sensibly means a COUNTDOWN — start at a set time, tick to 0, stop there, be restartable.
class Timer{constructor(seconds){this.start=seconds;this.left=seconds;this.done=false;}tick(dt){this.left=Math.max(0,this.left-dt);if(this.left===0)this.done=true;return this.left;}reset(){this.left=this.start;this.done=false;}}
const t=new Timer(${S});t.tick(${T});assert(t.left===${S - T}&&!t.done,'counts down');t.tick(${S});assert(t.left===0&&t.done,'stops at zero');t.reset();assert(t.left===${S},'restart');console.log('ok');`; },
    health: () => { const M = ri(50, 300), D = ri(10, M - 10); return `// Interpreting: "health" sensibly means a clamped pool — damage and heal between 0 and max, with a dead flag at 0.
class Health{constructor(max){this.max=max;this.hp=max;}damage(n){this.hp=Math.max(0,this.hp-n);return this.hp;}heal(n){this.hp=Math.min(this.max,this.hp+n);return this.hp;}get dead(){return this.hp<=0;}}
const h=new Health(${M});h.damage(${D});assert(h.hp===${M - D},'damage');h.heal(9999);assert(h.hp===${M},'heal clamps');h.damage(9999);assert(h.dead,'dead at zero');console.log('ok');`; },
    score: () => { const A = ri(10, 100), B = ri(10, 100); return `// Interpreting: "a score" sensibly means an accumulating total that also tracks the best seen.
class Score{constructor(){this.value=0;this.best=0;}add(n){this.value+=n;if(this.value>this.best)this.best=this.value;return this.value;}reset(){this.value=0;}}
const s=new Score();s.add(${A});s.add(${B});assert(s.value===${A + B}&&s.best===${A + B},'tracks best');s.reset();assert(s.value===0&&s.best===${A + B},'reset keeps best');console.log('ok');`; },
    cooldown: () => { const L = ri(3, 12); return `// Interpreting: "a cooldown" sensibly means: usable now, then blocked for N, then ready again.
class Cooldown{constructor(length){this.length=length;this.remaining=0;}get ready(){return this.remaining<=0;}use(){if(!this.ready)return false;this.remaining=this.length;return true;}tick(dt){this.remaining=Math.max(0,this.remaining-dt);}}
const cd=new Cooldown(${L});assert(cd.use()===true,'fires when ready');assert(cd.use()===false,'blocked on cooldown');cd.tick(${L});assert(cd.ready&&cd.use(),'ready again');console.log('ok');`; },
    lives: () => { const N = ri(2, 6); return `// Interpreting: "lives" sensibly means a countdown of attempts that ends the game at zero.
class Lives{constructor(n){this.count=n;}lose(){this.count=Math.max(0,this.count-1);return this.count;}get gameOver(){return this.count===0;}}
const l=new Lives(${N});for(let i=0;i<${N - 1};i++)l.lose();assert(!l.gameOver,'still alive');l.lose();assert(l.gameOver,'game over at zero');console.log('ok');`; },
  };
  const k = pick(Object.keys(builders));
  return { tag: 'defaults', request: casual(k), code: ASSERT + builders[k]() };
};

R.add = () => {
  const builders = {
    jump: () => { const J = ri(8, 16); return ['add a jump to my player', `// Interpreting: you asked to ADD jumping to an existing player — focused addition (gravity + grounded check + impulse), NOT a rewrite.
class Player{constructor(){this.y=0;this.vy=0;this.grounded=true;}jump(){if(this.grounded){this.vy=-${J};this.grounded=false;}}update(){this.vy+=1;this.y+=this.vy;if(this.y>=0){this.y=0;this.vy=0;this.grounded=true;}}}
const p=new Player();p.jump();assert(p.vy===-${J}&&!p.grounded,'jump impulse');for(let i=0;i<60;i++)p.update();assert(p.grounded&&p.y===0,'lands and re-grounds');console.log('ok');`]; },
    dash: () => { const D = ri(30, 90), C = ri(10, 30); return ['add a dash', `// Interpreting: ADD a dash to a mover — a short burst in the facing direction with a cooldown. Just the dash.
class Mover{constructor(){this.x=0;this.dir=1;this.cd=0;}dash(){if(this.cd>0)return false;this.x+=this.dir*${D};this.cd=${C};return true;}tick(){if(this.cd>0)this.cd--;}}
const m=new Mover();assert(m.dash()&&m.x===${D},'dashes');assert(!m.dash(),'cooldown blocks');for(let i=0;i<${C};i++)m.tick();assert(m.dash(),'ready again');console.log('ok');`]; },
    combo: () => { const B = ri(5, 25); return ['add a combo counter to my scoring', `// Interpreting: ADD a combo multiplier to existing scoring — chained hits multiply, a miss resets. Just the combo layer.
class Score{constructor(){this.value=0;this.combo=0;}hit(base){this.combo++;this.value+=base*this.combo;return this.value;}miss(){this.combo=0;}}
const s=new Score();s.hit(${B});s.hit(${B});assert(s.value===${B + 2 * B},'combo multiplies');s.miss();s.hit(${B});assert(s.combo===1,'miss resets combo');console.log('ok');`]; },
  };
  const k = pick(Object.keys(builders));
  const [req, code] = builders[k]();
  return { tag: 'add', request: casual(req), code: ASSERT + code };
};

R.domain = () => {
  const builders = {
    personality: () => { const tr = pick(['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']); return ['a personality system', `// Interpreting: a "personality" system means character TRAITS (openness, etc.), NOT combat stats like hp/damage.
class Personality{constructor(){this.traits={openness:0.5,conscientiousness:0.5,extraversion:0.5,agreeableness:0.5,neuroticism:0.5};}set(t,v){this.traits[t]=Math.max(0,Math.min(1,v));}describe(){return Object.entries(this.traits).filter(([,v])=>v>0.6).map(([t])=>t);}}
const p=new Personality();p.set('${tr}',0.9);assert(p.describe().includes('${tr}'),'traits, not combat');assert(p.traits.hp===undefined,'no hp here');console.log('ok');`]; },
    inventory: () => { const it = pick(ITEMS), q = ri(3, 9), r = ri(1, q - 1); return ['an inventory system', `// Interpreting: an "inventory" system means holding ITEMS and quantities, NOT UI/menus. Pure item logic.
class Inventory{constructor(){this.items=new Map();}add(id,q=1){this.items.set(id,(this.items.get(id)||0)+q);}remove(id,q=1){const h=this.items.get(id)||0;if(h<q)return false;this.items.set(id,h-q);return true;}count(id){return this.items.get(id)||0;}}
const inv=new Inventory();inv.add('${it}',${q});assert(inv.count('${it}')===${q},'holds items');assert(inv.remove('${it}',${r})&&inv.count('${it}')===${q - r},'removes');console.log('ok');`]; },
    economy: () => { const b = ri(50, 500), e = ri(10, 100), sp = ri(10, b); return ['an economy system', `// Interpreting: an "economy" means CURRENCY and transactions (earn/spend with balance checks), not a marketplace UI.
class Economy{constructor(b=0){this.balance=b;}earn(n){this.balance+=n;}spend(n){if(this.balance<n)return false;this.balance-=n;return true;}}
const ec=new Economy(${b});ec.earn(${e});assert(ec.balance===${b + e},'earn');assert(ec.spend(${sp})&&ec.balance===${b + e - sp},'spend');assert(!ec.spend(${b + e + 1}),'no overdraft');console.log('ok');`]; },
    weather: () => { const k = ri(1, 7); return ['a weather system', `// Interpreting: a "weather" system means CONDITIONS that change over time (clear/rain/storm), not temperature charts.
class Weather{constructor(){this.states=['clear','cloudy','rain','storm'];this.i=0;}get current(){return this.states[this.i];}advance(){this.i=(this.i+1)%this.states.length;return this.current;}}
const w=new Weather();assert(w.current==='clear','starts clear');let c;for(let i=0;i<${k};i++)c=w.advance();assert(c===['clear','cloudy','rain','storm'][${k % 4}],'transitions');console.log('ok');`]; },
    reputation: () => { const f = pick(FACTIONS), d1 = ri(5, 20), d2 = ri(1, 4); return ['a reputation system', `// Interpreting: "reputation" means STANDING with factions (a value per faction that earns/loses), not reviews/ratings.
class Reputation{constructor(){this.standing=new Map();}change(faction,d){this.standing.set(faction,(this.standing.get(faction)||0)+d);}with(faction){return this.standing.get(faction)||0;}liked(faction){return this.with(faction)>0;}}
const rp=new Reputation();rp.change('${f}',${d1});rp.change('${f}',-${d2});assert(rp.with('${f}')===${d1 - d2},'tracks standing');assert(rp.liked('${f}'),'liked');console.log('ok');`]; },
  };
  const k = pick(Object.keys(builders));
  const [req, code] = builders[k]();
  return { tag: 'domain', request: casual(req), code: ASSERT + code };
};

R.core = () => {
  const builders = {
    snake: () => { const W = ri(8, 16), H = ri(8, 16); return ['a snake game', `// Interpreting: the CORE of a snake game is: move on a grid, GROW when eating, DIE on self/wall collision. Building that logic (no rendering).
class Snake{constructor(w,h){this.w=w;this.h=h;this.body=[{x:2,y:2}];this.dir={x:1,y:0};this.dead=false;}setDir(x,y){this.dir={x,y};}step(food){const head={x:this.body[0].x+this.dir.x,y:this.body[0].y+this.dir.y};if(head.x<0||head.y<0||head.x>=this.w||head.y>=this.h||this.body.some(s=>s.x===head.x&&s.y===head.y)){this.dead=true;return;}this.body.unshift(head);if(food&&head.x===food.x&&head.y===food.y)return true;this.body.pop();return false;}}
const s=new Snake(${W},${H});assert(s.step({x:3,y:2})===true,'grows on food');assert(s.body.length===2,'grew');const w=new Snake(3,3);w.setDir(1,0);w.step();w.step();assert(w.dead,'dies at wall');console.log('ok');`]; },
    breakout: () => { const N = ri(3, 8); return ['a breakout game', `// Interpreting: the CORE of breakout is a ball clearing a grid of bricks on collision. Building the collision/clear logic.
class Breakout{constructor(n){this.bricks=new Set();for(let i=0;i<n;i++)this.bricks.add(i);this.score=0;}hit(i){if(this.bricks.has(i)){this.bricks.delete(i);this.score+=10;return true;}return false;}get cleared(){return this.bricks.size===0;}}
const b=new Breakout(${N});assert(b.hit(0)&&b.score===10,'clears brick');assert(!b.hit(0),'already gone');for(let i=1;i<${N};i++)b.hit(i);assert(b.cleared,'all cleared');console.log('ok');`]; },
    match3: () => { const L = ri(3, 5), col = pick(['r', 'g', 'b', 'y']); return ['a match-3 game', `// Interpreting: the CORE of match-3 is detecting and clearing runs of 3+. Building the match/clear logic.
class Match3{constructor(row){this.row=row;}matches(){const out=[];let i=0;while(i<this.row.length){let j=i;while(j<this.row.length&&this.row[j]===this.row[i])j++;if(j-i>=3)for(let k=i;k<j;k++)out.push(k);i=j;}return out;}}
const run=Array(${L}).fill('${col}');const m=new Match3([...run,'x']);assert(m.matches().length===${L},'finds run of ${L}');const n=new Match3(['a','b','a']);assert(n.matches().length===0,'no false match');console.log('ok');`]; },
  };
  const k = pick(Object.keys(builders));
  const [req, code] = builders[k]();
  return { tag: 'core', request: casual(req), code: ASSERT + code };
};

R.slang = () => {
  const builders = {
    smarter: () => { const sight = ri(3, 8), px = ri(1, sight); return ['make the enemy smarter', `// Interpreting: "smarter enemy" (light ask) most usefully means basic PURSUIT AI — move toward the player when within sight range.
class EnemyAI{constructor(x,sight){this.x=x;this.sight=sight;}update(playerX){const d=playerX-this.x;if(Math.abs(d)<=this.sight)this.x+=Math.sign(d);return this.x;}}
const e=new EnemyAI(0,${sight});e.update(${px});assert(e.x===1,'chases when in sight');const f=new EnemyAI(0,${sight});f.update(${sight + 50});assert(f.x===0,'ignores out of sight');console.log('ok');`]; },
    harder: () => { const base = ri(40, 80), div = ri(3, 8); return ['make it harder over time', `// Interpreting: "harder over time" most usefully means a DIFFICULTY RAMP — spawn faster / values scale as time or score rises.
class Difficulty{constructor(){this.t=0;}tick(){this.t++;}spawnInterval(){return Math.max(10,${base}-Math.floor(this.t/${div}));}enemySpeed(){return 1+this.t*0.01;}}
const d=new Difficulty();const i0=d.spawnInterval();for(let i=0;i<200;i++)d.tick();assert(d.spawnInterval()<i0,'spawns faster');assert(d.enemySpeed()>1,'enemies speed up');console.log('ok');`]; },
    juicy: () => { const mag = ri(3, 10), dur = ri(2, 6); return ['make it more juicy / game feel', `// Interpreting: "juicy / game feel" (light ask) means polish PRIMITIVES — easing, a screen-shake offset, a brief hit-stop. Here are the building blocks.
function easeOutQuad(t){return 1-(1-t)*(1-t);}
class Shake{constructor(){this.t=0;this.mag=0;}trigger(mag,dur){this.mag=mag;this.t=dur;}offset(){if(this.t<=0)return{x:0,y:0};this.t--;return{x:(Math.random()*2-1)*this.mag,y:(Math.random()*2-1)*this.mag};}}
assert(easeOutQuad(0)===0&&easeOutQuad(1)===1,'easing endpoints');const s=new Shake();s.trigger(${mag},${dur});assert(s.offset().x!==undefined,'shake offset');for(let i=0;i<${dur};i++)s.offset();assert(s.offset().x===0,'shake ends');console.log('ok');`]; },
    juggle: () => { const acc = (ri(3, 8) / 10), fr = (ri(70, 90) / 100); return ['make the movement feel better', `// Interpreting: "movement feels better" most usefully means acceleration + friction instead of instant velocity. Smoothing the motion.
class Mover{constructor(){this.x=0;this.vx=0;this.accel=${acc};this.friction=${fr};}input(dir){this.vx+=dir*this.accel;}update(){this.vx*=this.friction;this.x+=this.vx;}}
const m=new Mover();m.input(1);m.update();const v1=m.vx;m.input(1);m.update();assert(m.vx>v1,'accelerates');for(let i=0;i<80;i++)m.update();assert(Math.abs(m.vx)<0.1,'friction settles');console.log('ok');`]; },
  };
  const k = pick(Object.keys(builders));
  const [req, code] = builders[k]();
  return { tag: 'slang', request: casual(req), code: ASSERT + code };
};

// ---------- driver ----------
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const rules = Object.keys(R);
const rows = [], seen = new Set();
let made = 0, failed = 0, dup = 0, attempts = 0;
const tally = {};
const ATTEMPT_MULT = parseInt(process.env.ATTEMPT_MULT || '8', 10);
while (rows.length < TARGET && attempts < TARGET * ATTEMPT_MULT) {
  attempts++;
  const name = rules[attempts % rules.length];
  let built; try { built = R[name](); } catch { continue; }
  const a = analyze(built.code);
  if (!a.syntax || a.free.length) { failed++; continue; }
  const key = createHash('sha1').update(built.request + '|' + built.code).digest('hex');
  if (seen.has(key)) { dup++; continue; }
  // execute it
  const f = join(TMP, 'i.js'); writeFileSync(f, built.code, 'utf8');
  try { execFileSync('node', [f], { timeout: 5000, stdio: 'pipe' }); }
  catch { failed++; continue; }
  seen.add(key);
  tally[built.tag] = (tally[built.tag] || 0) + 1;
  rows.push({ messages: [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: built.request },
    { role: 'assistant', content: '```javascript\n' + built.code.trim() + '\n```' },
  ] });
  made++;
}
rmSync(TMP, { recursive: true, force: true });
const out = join(FACTORY, 'dataset_interpret.jsonl');
writeFileSync(out, rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
console.log(`\n=== interpretation set (gate + exec verified) ===`);
console.log(`  rows: ${rows.length} | exec/gate-rejected: ${failed} | dup(request+code): ${dup}`);
console.log(`  by rule:`, tally);
console.log(`  -> ${out}`);
