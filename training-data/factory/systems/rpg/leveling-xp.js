/**
 * RPG progression: an ExperienceTrack with a rising XP curve, a LevelUp system that grants
 * stat growth for each level gained, and a Character the growth is applied to. A single XP
 * award can cross multiple levels at once. The track reports levels gained; the LevelUp
 * system owns how stats grow.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

class ExperienceTrack {
  constructor() { this.level = 1; this.xp = 0; }
  needed(level) { return level * 100; }               // xp to advance from `level` to level+1
  add(amount) {
    this.xp += amount;
    let gained = 0;
    while (this.xp >= this.needed(this.level)) {
      this.xp -= this.needed(this.level);
      this.level += 1;
      gained += 1;
    }
    return gained;
  }
}

class LevelUp {
  constructor(growth) { this.growth = growth; }       // { hp: +n, attack: +n }
  apply(character, levels) {
    for (let i = 0; i < levels; i++)
      for (const k in this.growth) character.stats[k] += this.growth[k];
  }
}

class Character {
  constructor(stats) { this.stats = stats; }
}

// --- self-checking demo ---
const track = new ExperienceTrack();
const levelup = new LevelUp({ hp: 10, attack: 2 });
const hero = new Character({ hp: 50, attack: 5 });

let gained = track.add(100);                          // exactly enough for level 1 -> 2
assert(gained === 1 && track.level === 2, 'one level gained at 100 xp');
levelup.apply(hero, gained);
assert(hero.stats.hp === 60 && hero.stats.attack === 7, 'stat growth applied once');

gained = track.add(450);                              // need(2)=200 -> level 3, 250 xp left
assert(track.level === 3 && gained === 1, 'crossed to level 3');
levelup.apply(hero, gained);
assert(hero.stats.hp === 70, 'stats grow again on the new level');
console.log('rpg/leveling-xp OK');
