'use strict';
// RD-006/007/008 (reconstruction) — Structure-of-Arrays packed world.
//
// Entities ARE integer indices. Hot per-entity state lives in dense typed
// arrays (touched every tick). Per-type component data lives in separate
// pools. Every pool is pre-sized to full capacity on purpose: that is a
// deliberate inefficiency (a crop still reserves fish- and enemy-sized slots
// it never uses) which makes the measured bytes/entity a CONSERVATIVE UPPER
// BOUND, not a best case. A production layout would size each pool to its
// real expected count and land well under this number.
//
// One shared engine drives crop/fish/enemy behaviour by dispatching on the
// type array — no per-entity objects, no per-entity methods. Zero deps.

const TYPE = { CROP: 0, FISH: 1, ENEMY: 2 };
const TYPE_NAME = ['crop', 'fish', 'enemy'];

class World {
  constructor(capacity) {
    this.capacity = capacity;
    this.count = 0;

    // --- HOT PATH: dense, one row per entity, read/written every tick ---
    this.type           = new Uint8Array(capacity);  // 1 B  crop/fish/enemy
    this.destroyed      = new Uint8Array(capacity);  // 1 B  tombstone flag
    this.harvestable    = new Uint8Array(capacity);  // 1 B  ready-to-take
    this.componentIndex = new Uint32Array(capacity); // 4 B  row into its pool

    // --- COMPONENT POOLS: per type, pre-sized to capacity (the waste) ---
    this.crop_growth  = new Uint8Array(capacity);   // crop
    this.crop_water   = new Uint8Array(capacity);
    this.crop_species = new Uint8Array(capacity);
    this.fish_depth   = new Uint8Array(capacity);   // fish
    this.fish_size    = new Uint16Array(capacity);
    this.fish_species = new Uint8Array(capacity);
    this.enemy_hp     = new Uint16Array(capacity);  // enemy
    this.enemy_damage = new Uint8Array(capacity);
    this.enemy_aggro  = new Uint8Array(capacity);

    // --- COLD: identity lives OUTSIDE the packed hot arrays, by design ---
    this.uuid = new Array(capacity);

    this._poolNext = [0, 0, 0]; // next free row per type pool
  }

  spawn(type, props = {}) {
    const e = this.count++;
    this.type[e] = type;
    this.destroyed[e] = 0;
    this.uuid[e] = 'uuid-' + e.toString(36);
    const row = this._poolNext[type]++;
    this.componentIndex[e] = row;

    if (type === TYPE.CROP) {
      this.crop_growth[row]  = props.growth  ?? 0;
      this.crop_water[row]   = props.water   ?? 0;
      this.crop_species[row] = props.species ?? 0;
      this.harvestable[e]    = (props.growth ?? 0) >= 100 ? 1 : 0;
    } else if (type === TYPE.FISH) {
      this.fish_depth[row]   = props.depth   ?? 0;
      this.fish_size[row]    = props.size    ?? 0;
      this.fish_species[row] = props.species ?? 0;
      this.harvestable[e]    = 1; // fish are catchable
    } else { // ENEMY
      this.enemy_hp[row]     = props.hp      ?? 100;
      this.enemy_damage[row] = props.damage  ?? 0;
      this.enemy_aggro[row]  = props.aggro   ?? 0;
      this.harvestable[e]    = 0; // you don't harvest an enemy
    }
    return e;
  }

  // --- one shared behaviour pass over the whole world, dispatch by type ---
  step() {
    for (let e = 0; e < this.count; e++) {
      if (this.destroyed[e]) continue;
      const row = this.componentIndex[e];
      switch (this.type[e]) {
        case TYPE.CROP:
          if (this.crop_growth[row] < 100) {
            const gain = this.crop_water[row] > 0 ? 10 : 3;
            this.crop_growth[row] = Math.min(100, this.crop_growth[row] + gain);
            if (this.crop_water[row] > 0) this.crop_water[row] -= 1;
            if (this.crop_growth[row] >= 100) this.harvestable[e] = 1;
          }
          break;
        case TYPE.FISH:
          // stays catchable; drift left as a no-op for this reconstruction
          break;
        case TYPE.ENEMY:
          if (this.enemy_aggro[row] < 255) this.enemy_aggro[row] += 1;
          break;
      }
    }
  }

  // --- validated actions (the Validator layer from RD-002) ---
  canHarvest(e) {
    if (this.destroyed[e]) return { ok: false, reason: 'target destroyed' };
    if (this.type[e] !== TYPE.CROP && this.type[e] !== TYPE.FISH)
      return { ok: false, reason: 'not a harvestable type' };
    if (!this.harvestable[e]) return { ok: false, reason: 'not ready to harvest' };
    return { ok: true };
  }
  harvest(e) {
    const v = this.canHarvest(e);
    if (!v.ok) return v;
    this.destroyed[e] = 1;
    this.harvestable[e] = 0;
    return { ok: true };
  }
  canWater(e) {
    if (this.destroyed[e]) return { ok: false, reason: 'cannot water a harvested crop' };
    if (this.type[e] !== TYPE.CROP) return { ok: false, reason: 'only crops can be watered' };
    return { ok: true };
  }
  water(e, amount = 100) {
    const v = this.canWater(e);
    if (!v.ok) return v;
    this.crop_water[this.componentIndex[e]] = amount;
    return { ok: true };
  }

  // --- deterministic memory accounting (no heap snapshots, no GC needed) ---
  hotByteLength() {
    return this.type.byteLength + this.destroyed.byteLength
         + this.harvestable.byteLength + this.componentIndex.byteLength;
  }
  packedByteLength() {
    const arrs = [
      this.type, this.destroyed, this.harvestable, this.componentIndex,
      this.crop_growth, this.crop_water, this.crop_species,
      this.fish_depth, this.fish_size, this.fish_species,
      this.enemy_hp, this.enemy_damage, this.enemy_aggro,
    ];
    return arrs.reduce((s, a) => s + a.byteLength, 0);
  }
}

module.exports = { World, TYPE, TYPE_NAME };

// --- correctness self-test: mixed 40/30/30 world through ONE engine -------
if (require.main === module) {
  const N = 1000;
  const w = new World(N);
  for (let i = 0; i < N; i++) {
    const r = i / N;
    if (r < 0.40) w.spawn(TYPE.CROP,  { growth: 0,  water: 0,  species: i % 5 });
    else if (r < 0.70) w.spawn(TYPE.FISH,  { depth: 3, size: 200, species: i % 4 });
    else w.spawn(TYPE.ENEMY, { hp: 100, damage: 5, aggro: 0 });
  }

  // run the sim until crops mature
  for (let t = 0; t < 40; t++) w.step();

  // count by type and check type-correct behaviour
  let crops = 0, fish = 0, enemies = 0, ripeCrops = 0;
  for (let e = 0; e < w.count; e++) {
    if (w.type[e] === TYPE.CROP) { crops++; if (w.harvestable[e]) ripeCrops++; }
    else if (w.type[e] === TYPE.FISH) fish++;
    else enemies++;
  }

  const checks = [];
  checks.push(['40/30/30 split preserved', crops === 400 && fish === 300 && enemies === 300]);
  checks.push(['unwatered crops matured via shared engine', ripeCrops === 400]);
  // rejections: watering a fish, harvesting an enemy, harvesting a taken crop
  const fishIdx = (() => { for (let e = 0; e < w.count; e++) if (w.type[e] === TYPE.FISH) return e; })();
  const enemyIdx = (() => { for (let e = 0; e < w.count; e++) if (w.type[e] === TYPE.ENEMY) return e; })();
  const cropIdx = (() => { for (let e = 0; e < w.count; e++) if (w.type[e] === TYPE.CROP) return e; })();
  checks.push(['watering a fish rejected',   w.water(fishIdx).ok === false]);
  checks.push(['harvesting an enemy rejected', w.harvest(enemyIdx).ok === false]);
  const firstHarvest = w.harvest(cropIdx);
  const secondHarvest = w.harvest(cropIdx);
  checks.push(['first harvest of a ripe crop succeeds', firstHarvest.ok === true]);
  checks.push(['re-harvesting a destroyed crop rejected', secondHarvest.ok === false && w.destroyed[cropIdx] === 1]);

  console.log('=== RD-006/007 correctness (mixed world, one shared engine) ===');
  for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}`);
  const allPass = checks.every(([, p]) => p);
  console.log(allPass ? '\nALL PASS' : '\nSOME FAILED');
  if (!allPass) process.exitCode = 1;
}
