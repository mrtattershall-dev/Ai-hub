/**
 * gen_systems.mjs — scale the hand-proven seeds to N execution-verified rows, locally.
 *
 *   node systems/gen_systems.mjs 200
 *
 * Each template below is a PARAMETRIC version of a proven seed: it varies by structural
 * `variant` (e.g. price formula inverse|linear|fixed, xp curve linear|quadratic|geometric),
 * by `theme` (vocabulary/numbers), so the generated CODE genuinely differs — not just
 * renamed constants. Demos assert INVARIANTS (relations that hold for any valid params),
 * so correctness doesn't depend on hardcoded magic numbers.
 *
 * Every candidate is GATED (acorn free-vars) AND EXECUTED (`node <file>`; its asserts throw
 * on wrong behaviour). Only files that pass both, and are unique, become rows. The 15 hand
 * seeds are included verbatim as the canonical anchors. Output: factory/dataset_systems.jsonl
 *
 * Diversity is structural + thematic (not semantic) — for fresh problem framings, run
 * modal_generate.py on top. Quality here is guaranteed by execution, not by the generator.
 */
import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { analyze } from '../gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FACTORY = dirname(HERE);
const TARGET = parseInt(process.argv[2] || '200', 10);
const SYSTEM = 'You are a senior engineer who writes complete, self-contained, runnable code. Every identifier you reference must be declared or imported, declarations must precede use, and you only call methods/APIs that actually exist. Return code that runs as given.';
const TMP = join(HERE, '_gen');

const ASSERT = `function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }\n`;
const themes = [
  { k: 'fantasy', cur: 'gold', goods: ['ore', 'herb', 'gem', 'rune', 'pelt'], unit: 'sword', foe: 'goblin' },
  { k: 'scifi', cur: 'credits', goods: ['fuel', 'alloy', 'chip', 'crystal', 'core'], unit: 'blaster', foe: 'drone' },
  { k: 'modern', cur: 'cash', goods: ['coffee', 'widget', 'part', 'tool', 'crate'], unit: 'gadget', foe: 'thief' },
  { k: 'farm', cur: 'coins', goods: ['wheat', 'milk', 'egg', 'wool', 'seed'], unit: 'hoe', foe: 'crow' },
  { k: 'arcade', cur: 'tokens', goods: ['star', 'coin', 'ring', 'key', 'orb'], unit: 'paddle', foe: 'blob' },
];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---- templates: each returns { genre, doc, instr, code } ----
const T = {};

T.economy = (th, v, n) => {
  const g = th.goods[n % th.goods.length];
  const priceBody = v === 'linear'
    ? `return Math.round(base + Math.max(0, 50 - this.units(id)));`
    : v === 'fixed'
      ? `return base;`
      : `return Math.round(base * (50 / Math.max(1, this.units(id))));`;
  const tax = v === 'taxed';
  const priceFinal = v === 'taxed'
    ? `return Math.round(base * (50 / Math.max(1, this.units(id))));`
    : priceBody;
  return {
    genre: 'simulation',
    doc: `A ${th.k} economy: a Wallet, a Market that prices ${g} from supply${tax ? ' plus sales tax' : ''}, an Inventory, and a Store that quotes the Market, debits the Wallet and fills the Inventory. Systems talk only through the Store.`,
    instr: `Write a runnable vanilla JavaScript simulation systems module for a ${th.k} economy where a Store ties a Wallet, a supply-priced Market and an Inventory together${tax ? ' with sales tax on purchases' : ''} — separate classes, no shared globals, ending in a self-checking demo.`,
    code: ASSERT + `
class Wallet { constructor(b){this.balance=b;} canAfford(n){return this.balance>=n;} debit(n){if(!this.canAfford(n))return false;this.balance-=n;return true;} credit(n){this.balance+=n;} }
class Inventory { constructor(){this.goods=new Map();} add(id,q){this.goods.set(id,this.count(id)+q);} remove(id,q){if(this.count(id)<q)return false;this.goods.set(id,this.count(id)-q);return true;} count(id){return this.goods.get(id)||0;} }
class Market {
  constructor(base){this.base=base;this.stock=new Map();}
  setStock(id,u){this.stock.set(id,u);} units(id){const u=this.stock.get(id);return u==null?50:u;}
  price(id){const base=this.base[id]||1; ${priceFinal} }
}
class Store {
  constructor(w,m,i){this.wallet=w;this.market=m;this.inv=i;${tax ? 'this.tax=0.1;' : ''}}
  buy(id,q){const cost=this.market.price(id)*q;${tax ? 'const paid=Math.round(cost*(1+this.tax));' : 'const paid=cost;'} if(!this.wallet.debit(paid))return {ok:false,paid}; this.inv.add(id,q); this.market.setStock(id,this.market.units(id)-q); return {ok:true,paid};}
  sell(id,q){if(!this.inv.remove(id,q))return {ok:false}; const gain=this.market.price(id)*q; this.wallet.credit(gain); this.market.setStock(id,this.market.units(id)+q); return {ok:true,gain};}
}
const wallet=new Wallet(100000), market=new Market({'${g}':${5 + (n % 7)}}); market.setStock('${g}',50);
const inv=new Inventory(), store=new Store(wallet,market,inv);
const start=wallet.balance, before=market.price('${g}');
const buy=store.buy('${g}',${3 + (n % 5)});
assert(buy.ok, 'purchase succeeds when affordable');
assert(wallet.balance===start-buy.paid, 'wallet debited by exactly the amount paid');
assert(inv.count('${g}')===${3 + (n % 5)}, 'inventory received the goods');
${v === 'fixed' ? `assert(market.price('${g}')===before, 'fixed price does not move');` : `assert(market.price('${g}')>=before, 'price rises as stock falls');`}
const sell=store.sell('${g}',2);
assert(sell.ok && inv.count('${g}')===${3 + (n % 5) - 2}, 'selling returns goods to the market');
assert(wallet.balance>start-buy.paid, 'wallet credited from the sale');
console.log('gen economy ${th.k}/${v} OK');
`,
  };
};

T.leveling = (th, v, n) => {
  const curve = v === 'quadratic' ? `return level*level*50;`
    : v === 'geometric' ? `return Math.round(100*Math.pow(1.5,level-1));`
      : `return level*100;`;
  return {
    genre: 'rpg',
    doc: `A ${th.k} progression: an ExperienceTrack with a ${v} XP curve, a LevelUp that grants stat growth per level, and a Character it applies to. One award can cross several levels.`,
    instr: `Write a runnable vanilla JavaScript rpg systems module: an experience track with a ${v} curve, a level-up system that applies stat growth, and a character — separate classes, no shared globals, with a self-checking demo.`,
    code: ASSERT + `
class ExperienceTrack {
  constructor(){this.level=1;this.xp=0;}
  needed(level){ ${curve} }
  add(amount){this.xp+=amount;let g=0;while(this.xp>=this.needed(this.level)){this.xp-=this.needed(this.level);this.level+=1;g+=1;}return g;}
}
class LevelUp { constructor(growth){this.growth=growth;} apply(c,levels){for(let i=0;i<levels;i++)for(const k in this.growth)c.stats[k]+=this.growth[k];} }
class Character { constructor(stats){this.stats=stats;} }
const track=new ExperienceTrack(), levelup=new LevelUp({hp:${5 + (n % 6)},attack:${1 + (n % 3)}}), hero=new Character({hp:50,attack:5});
const need1=track.needed(1);
let g=track.add(need1);
assert(g===1 && track.level===2, 'exactly one level at the first threshold');
levelup.apply(hero,g);
assert(hero.stats.hp===50+${5 + (n % 6)}, 'stat growth applied once per level');
const before=track.level;
g=track.add(track.needed(track.level)*3);
assert(track.level>before, 'a large award raises the level');
assert(hero.stats.hp>=50+${5 + (n % 6)}, 'stats never shrink');
levelup.apply(hero,g);
console.log('gen leveling ${th.k}/${v} OK');
`,
  };
};

T.combat = (th, v, n) => {
  const mit = v === 'ratio'
    ? `const raw=Math.max(1,Math.round(attacker.attack*(100/(100+defender.defense))));`
    : `const raw=Math.max(1,attacker.attack-Math.floor(defender.defense/2));`;
  const dodge = v === 'dodge';
  return {
    genre: 'rpg',
    doc: `A ${th.k} combat exchange: a Health pool, a DamageCalculator using ${v} mitigation${dodge ? ' with deterministic dodge' : ''}, and a CombatSystem that applies a strike against a ${th.foe} and reports kills.`,
    instr: `Write a runnable vanilla JavaScript rpg systems module: a health pool, a damage calculator with ${v} mitigation, and a combat system that reports kills — separate classes, no shared globals, with a self-checking demo.`,
    code: ASSERT + `
class Health { constructor(max){this.max=max;this.current=max;} damage(n){this.current=Math.max(0,this.current-n);return this.current;} heal(n){this.current=Math.min(this.max,this.current+n);return this.current;} get dead(){return this.current<=0;} }
class DamageCalculator {
  compute(attacker,defender,roll){ ${mit} ${dodge ? `if(roll<defender.dodgeAt)return 0;` : ``} return roll>=attacker.critAt?raw*2:raw; }
}
class CombatSystem { constructor(c){this.calc=c;this.log=[];} strike(a,d,hp,roll=0){const dmg=this.calc.compute(a,d,roll);hp.damage(dmg);const killed=hp.dead;this.log.push({dmg,killed});return {dmg,killed};} }
const calc=new DamageCalculator(), combat=new CombatSystem(calc);
const hero={attack:${8 + (n % 6)},defense:5,critAt:0.9${dodge ? ',dodgeAt:0' : ''}};
const foe={attack:6,defense:${3 + (n % 4)},critAt:0.9${dodge ? ',dodgeAt:0.2' : ''}};
const foeHp=new Health(${30 + (n % 20)});
const before=foeHp.current;
const r=combat.strike(hero,foe,foeHp,0.5);
assert(r.dmg>=1 && foeHp.current===before-r.dmg, 'health drops by the damage dealt');
const crit=combat.strike(hero,foe,foeHp,0.95).dmg, normal=calc.compute(hero,foe,0.5);
assert(crit===normal*2, 'a crit doubles the damage');
while(!foeHp.dead) combat.strike(hero,foe,foeHp,0.95);
assert(foeHp.dead && combat.log[combat.log.length-1].killed, 'a lethal blow reports a kill');
console.log('gen combat ${th.k}/${v} OK');
`,
  };
};

T.production = (th, v, n) => {
  const a = th.goods[n % th.goods.length], b = th.goods[(n + 1) % th.goods.length], out = th.goods[(n + 2) % th.goods.length];
  const byproduct = v === 'byproduct';
  const outputs = byproduct ? `{'${out}':1,'scrap':1}` : `{'${out}':1}`;
  return {
    genre: 'simulation',
    doc: `A ${th.k} production chain: a ResourceStore, a Recipe turning ${a}+${b} into ${out}${byproduct ? ' plus a byproduct' : ''}, and a Producer that consumes inputs each tick and stalls when they run short.`,
    instr: `Write a runnable vanilla JavaScript simulation systems module: a resource store, a recipe, and a producer that consumes inputs each tick and stalls cleanly when short — separate classes, no shared globals, with a self-checking demo.`,
    code: ASSERT + `
class ResourceStore { constructor(init){this.amounts=new Map(Object.entries(init||{}));} get(id){return this.amounts.get(id)||0;} add(id,n){this.amounts.set(id,this.get(id)+n);} take(id,n){if(this.get(id)<n)return false;this.amounts.set(id,this.get(id)-n);return true;} canTake(m){for(const id in m)if(this.get(id)<m[id])return false;return true;} }
class Recipe { constructor(inp,out){this.inputs=inp;this.outputs=out;} }
class Producer { constructor(s,r){this.store=s;this.recipe=r;this.made=0;} tick(){if(!this.store.canTake(this.recipe.inputs))return false;for(const id in this.recipe.inputs)this.store.take(id,this.recipe.inputs[id]);for(const id in this.recipe.outputs)this.store.add(id,this.recipe.outputs[id]);this.made+=1;return true;} }
const store=new ResourceStore({'${a}':${6 + (n % 6)},'${b}':${4 + (n % 5)}});
const recipe=new Recipe({'${a}':2,'${b}':1}, ${outputs});
const producer=new Producer(store,recipe);
const a0=store.get('${a}');
assert(producer.tick(), 'the first cycle runs');
assert(store.get('${a}')===a0-2, 'inputs were consumed');
assert(store.get('${out}')===1, 'an output was produced');
let runs=1; while(producer.tick()) runs+=1;
assert(producer.made===runs, 'made count matches successful cycles');
assert(!store.canTake(recipe.inputs), 'production stalls once an input runs short');
console.log('gen production ${th.k}/${v} OK');
`,
  };
};

T.scoring = (th, v, n) => {
  const step = v === 'fast' ? 3 : v === 'slow' ? 8 : 5;
  return {
    genre: 'action',
    doc: `A ${th.k} scoring system: a ComboMeter that grows while hits land inside a window and resets on a gap, and a Score scaled by the meter's multiplier (one extra times factor per ${step}-combo).`,
    instr: `Write a runnable vanilla JavaScript action systems module: a combo meter with a timing window and a score scaled by its multiplier — separate classes, no shared globals, with a self-checking demo.`,
    code: ASSERT + `
class ComboMeter { constructor(w){this.window=w;this.count=0;this.last=-Infinity;} hit(now){if(now-this.last<=this.window)this.count+=1;else this.count=1;this.last=now;return this.count;} multiplier(){return 1+Math.floor(this.count/${step});} }
class Score { constructor(m){this.meter=m;this.value=0;} award(base,now){this.meter.hit(now);this.value+=base*this.meter.multiplier();return this.value;} }
const meter=new ComboMeter(${500 + (n % 4) * 250}), score=new Score(meter);
score.award(10,0);
assert(score.value===10 && meter.count===1, 'first hit scores at x1');
for(let t=100;t<=${step * 100};t+=100) score.award(10,t);
assert(meter.count>=${step}, 'rapid hits build the combo past the step');
assert(meter.multiplier()>=2, 'multiplier rises with the combo');
const before=score.value;
score.award(10,100000);
assert(meter.count===1, 'a long gap resets the combo');
assert(score.value===before+10, 'the reset hit scores at x1 again');
console.log('gen scoring ${th.k}/${v} OK');
`,
  };
};

T.spawner = (th, v, n) => {
  const ramp = v === 'step' ? `return Math.max(1,this.base-Math.floor(wave/2)*2);` : `return Math.max(1,this.base-wave);`;
  return {
    genre: 'action',
    doc: `A ${th.k} spawner: an object Pool that recycles ${th.foe} instances, and a Spawner that releases them on a ${v} ramping interval. Reuse means no per-spawn allocation.`,
    instr: `Write a runnable vanilla JavaScript action systems module: an object pool that recycles enemies and a spawner with a ${v} ramping interval — separate classes, no shared globals, with a self-checking demo.`,
    code: ASSERT + `
class Pool { constructor(){this.free=[];this.live=[];this.created=0;} acquire(kind){let e=this.free.pop();if(!e){e={kind:null,hp:0,alive:false};this.created+=1;}e.kind=kind;e.hp=10;e.alive=true;this.live.push(e);return e;} release(e){e.alive=false;const i=this.live.indexOf(e);if(i>=0)this.live.splice(i,1);this.free.push(e);} }
class Spawner { constructor(p,base){this.pool=p;this.base=base;this.t=0;this.spawned=0;} interval(wave){ ${ramp} } tick(wave){this.t+=1;if(this.t>=this.interval(wave)){this.t=0;this.spawned+=1;return this.pool.acquire('${th.foe}');}return null;} }
const pool=new Pool(), spawner=new Spawner(pool,${4 + (n % 4)});
let s=0; for(let i=0;i<spawner.interval(0);i++) if(spawner.tick(0)) s+=1;
assert(s===1, 'one enemy spawns over one interval');
assert(pool.created===1, 'the pool allocated exactly one');
pool.release(pool.live[0]);
for(let i=0;i<spawner.interval(1);i++) spawner.tick(1);
assert(pool.created===1, 'the next spawn reuses the pooled object');
assert(spawner.interval(3)<=spawner.interval(0), 'higher waves spawn at least as fast');
console.log('gen spawner ${th.k}/${v} OK');
`,
  };
};

T.timer = (th, v, n) => {
  const many = v === 'multi';
  return {
    genre: 'casual',
    doc: `A ${th.k} power-up system: a Timer that fires one-shot alarms, and a PowerUpSystem that activates timed effects${many ? ' (several at once)' : ''} and clears them when their alarm elapses.`,
    instr: `Write a runnable vanilla JavaScript casual systems module: a timer with one-shot alarms and a power-up system that activates and expires timed effects — separate classes, no shared globals, with a self-checking demo.`,
    code: ASSERT + `
class Timer { constructor(){this.now=0;this.alarms=[];} at(delay,cb){this.alarms.push({time:this.now+delay,cb,done:false});} advance(dt){this.now+=dt;for(const a of this.alarms)if(!a.done&&this.now>=a.time){a.done=true;a.cb();}this.alarms=this.alarms.filter(a=>!a.done);} }
class PowerUpSystem { constructor(t){this.timer=t;this.active=new Set();} activate(name,dur){this.active.add(name);this.timer.at(dur,()=>this.active.delete(name));} has(name){return this.active.has(name);} }
const timer=new Timer(), power=new PowerUpSystem(timer);
power.activate('shield',${200 + (n % 4) * 100});
${many ? `power.activate('boost',${100 + (n % 3) * 100});` : ``}
assert(power.has('shield'), 'the effect is active immediately');
timer.advance(50);
assert(power.has('shield'), 'it stays active before its duration');
timer.advance(100000);
assert(!power.has('shield'), 'it expires after its duration');
assert(timer.alarms.length===0, 'elapsed alarms are cleaned up');
console.log('gen timer ${th.k}/${v} OK');
`,
  };
};

T.lives = (th, v, n) => {
  const bonus = v === 'bonus';
  return {
    genre: 'casual',
    doc: `A ${th.k} run-state: a Lives counter that ends the run at zero, a Score with a tracked best${bonus ? ' that grants a bonus life at a threshold' : ''}, and a GameState machine the two feed into.`,
    instr: `Write a runnable vanilla JavaScript casual systems module: lives, a score with a tracked best${bonus ? ' and bonus lives' : ''}, and a game-state machine — separate classes, no shared globals, with a self-checking demo.`,
    code: ASSERT + `
class Lives { constructor(n){this.count=n;} lose(){this.count=Math.max(0,this.count-1);return this.count;} gain(){this.count+=1;} get gameOver(){return this.count===0;} }
class Score { constructor(){this.value=0;this.best=0;} add(n){this.value+=n;if(this.value>this.best)this.best=this.value;return this.value;} reset(){this.value=0;} }
class GameState { constructor(l,s){this.lives=l;this.score=s;this.phase='playing';${bonus ? `this.threshold=${100 + (n % 5) * 50};this.awarded=false;` : ``}} update(){${bonus ? `if(!this.awarded&&this.score.value>=this.threshold){this.lives.gain();this.awarded=true;}` : ``}if(this.lives.gameOver)this.phase='gameover';return this.phase;} }
const lives=new Lives(${2 + (n % 3)}), score=new Score(), state=new GameState(lives,score);
score.add(${60 + (n % 5) * 40});
assert(score.best===score.value, 'best tracks the running total');
${bonus ? `const had=lives.count; state.update(); assert(lives.count===had+1, 'a bonus life is granted at the threshold');` : ``}
while(!lives.gameOver) lives.lose();
assert(state.update()==='gameover', 'game over once lives reach zero');
score.reset();
assert(score.value===0 && score.best>0, 'a reset clears the score but keeps the best');
console.log('gen lives ${th.k}/${v} OK');
`,
  };
};

T.quest = (th, v, n) => {
  const itemReward = v === 'item';
  const g = th.goods[n % th.goods.length];
  return {
    genre: 'adventure',
    doc: `A ${th.k} quest loop: a QuestLog tracking objective progress, a ${itemReward ? 'an Inventory' : 'a Wallet'} the reward pays into, and a RewardGranter that pays out exactly once when a quest completes. The log never touches the ${itemReward ? 'inventory' : 'wallet'} directly.`,
    instr: `Write a runnable vanilla JavaScript adventure systems module: a quest log with objective progress and a reward granter that pays ${itemReward ? 'an item' : 'currency'} once on completion — separate classes, no shared globals, with a self-checking demo.`,
    code: ASSERT + `
${itemReward
        ? `class Inventory { constructor(){this.goods=new Map();} add(id,q){this.goods.set(id,(this.goods.get(id)||0)+q);} count(id){return this.goods.get(id)||0;} }`
        : `class Wallet { constructor(b){this.balance=b;} credit(n){this.balance+=n;} }`}
class QuestLog {
  constructor(){this.quests=new Map();}
  accept(id,goal){this.quests.set(id,{goal,progress:0,done:false,claimed:false});}
  progress(id,n){const q=this.quests.get(id);if(!q||q.done)return;q.progress+=n;if(q.progress>=q.goal)q.done=true;}
  isDone(id){const q=this.quests.get(id);return !!q&&q.done;}
  claim(id){const q=this.quests.get(id);if(!q||!q.done||q.claimed)return false;q.claimed=true;return true;}
}
class RewardGranter {
  constructor(log,sink,reward){this.log=log;this.sink=sink;this.reward=reward;}
  grant(id){ if(!this.log.claim(id)) return false; ${itemReward ? `this.sink.add('${g}',this.reward);` : `this.sink.credit(this.reward);`} return true; }
}
const log=new QuestLog(), sink=${itemReward ? 'new Inventory()' : 'new Wallet(0)'}, granter=new RewardGranter(log,sink,${5 + (n % 5)});
log.accept('q1',${2 + (n % 3)});
assert(!granter.grant('q1'), 'no reward before the quest is done');
log.progress('q1',1); log.progress('q1',5);
assert(log.isDone('q1'), 'the quest completes when the goal is met');
assert(granter.grant('q1'), 'the reward is granted on completion');
assert(${itemReward ? `sink.count('${g}')===${5 + (n % 5)}` : `sink.balance===${5 + (n % 5)}`}, 'the reward paid the right amount');
assert(!granter.grant('q1'), 'a completed quest cannot be claimed twice');
console.log('gen quest ${th.k}/${v} OK');
`,
  };
};

T.needs = (th, v, n) => {
  const three = v === 'three';
  return {
    genre: 'simulation',
    doc: `A ${th.k} needs simulation: a Need that decays each tick and clamps at zero, a NeedsSystem aggregating ${three ? 'three needs' : 'two needs'}, and a Mood derived from their average. Satisfying a need raises it; the mood reads but never writes the needs.`,
    instr: `Write a runnable vanilla JavaScript simulation systems module: decaying need meters, a needs system, and a mood derived from them — separate classes, no shared globals, with a self-checking demo.`,
    code: ASSERT + `
class Need { constructor(name,value,decay){this.name=name;this.value=value;this.decay=decay;} tick(){this.value=Math.max(0,this.value-this.decay);} satisfy(n){this.value=Math.min(100,this.value+n);} }
class NeedsSystem { constructor(needs){this.needs=needs;} tick(){for(const x of this.needs)x.tick();} average(){let s=0;for(const x of this.needs)s+=x.value;return s/this.needs.length;} get(name){return this.needs.find(x=>x.name===name);} }
class Mood { constructor(sys){this.sys=sys;} label(){const a=this.sys.average();return a>66?'happy':a>33?'okay':'sad';} }
const sys=new NeedsSystem([new Need('food',${50 + (n % 40)},${3 + (n % 3)}),new Need('rest',${40 + (n % 30)},${2 + (n % 3)})${three ? `,new Need('fun',60,4)` : ``}]);
const mood=new Mood(sys);
const a0=sys.average();
sys.tick();
assert(sys.average()<a0, 'needs decay on a tick');
const food=sys.get('food'), low=food.value;
food.satisfy(100);
assert(food.value>low && food.value<=100, 'satisfying raises a need and clamps at 100');
for(let i=0;i<100;i++) sys.tick();
assert(sys.average()>=0, 'needs never go below zero');
assert(['happy','okay','sad'].includes(mood.label()), 'mood is one of the defined labels');
console.log('gen needs ${th.k}/${v} OK');
`,
  };
};

T.invequip = (th, v, n) => {
  const weighted = v === 'weighted';
  return {
    genre: 'rpg',
    doc: `A ${th.k} inventory + equipment system: an Inventory${weighted ? ' with a weight capacity' : ' that stacks items'}, an Equipment system that swaps gear between bag and slots while applying stat modifiers, and a Character whose effective stats reflect what is worn.`,
    instr: `Write a runnable vanilla JavaScript rpg systems module: an inventory${weighted ? ' with a weight limit' : ''}, an equipment system that applies stat modifiers, and a character — separate classes, no shared globals, with a self-checking demo.`,
    code: ASSERT + `
class Inventory {
  constructor(${weighted ? 'cap' : ''}){this.slots=new Map();${weighted ? 'this.cap=cap;this.weight=0;' : ''}}
  add(item,q=1){${weighted ? 'if(this.weight+(item.weight||0)*q>this.cap)return false;this.weight+=(item.weight||0)*q;' : ''}const e=this.slots.get(item.id);if(e)e.qty+=q;else this.slots.set(item.id,{item,qty:q});return true;}
  remove(id,q=1){const e=this.slots.get(id);if(!e||e.qty<q)return null;e.qty-=q;${weighted ? 'this.weight-=(e.item.weight||0)*q;' : ''}if(e.qty===0)this.slots.delete(id);return e.item;}
  has(id){return this.slots.has(id);}
}
class Equipment {
  constructor(inv){this.inv=inv;this.worn=new Map();}
  equip(id){const item=this.inv.remove(id,1);if(!item)return false;const prev=this.worn.get(item.slot);if(prev)this.inv.add(prev,1);this.worn.set(item.slot,item);return true;}
  unequip(slot){const item=this.worn.get(slot);if(!item)return false;this.worn.delete(slot);this.inv.add(item,1);return true;}
  bonus(stat){let t=0;for(const it of this.worn.values())t+=(it.mods&&it.mods[stat])||0;return t;}
}
class Character { constructor(base,eq){this.base=base;this.equipment=eq;} stat(name){return (this.base[name]||0)+this.equipment.bonus(name);} }
const inv=new Inventory(${weighted ? '100' : ''}), eq=new Equipment(inv), hero=new Character({attack:5,defense:2},eq);
const weapon={id:'${th.unit}',slot:'hand',mods:{attack:${3 + (n % 5)}}${weighted ? ',weight:10' : ''}};
inv.add(weapon,1);
const base=hero.stat('attack');
eq.equip('${th.unit}');
assert(hero.stat('attack')===base+${3 + (n % 5)}, 'equipping raises the stat');
assert(!inv.has('${th.unit}'), 'the equipped item left the bag');
eq.unequip('hand');
assert(hero.stat('attack')===base, 'unequipping returns the stat to base');
assert(inv.has('${th.unit}'), 'the item returned to the bag');
console.log('gen invequip ${th.k}/${v} OK');
`,
  };
};

T.collision = (th, v, n) => {
  const cell = 24 + (n % 4) * 8;
  return {
    genre: 'action',
    doc: `A ${th.k} collision system: a SpatialHash that buckets entities into ${cell}px cells (broad phase) and an axis-aligned overlap test (narrow phase), with a CollisionSystem returning colliding pairs. The phases are separate.`,
    instr: `Write a runnable vanilla JavaScript action systems module: a spatial-hash broad phase and an AABB narrow phase that report colliding pairs — separate classes, no shared globals, with a self-checking demo.`,
    code: ASSERT + `
function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
class SpatialHash {
  constructor(cell){this.cell=cell;this.buckets=new Map();}
  key(cx,cy){return cx+','+cy;}
  insert(e){const k=this.key(Math.floor(e.x/this.cell),Math.floor(e.y/this.cell));if(!this.buckets.has(k))this.buckets.set(k,[]);this.buckets.get(k).push(e);}
  near(e){const out=[];const cx=Math.floor(e.x/this.cell),cy=Math.floor(e.y/this.cell);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){const b=this.buckets.get(this.key(cx+dx,cy+dy));if(b)for(const o of b)if(o!==e)out.push(o);}return out;}
}
class CollisionSystem {
  constructor(h){this.hash=h;}
  pairs(){const seen=new Set(),res=[];for(const b of this.hash.buckets.values())for(const e of b)for(const o of this.hash.near(e)){const id=e.id<o.id?e.id+'|'+o.id:o.id+'|'+e.id;if(seen.has(id))continue;seen.add(id);if(overlaps(e,o))res.push([e.id,o.id]);}return res;}
}
const hash=new SpatialHash(${cell});
const a={id:'a',x:10,y:10,w:8,h:8}, b={id:'b',x:14,y:12,w:8,h:8}, c={id:'c',x:300,y:300,w:8,h:8};
[a,b,c].forEach(e=>hash.insert(e));
assert(overlaps(a,b)&&!overlaps(a,c), 'aabb test distinguishes overlap from gap');
const found=new CollisionSystem(hash).pairs();
assert(found.length===1, 'exactly one colliding pair found');
assert(found[0].includes('a')&&found[0].includes('b'), 'the pair is a and b');
assert(hash.near(c).length===0, 'the far entity has no neighbours');
console.log('gen collision ${th.k}/${v} OK');
`,
  };
};

T.dialogue = (th, v, n) => {
  const branch = v === 'branch';
  return {
    genre: 'adventure',
    doc: `A ${th.k} dialogue system: a Flags store of world booleans and a DialogueTree whose choices branch between nodes and set or require flags. Choosing advances the tree and writes through to Flags; the tree keeps no global state.`,
    instr: `Write a runnable vanilla JavaScript adventure systems module: a flags store and a branching dialogue tree whose choices set and require flags — separate classes, no shared globals, with a self-checking demo.`,
    code: ASSERT + `
class Flags { constructor(){this.map=new Map();} set(name,val=true){this.map.set(name,val);} get(name){return this.map.get(name)||false;} }
class DialogueTree {
  constructor(nodes,flags){this.nodes=nodes;this.flags=flags;this.current='start';}
  node(){return this.nodes[this.current];}
  choices(){return this.node().choices.filter(c=>!c.requires||this.flags.get(c.requires));}
  choose(i){const c=this.choices()[i];if(!c)return false;if(c.sets)this.flags.set(c.sets);this.current=c.to;return true;}
  get done(){return this.node().choices.length===0;}
}
const flags=new Flags();
const nodes={
  start:{choices:[{text:'help',to:'helped',sets:'kind'},{text:'rob',to:'${branch ? 'feared' : 'caught'}'}]},
  helped:{choices:[{text:'ask',to:'reward',requires:'kind'}]},
  ${branch ? `feared:{choices:[]},` : `caught:{choices:[]},`}
  reward:{choices:[]},
};
const dlg=new DialogueTree(nodes,flags);
assert(dlg.choices().length===2, 'two opening choices');
dlg.choose(0);
assert(flags.get('kind'), 'the choice set its flag');
assert(dlg.current==='helped', 'the tree advanced');
assert(dlg.choices().length===1, 'the flag unlocks the gated choice');
dlg.choose(0);
assert(dlg.current==='reward'&&dlg.done, 'reached a terminal node');
console.log('gen dialogue ${th.k}/${v} OK');
`,
  };
};

T.rooms = (th, v, n) => {
  return {
    genre: 'adventure',
    doc: `A ${th.k} navigation system: a RoomGraph with optionally locked exits, an Inventory of keys, and a Navigator that moves between rooms, spending a key to pass a locked door. The graph and inventory stay independent.`,
    instr: `Write a runnable vanilla JavaScript adventure systems module: a room graph with locked exits, a key inventory, and a navigator that consumes a key to pass a locked door — separate classes, no shared globals, with a self-checking demo.`,
    code: ASSERT + `
class Inventory { constructor(){this.items=new Set();} add(id){this.items.add(id);} has(id){return this.items.has(id);} take(id){return this.items.delete(id);} }
class RoomGraph { constructor(rooms){this.rooms=rooms;} exit(room,dir){const r=this.rooms[room];return (r&&r.exits[dir])||null;} }
class Navigator {
  constructor(g,inv,start){this.graph=g;this.inv=inv;this.room=start;}
  move(dir){const e=this.graph.exit(this.room,dir);if(!e)return {ok:false,reason:'no exit'};if(e.locked&&!this.inv.has(e.key))return {ok:false,reason:'locked'};if(e.locked)this.inv.take(e.key);this.room=e.to;return {ok:true,reason:'moved'};}
}
const graph=new RoomGraph({
  start:{exits:{north:{to:'vault',locked:true,key:'${th.goods[n % th.goods.length]}'},east:{to:'side'}}},
  side:{exits:{west:{to:'start'}}},
  vault:{exits:{}},
});
const inv=new Inventory(), nav=new Navigator(graph,inv,'start');
assert(nav.move('north').reason==='locked', 'the door is locked without a key');
assert(nav.move('east').ok&&nav.room==='side', 'an open exit moves the player');
nav.move('west');
inv.add('${th.goods[n % th.goods.length]}');
assert(nav.move('north').ok&&nav.room==='vault', 'the key opens the locked door');
assert(!inv.has('${th.goods[n % th.goods.length]}'), 'the key was consumed');
console.log('gen rooms ${th.k}/${v} OK');
`,
  };
};

T.match = (th, v, n) => {
  const colMatch = v === 'col';
  const grid = colMatch
    ? `[['a','b','c'],['a','b','d'],['a','d','c']]`     // column 0 -> a,a,a
    : `[['a','a','a'],['b','c','b'],['c','b','c']]`;    // row 0 -> a,a,a
  return {
    genre: 'casual',
    doc: `A ${th.k} match board: a Board that detects ${colMatch ? 'vertical' : 'horizontal'} runs of three, clears and refills them from an injected deterministic RNG, and a Score reacting to cleared tiles. Scoring is its own system; the RNG is injected for testability.`,
    instr: `Write a runnable vanilla JavaScript casual systems module: a match-3 board with match detection, clearing, gravity and refill from an injected RNG, plus a score — separate classes, no shared globals, with a self-checking demo.`,
    code: ASSERT + `
function mulberry32(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
class Board {
  constructor(grid,rng,colors){this.grid=grid;this.rng=rng;this.colors=colors;this.rows=grid.length;this.cols=grid[0].length;}
  findMatches(){const marks=new Set();const mk=(r,c)=>marks.add(r+','+c);
    for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols-2;c++){const v=this.grid[r][c];if(v!=null&&v===this.grid[r][c+1]&&v===this.grid[r][c+2]){mk(r,c);mk(r,c+1);mk(r,c+2);}}
    for(let c=0;c<this.cols;c++)for(let r=0;r<this.rows-2;r++){const v=this.grid[r][c];if(v!=null&&v===this.grid[r+1][c]&&v===this.grid[r+2][c]){mk(r,c);mk(r+1,c);mk(r+2,c);}}
    return marks;}
  clear(marks){for(const k of marks){const p=k.split(',');this.grid[+p[0]][+p[1]]=null;}return marks.size;}
  collapse(){for(let c=0;c<this.cols;c++){let w=this.rows-1;for(let r=this.rows-1;r>=0;r--)if(this.grid[r][c]!=null){this.grid[w][c]=this.grid[r][c];if(w!==r)this.grid[r][c]=null;w-=1;}for(let r=w;r>=0;r--)this.grid[r][c]=this.colors[Math.floor(this.rng()*this.colors.length)];}}
}
class Score { constructor(){this.value=0;} cleared(n){this.value+=n*10;return this.value;} }
const board=new Board(${grid}, mulberry32(${1 + (n % 99)}), ['a','b','c','d']), score=new Score();
const m=board.findMatches();
assert(m.size===3, 'three tiles match in a line');
score.cleared(board.clear(m));
assert(score.value===30, 'three cleared tiles score thirty');
board.collapse();
let full=true; for(let r=0;r<3;r++)for(let c=0;c<3;c++) if(board.grid[r][c]==null) full=false;
assert(full, 'gravity and refill leave no gaps');
console.log('gen match ${th.k}/${v} OK');
`,
  };
};

// ---- variant menus per template ----
const VARIANTS = {
  economy: ['inverse', 'linear', 'fixed', 'taxed'],
  leveling: ['linear', 'quadratic', 'geometric'],
  combat: ['subtract', 'ratio', 'dodge'],
  invequip: ['basic', 'weighted'],
  production: ['plain', 'byproduct'],
  scoring: ['normal', 'fast', 'slow'],
  spawner: ['linear', 'step'],
  collision: ['grid', 'pairs'],
  timer: ['single', 'multi'],
  lives: ['plain', 'bonus'],
  match: ['row', 'col'],
  quest: ['currency', 'item'],
  dialogue: ['gate', 'branch'],
  rooms: ['locked', 'open'],
  needs: ['two', 'three'],
};
// even coverage: which templates feed each genre
const GENRE_TEMPLATES = {
  rpg: ['leveling', 'combat', 'invequip'],
  action: ['scoring', 'spawner', 'collision'],
  adventure: ['quest', 'dialogue', 'rooms'],
  casual: ['timer', 'lives', 'match'],
  simulation: ['economy', 'production', 'needs'],
};

// ---- build the seed rows from the hand-authored files (canonical anchors) ----
function headerDoc(code) {
  const m = code.match(/^﻿?\s*\/\*\*?([\s\S]*?)\*\//);
  if (!m) return null;
  return m[1].split('\n').map(s => s.replace(/^\s*\*?\s?/, '').trim()).filter(Boolean).join(' ').trim() || null;
}
const GENRES = ['rpg', 'action', 'adventure', 'casual', 'simulation'];
const rows = [];
const seenCode = new Set();
function tryExec(code) {
  const a = analyze(code);
  if (!a.syntax || a.free.length) return { ok: false, why: a.syntax ? 'free:' + a.free.slice(0, 3) : 'syntax' };
  if (code.length > 14000) return { ok: false, why: 'too-big' };
  const f = join(TMP, 'c_' + createHash('sha1').update(code).digest('hex').slice(0, 12) + '.js');
  writeFileSync(f, code, 'utf8');
  try { execFileSync('node', [f], { timeout: 8000, stdio: 'pipe' }); return { ok: true }; }
  catch (e) { return { ok: false, why: ((e.stderr || '').toString().split('\n').filter(Boolean).pop() || 'run-fail').slice(0, 80) }; }
}
function pushRow(genre, instr, code) {
  const h = createHash('sha1').update(code.replace(/\s+/g, ' ').trim()).digest('hex');
  if (seenCode.has(h)) return false;
  seenCode.add(h);
  rows.push({ messages: [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: instr },
    { role: 'assistant', content: '```javascript\n' + code.trim() + '\n```' },
  ] });
  return true;
}

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

// 1) seeds
for (const genre of GENRES) {
  const dir = join(HERE, genre);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter(x => x.endsWith('.js'))) {
    const code = readFileSync(join(dir, f), 'utf8');
    const doc = headerDoc(code) || `${genre} systems module`;
    pushRow(genre, `Write a complete, self-contained, runnable vanilla JavaScript ${genre} game-systems module — separate classes that communicate without shared globals, ending in a small self-checking demo that asserts the behaviour. ${doc}`, code);
  }
}
const seedCount = rows.length;

// 2) synthesize variants — fill each genre to an even quota so coverage is balanced
let made = 0, failed = 0;
const genreCount = {};
for (const r of rows) { const g = (r.messages[1].content.match(/JavaScript (\w+)/) || [, '?'])[1]; genreCount[g] = (genreCount[g] || 0) + 1; }
const QUOTA = Math.ceil(TARGET / 5);                         // ~40 rows per genre
for (const genre of GENRES) {
  const tpls = GENRE_TEMPLATES[genre];
  for (let pass = 0; pass < 8 && (genreCount[genre] || 0) < QUOTA && rows.length < TARGET; pass++) {
    for (const name of tpls) {
      for (const v of VARIANTS[name]) {
        for (let ti = 0; ti < themes.length; ti++) {
          if ((genreCount[genre] || 0) >= QUOTA || rows.length >= TARGET) break;
          const th = themes[ti];
          const n = pass * 11 + ti * 3 + 1;
          let built; try { built = T[name](th, v, n); } catch { continue; }
          const res = tryExec(built.code);
          if (!res.ok) { failed++; continue; }
          if (pushRow(built.genre, built.instr, built.code)) { made++; genreCount[genre] = (genreCount[genre] || 0) + 1; }
        }
      }
    }
  }
}

rmSync(TMP, { recursive: true, force: true });
const outPath = join(FACTORY, 'dataset_systems.jsonl');
writeFileSync(outPath, rows.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');

// genre tally
const tally = {};
for (const r of rows) { const g = (r.messages[1].content.match(/JavaScript (\w+)/) || [, '?'])[1]; tally[g] = (tally[g] || 0) + 1; }
console.log(`\n=== systems @ ${TARGET} (gate + execution verified) ===`);
console.log(`  seeds (hand-authored):  ${seedCount}`);
console.log(`  synthesized & proven:   ${made}   (rejected by exec/gate/dup: ${failed})`);
console.log(`  total rows:             ${rows.length}`);
console.log(`  by genre:`, tally);
console.log(`  -> ${outPath}`);
if (rows.length < TARGET) console.log(`  ⚠ short of ${TARGET} — add templates/variants or numeric passes.`);
