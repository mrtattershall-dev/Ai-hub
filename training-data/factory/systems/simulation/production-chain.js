/**
 * Simulation production: a ResourceStore of goods, a Recipe describing inputs -> outputs,
 * and a Producer that each tick consumes inputs from the store and yields outputs when it
 * can, stalling cleanly when inputs run short. The store is the only shared surface; the
 * producer never mutates anything it doesn't own.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

class ResourceStore {
  constructor(initial) { this.amounts = new Map(Object.entries(initial || {})); }
  get(id) { return this.amounts.get(id) || 0; }
  add(id, n) { this.amounts.set(id, this.get(id) + n); }
  take(id, n) { if (this.get(id) < n) return false; this.amounts.set(id, this.get(id) - n); return true; }
  canTake(map) { for (const id in map) if (this.get(id) < map[id]) return false; return true; }
}

class Recipe {
  constructor(inputs, outputs) { this.inputs = inputs; this.outputs = outputs; }
}

class Producer {
  constructor(store, recipe) { this.store = store; this.recipe = recipe; this.made = 0; }
  tick() {
    if (!this.store.canTake(this.recipe.inputs)) return false;
    for (const id in this.recipe.inputs) this.store.take(id, this.recipe.inputs[id]);
    for (const id in this.recipe.outputs) this.store.add(id, this.recipe.outputs[id]);
    this.made += 1;
    return true;
  }
}

// --- self-checking demo ---
const store = new ResourceStore({ ore: 5, coal: 5 });
const smelt = new Recipe({ ore: 2, coal: 1 }, { ingot: 1 });
const producer = new Producer(store, smelt);

assert(producer.tick(), 'the first smelt runs');
assert(store.get('ore') === 3 && store.get('coal') === 4, 'inputs were consumed');
assert(store.get('ingot') === 1, 'an output was produced');
let runs = 1;
while (producer.tick()) runs += 1;                             // continue until ore runs short
assert(runs === 2, 'production stops when an input runs short');
assert(producer.made === 2, 'two ingots were made in total');
assert(store.get('ore') === 1, 'leftover ore is below the recipe cost');
console.log('simulation/production-chain OK');
