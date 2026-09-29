// 游戏主逻辑：状态机、楼层 / 房间切换、拾取与商店、死亡与通关。

import { RNG, DIR_VEC, DIR_OPPOSITE, clamp } from './util.js';
import { generateFloor, ROOM_TYPE, attachDevilRoom } from './floor.js';
import { generateRoomContents } from './roomgen.js';
import { Room } from './room.js';
import { Player } from './player.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { ROOM_PLAY_W, ROOM_PLAY_H, FloatText, Pickup } from './entities.js';
import { TILE, WALL, ROOM_PX_W, ROOM_PX_H, buildObstacleSprites, buildPickupSprites } from './tiles.js';
import { buildEnemySprites, buildBossSprites } from './sprites.js';
import { rollItem, ACTIVE_ITEMS } from './items.js';
import { CHAPTERS } from './palette.js';
import { rgba } from './gfx.js';

const MAX_LEVEL = 8;

export class Game {
  constructor(canvas) {
    this.renderer = new Renderer(canvas);
    this.hud = new Hud(this.renderer);
    this.audio = new Audio();
    this.input = new Input();

    // 所有精灵在启动时烘焙一次
    buildEnemySprites();
    buildBossSprites();
    buildPickupSprites();
    buildObstacleSprites(CHAPTERS[0]);

    this.state = 'title';
    this.transition = null;
    this.snapshot = document.createElement('canvas');
    this.snapshot.width = ROOM_PX_W;
    this.snapshot.height = ROOM_PX_H;

    this.stats = { rooms: 0, kills: 0, time: 0 };
    this.seed = (Math.random() * 1e9) | 0;
  }

  // --- 生命周期 -----------------------------------------------------------

  start(seed) {
    this.seed = seed !== undefined ? seed : (Math.random() * 1e9) | 0;
    this.rng = new RNG(this.seed);
    this.player = new Player(this);
    this.player.setActiveItem(ACTIVE_ITEMS.find((a) => a.id === 'd6') || ACTIVE_ITEMS[0]);
    this.level = 1;
    this.stats = { rooms: 0, kills: 0, time: 0 };
    this.state = 'playing';
    this.loadFloor(1);
    this.audio.ensure();
    this.audio.startMusic(0);
  }

  loadFloor(level) {
    this.level = level;
    this.tookRedDamageThisFloor = false;
    this.floor = generateFloor(level, this.rng.int(1 << 30) + 1);
    this.floorRng = new RNG(this.floor.seed || (this.rng.int(1 << 30) + 1));
    buildObstacleSprites(CHAPTERS[Math.min(CHAPTERS.length - 1, Math.floor((level - 1) / 2))]);
    // 先把所有房间内容一次性掷出来，保证同一层反复进出内容一致
    for (const node of this.floor.rooms) {
      generateRoomContents(node, this.floorRng, level);
    }
    this.enterRoom(this.floor.start, null, true);
  }

  enterRoom(node, fromDir, instant = false) {
    const prevRoom = this.room;
    if (prevRoom) this.saveRoomState(prevRoom);

    this.node = node;
    node.visited = true;
    this.stats.rooms++;
    // 标记邻居为「已知」，小地图会以暗色显示
    for (const door of node.doors) {
      if (door && !door.hidden) door.to.adjacentVisited = true;
    }

    this.room = new Room(node, this.floor, this, this.floorRng);

    // 玩家从对面的门口走进来
    if (fromDir !== null && fromDir !== undefined) {
      const entry = DIR_OPPOSITE[fromDir];
      const pos = {
        0: [ROOM_PLAY_W / 2, 26],
        1: [ROOM_PLAY_W - 26, ROOM_PLAY_H / 2],
        2: [ROOM_PLAY_W / 2, ROOM_PLAY_H - 26],
        3: [26, ROOM_PLAY_H / 2],
      }[entry];
      this.player.x = pos[0]; this.player.y = pos[1];
      this.player.vx = 0; this.player.vy = 0;
    } else {
      this.player.x = ROOM_PLAY_W / 2;
      this.player.y = ROOM_PLAY_H / 2;
    }

    // 刚进门的短暂无敌，免得被守在门口的敌人白嫖一下
    this.player.invuln = Math.max(this.player.invuln, 0.6);
    // 把叠在玩家身上的敌人推开，避免一进门就贴脸
    for (const e of this.room.enemies) {
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      const min = e.r + this.player.r + 14;
      if (d < min) {
        const a = d < 0.01 ? Math.random() * Math.PI * 2 : Math.atan2(e.y - this.player.y, e.x - this.player.x);
        e.x = clamp(this.player.x + Math.cos(a) * min, e.r, ROOM_PLAY_W - e.r);
        e.y = clamp(this.player.y + Math.sin(a) * min, e.r, ROOM_PLAY_H - e.r);
      }
    }

    if (node.type === ROOM_TYPE.BOSS && !node.cleared) {
      this.audio.play('bossIntro');
      this.hud.showToast(this.room.boss ? this.room.boss.name : 'BOSS', '#e04a45');
    }
    if (node.type === ROOM_TYPE.SHOP) this.hud.showToast('商店 · 用硬币购买', '#4ad0e8');
    if (node.type === ROOM_TYPE.SACRIFICE) this.hud.showToast('献祭房 · 尖刺换取奖励', '#c22b2b');
    if (node.type === ROOM_TYPE.CURSE) this.hud.showToast('诅咒房 · 免费但危险', '#8c1f2e');
    if (node.type === ROOM_TYPE.DEVIL) this.hud.showToast('恶魔房 · 用生命交换力量', '#e04a45');
    if (node.type === ROOM_TYPE.ANGEL) this.hud.showToast('天使房 · 无偿的恩赐', '#f2eecb');

    if (!instant) {
      this.transition = { dir: fromDir, t: 0, dur: 0.28 };
    }
  }

  /** 把房间里可持久化的变化写回楼层数据 */
  saveRoomState(room) {
    const c = room.node.contents;
    if (!c) return;
    // 已被捡走的拾取物
    const remaining = room.pickups.filter((p) => !p.dead && p.kind !== 'trapdoor');
    c.pickups = remaining
      .filter((p) => p.kind !== 'pedestal' && !p.price)
      .map((p) => ({ x: p.x / TILE - 0.5, y: p.y / TILE - 0.5, kind: p.kind }));
    // 基座上的道具是否还在
    if (c.items) {
      for (const it of c.items) {
        it.taken = !remaining.some((p) => p.pedestal && p.item === it.item);
      }
    }
    if (c.shop) {
      for (const s of c.shop) {
        s.taken = !remaining.some((p) =>
          (s.kind === 'item' ? p.item === s.item : p.kind === s.kind) && p.price === s.price);
      }
    }
    c.trapdoorTaken = !room.pickups.some((p) => p.kind === 'trapdoor');
  }

  // --- 主循环 -------------------------------------------------------------

  update(dt) {
    this.hud.update(dt);

    if (this.state === 'title') {
      if (this.input.wasPressed('Space') || this.input.wasPressed('Enter')) {
        this.audio.ensure();
        this.start();
      }
      this.input.endFrame();
      return;
    }

    if (this.state === 'dead' || this.state === 'won') {
      if (this.input.wasPressed('KeyR') || this.input.wasPressed('Space')) {
        this.audio.stopMusic();
        this.start();
      }
      this.input.endFrame();
      return;
    }

    // 全局按键
    if (this.input.wasPressed('KeyM')) {
      const on = this.audio.toggleMusic();
      if (on) this.audio.startMusic(Math.floor((this.level - 1) / 2));
      this.hud.showToast(on ? '音乐 开' : '音乐 关');
    }
    if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape')) {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
    }
    if (this.state === 'paused') { this.input.endFrame(); return; }

    if (this.transition) {
      this.transition.t += dt;
      if (this.transition.t >= this.transition.dur) this.transition = null;
      // 过渡期间不更新游戏逻辑，符合原作的「切房间时世界静止」
      this.input.endFrame();
      return;
    }

    if (this.state === 'levelTransition') {
      this.levelFade -= dt;
      if (this.levelFade <= 0) {
        this.state = 'playing';
        this.loadFloor(this.level + 1);
        this.audio.startMusic(Math.floor(this.level / 2));
      }
      this.input.endFrame();
      return;
    }

    this.stats.time += dt;

    // 玩家操作
    if (this.input.wasPressed('Space')) this.player.throwBomb();
    if (this.input.wasPressed('KeyE') || this.input.wasPressed('KeyQ')) this.player.useActive();

    this.player.update(dt, this.input, this.room, this);
    this.room.update(dt, this);
    this.checkDoors();
    this.checkSecretReveal();
    this.checkMachines();

    this.input.endFrame();
  }

  /** 玩家走到门口就切房间 */
  checkDoors() {
    const p = this.player;
    const margin = 12;
    for (let d = 0; d < 4; d++) {
      const door = this.node.doors[d];
      if (!door) continue;

      let atDoor = false;
      if (d === 0) atDoor = p.y < margin && Math.abs(p.x - ROOM_PLAY_W / 2) < TILE * 0.7;
      if (d === 2) atDoor = p.y > ROOM_PLAY_H - margin && Math.abs(p.x - ROOM_PLAY_W / 2) < TILE * 0.7;
      if (d === 3) atDoor = p.x < margin && Math.abs(p.y - ROOM_PLAY_H / 2) < TILE * 0.7;
      if (d === 1) atDoor = p.x > ROOM_PLAY_W - margin && Math.abs(p.y - ROOM_PLAY_H / 2) < TILE * 0.7;
      if (!atDoor) continue;

      if (door.hidden && !door.revealed) continue;
      if (!this.room.cleared) continue;

      if (door.locked) {
        // 上锁的门：消耗一把钥匙
        if (p.keys > 0) {
          p.keys--;
          door.locked = false;
          const back = door.to.doors[DIR_OPPOSITE[d]];
          if (back) back.locked = false;
          this.audio.play('unlock');
          this.hud.showToast('门已解锁');
        } else {
          if (!this._denyCooldown) {
            this.audio.play('deny');
            this.hud.showToast('需要一把钥匙', '#c05050');
            this._denyCooldown = 0.6;
          }
        }
        continue;
      }

      // 诅咒房的门口有尖刺，进出都要付出代价
      if ((door.to.type === ROOM_TYPE.CURSE || this.node.type === ROOM_TYPE.CURSE) && p.invuln <= 0) {
        p.hurt(1, null);
      }

      this.captureSnapshot();
      this.enterRoom(door.to, d);
      return;
    }
    if (this._denyCooldown > 0) this._denyCooldown -= 1 / 60;
  }

  /** 炸弹在墙边爆炸时揭开秘密房的入口 */
  checkSecretReveal() {
    for (const ex of this.room.explosions) {
      if (ex._checked) continue;
      ex._checked = true;
      for (let d = 0; d < 4; d++) {
        const door = this.node.doors[d];
        if (!door || !door.hidden || door.revealed) continue;
        const [cx, cy] = d === 0 ? [ROOM_PLAY_W / 2, 0]
          : d === 1 ? [ROOM_PLAY_W, ROOM_PLAY_H / 2]
          : d === 2 ? [ROOM_PLAY_W / 2, ROOM_PLAY_H]
          : [0, ROOM_PLAY_H / 2];
        if (Math.hypot(ex.x - cx, ex.y - cy) < ex.radius + 24) {
          door.revealed = true;
          const back = door.to.doors[DIR_OPPOSITE[d]];
          if (back) back.revealed = true;
          door.to.adjacentVisited = true;
          this.audio.play('doorOpen');
          this.hud.showToast('发现了隐藏的房间！', '#ffe694');
        }
      }
    }
  }

  checkMachines() {
    const p = this.player;
    for (const m of this.room.machines) {
      if (Math.hypot(p.x - m.px, p.y - m.py) > 22) { m.prompt = false; continue; }
      m.prompt = true;
      if (!this.input.wasPressed('KeyF')) continue;
      if (p.coins < 1) { this.audio.play('deny'); this.hud.showToast('硬币不够', '#c05050'); continue; }
      p.coins--;
      m.used++;
      this.audio.play('coin');
      if (m.kind === 'slot') {
        const r = this.floorRng.next();
        if (r < 0.42) this.room.dropPickup(m.px, m.py + 22, 'penny');
        else if (r < 0.58) this.room.dropPickup(m.px, m.py + 22, 'nickel');
        else if (r < 0.66) this.room.dropPickup(m.px, m.py + 22, 'heart');
        else if (r < 0.72) this.room.dropPickup(m.px, m.py + 22, 'bomb');
        else if (r < 0.76) {
          // 中大奖：直接吐一个道具
          this.spawnPedestal(m.px, m.py + 30, rollItem(this.floorRng, 'treasure', p.ownedIds));
          this.hud.showToast('中大奖！', '#ffe694');
        } else {
          this.room.texts.push(new FloatText(m.px, m.py - 12, '空', '#c8bea0'));
        }
        // 老虎机会坏掉
        if (m.used >= 4 + Math.floor(this.floorRng.next() * 4)) {
          m.broken = true;
          this.room.machines = this.room.machines.filter((x) => x !== m);
        }
      } else {
        const r = this.floorRng.next();
        if (r < 0.3) this.room.dropPickup(m.px, m.py + 22, 'heart');
        else if (r < 0.45) this.room.dropPickup(m.px, m.py + 22, 'penny');
        else if (r < 0.52) {
          this.spawnPedestal(m.px, m.py + 30, rollItem(this.floorRng, 'shop', p.ownedIds));
          this.room.machines = this.room.machines.filter((x) => x !== m);
        } else {
          this.room.texts.push(new FloatText(m.px, m.py - 12, '...', '#c8bea0'));
        }
      }
    }
  }

  spawnPedestal(x, y, item) {
    this.room.pickups.push(new Pickup(
      clamp(x, 24, ROOM_PLAY_W - 24), clamp(y, 24, ROOM_PLAY_H - 24), 'pedestal',
      { item, pedestal: true, delay: 0.4 }
    ));
  }

  // --- 拾取 ---------------------------------------------------------------

  tryPickup(pk) {
    const p = this.player;

    if (pk.kind === 'trapdoor') {
      this.descend();
      return;
    }

    // 恶魔房：用生命结算。有魂心就先花魂心，否则扣掉整颗心之容器。
    if (pk.heartPrice > 0) {
      const cost = pk.heartPrice;
      const paysWithSoul = p.soulHearts >= cost;
      if (!paysWithSoul && p.redHearts <= cost) {
        // 付不起 —— 交易会直接要了命，原作也不允许
        if (!this._denyCooldown) {
          this.audio.play('deny');
          this.hud.showToast('你付不起这个代价', '#c05050');
          this._denyCooldown = 0.6;
        }
        return;
      }
      if (paysWithSoul) {
        p.soulHearts -= cost;
      } else {
        p.redHearts -= cost;
        p.maxHearts = Math.max(2, p.maxHearts - cost);
      }
      pk.heartPrice = 0;
      this.dealtWithDevil = true;      // 做过交易之后就再也见不到天使房了
      p.hurtFlash = 0.4;
      this.audio.play('hurt');
      this.room.spawnBloodSpray(p.x, p.y - 10, 12);
    }

    // 需要付钱的商品
    if (pk.price > 0) {
      if (p.coins < pk.price) {
        if (!this._denyCooldown) {
          this.audio.play('deny');
          this.hud.showToast(`需要 ${pk.price} 枚硬币`, '#c05050');
          this._denyCooldown = 0.6;
        }
        return;
      }
      p.coins -= pk.price;
      pk.price = 0;
      this.audio.play('coin');
    }

    switch (pk.kind) {
      case 'pedestal':
        if (!pk.item) return;
        p.addItem(pk.item);
        pk.dead = true;
        return;
      case 'heart':
        if (p.redHearts >= p.maxHearts) return;   // 满血时不捡，留在地上
        p.heal(2); this.audio.play('heart'); break;
      case 'halfheart':
        if (p.redHearts >= p.maxHearts) return;
        p.heal(1); this.audio.play('heart'); break;
      case 'soulheart': p.addSoulHearts(2); this.audio.play('heart'); break;
      case 'blackheart': p.addSoulHearts(2); this.audio.play('heart'); break;
      case 'eternalheart': p.maxHearts += 2; p.heal(2); this.audio.play('heart'); break;
      case 'penny': p.coins = Math.min(99, p.coins + 1); this.audio.play('coin'); break;
      case 'nickel': p.coins = Math.min(99, p.coins + 5); this.audio.play('coin'); break;
      case 'dime': p.coins = Math.min(99, p.coins + 10); this.audio.play('coin'); break;
      case 'bomb': p.bombs = Math.min(99, p.bombs + 1); this.audio.play('pickup'); break;
      case 'key': p.keys = Math.min(99, p.keys + 1); this.audio.play('pickup'); break;
      case 'goldenkey': p.keys = Math.min(99, p.keys + 5); this.audio.play('pickup'); break;
      case 'chest':
      case 'goldchest':
      case 'redchest': {
        if (pk.kind === 'goldchest') {
          if (p.keys <= 0) {
            if (!this._denyCooldown) {
              this.audio.play('deny');
              this.hud.showToast('需要一把钥匙', '#c05050');
              this._denyCooldown = 0.6;
            }
            return;
          }
          p.keys--;
        }
        this.audio.play('unlock');
        const n = pk.kind === 'goldchest' ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const kind = this.floorRng.weighted([
            { w: 5, v: 'penny' }, { w: 3, v: 'heart' }, { w: 2, v: 'bomb' },
            { w: 2, v: 'key' }, { w: 1, v: 'soulheart' },
          ]).v;
          this.room.dropPickup(pk.x, pk.y, kind);
        }
        if (pk.kind === 'goldchest' && this.floorRng.chance(0.35)) {
          this.spawnPedestal(pk.x, pk.y - 20, rollItem(this.floorRng, 'treasure', p.ownedIds));
        }
        break;
      }
      case 'pill': {
        // 药丸：一半是好事，一半是坏事，和原作一样赌一把
        const good = this.floorRng.chance(0.6);
        if (good) {
          const eff = this.floorRng.pick(['health', 'speed', 'damage', 'range']);
          if (eff === 'health') { p.maxHearts += 2; p.heal(2); this.hud.showToast('生命上限提升'); }
          else { p.items.push({ id: 'pill_' + eff, apply: pillEffect(eff, 1) }); p.recomputeStats(); this.hud.showToast('感觉不错'); }
        } else {
          const eff = this.floorRng.pick(['speed', 'range']);
          p.items.push({ id: 'pill_bad_' + eff, apply: pillEffect(eff, -1) });
          p.recomputeStats();
          this.hud.showToast('感觉不太妙……', '#c05050');
        }
        this.audio.play('pickup');
        break;
      }
      case 'card': {
        // 卡牌：直接触发一次效果
        const eff = this.floorRng.pick(['heal', 'bombs', 'coins', 'soul']);
        if (eff === 'heal') { p.heal(4); this.hud.showToast('恋人牌 · 回复生命'); }
        if (eff === 'bombs') { p.bombs += 3; this.hud.showToast('战车牌 · 获得炸弹'); }
        if (eff === 'coins') { p.coins += 8; this.hud.showToast('命运之轮 · 获得硬币'); }
        if (eff === 'soul') { p.addSoulHearts(2); this.hud.showToast('星星牌 · 获得魂心'); }
        this.audio.play('use');
        break;
      }
      default:
        this.audio.play('pickup');
    }
    pk.dead = true;
  }

  // --- 事件回调 -----------------------------------------------------------

  onBossKilled(boss) {
    this.stats.kills++;
    this.hud.showToast(`${boss.name} 已被击败`, '#ffe694');
    this.audio.play('splat');
    this.maybeOpenDevilRoom();
  }

  /**
   * 打完 Boss 后按概率在 Boss 房墙上开一扇恶魔门 / 天使门。
   * 概率规则取自原作：本层没掉过红心会显著提高，做过恶魔交易就再也不会出天使房。
   */
  maybeOpenDevilRoom() {
    if (this.node.devilOpened) return;
    this.node.devilOpened = true;

    const chance = this.tookRedDamageThisFloor ? 0.35 : 0.7;
    if (!this.floorRng.chance(chance)) return;

    // 没跟恶魔做过交易的话，有机会来的是天使
    const angel = !this.dealtWithDevil && this.floorRng.chance(0.4);
    const type = angel ? ROOM_TYPE.ANGEL : ROOM_TYPE.DEVIL;

    const room = attachDevilRoom(this.floor, this.node, type);
    if (!room) return;
    generateRoomContents(room, this.floorRng, this.level);
    this.audio.play('doorOpen');
    this.hud.showToast(angel ? '一道圣光裂开了墙壁' : '墙上裂开了一道口子…', angel ? '#f2eecb' : '#e04a45');
  }

  onSacrifice(spike) {
    const p = this.player;
    const count = (this.node.sacrificeCount || 0) + 1;
    this.node.sacrificeCount = count;
    p.hurt(1, null);
    if (p.dead) return;
    // 献祭次数越多奖励越好，这是原作的赌博机制
    if (count === 2) this.room.dropPickup(ROOM_PLAY_W / 2, ROOM_PLAY_H / 2 + 34, 'penny');
    else if (count === 3) this.room.dropPickup(ROOM_PLAY_W / 2, ROOM_PLAY_H / 2 + 34, 'chest');
    else if (count >= 6 && !this.node.sacrificeReward) {
      this.node.sacrificeReward = true;
      this.spawnPedestal(ROOM_PLAY_W / 2, ROOM_PLAY_H / 2 + 40,
        rollItem(this.floorRng, 'angel', p.ownedIds));
      this.hud.showToast('你的虔诚得到了回应', '#f2eecb');
    }
  }

  onPlayerDied() {
    this.state = 'dead';
    this.audio.stopMusic();
    this.audio.play('death');
  }

  showItemBanner(item) {
    this.hud.showItem(item);
  }

  /** D6：把当前房间里基座上的道具重掷一遍 */
  rerollRoomItems() {
    const pedestals = this.room.pickups.filter((p) => p.pedestal && p.item && !p.price);
    if (!pedestals.length) {
      this.hud.showToast('这里没有可以重掷的道具', '#c05050');
      return false;
    }
    for (const pk of pedestals) {
      pk.item = rollItem(this.floorRng, 'treasure', this.player.ownedIds);
      this.room.spawnSplash(pk.x, pk.y - 10, '#ffe694');
    }
    this.hud.showToast('重掷完成');
    return true;
  }

  descend() {
    if (this.level >= MAX_LEVEL) {
      this.state = 'won';
      this.audio.stopMusic();
      this.audio.play('revive');
      return;
    }
    this.audio.play('stairs');
    this.state = 'levelTransition';
    this.levelFade = 1.0;
    this.captureSnapshot();
  }

  captureSnapshot() {
    const g = this.snapshot.getContext('2d');
    g.clearRect(0, 0, ROOM_PX_W, ROOM_PX_H);
    g.drawImage(this.renderer.canvas, 0, 0);
  }

  // --- 绘制 ---------------------------------------------------------------

  draw(dt) {
    const g = this.renderer.g;

    if (this.state === 'title') { this.drawTitle(g); return; }

    this.renderer.draw(this, dt);

    // 房间切换：新旧画面一起滑动
    if (this.transition) {
      const t = Math.min(1, this.transition.t / this.transition.dur);
      const e = t * t * (3 - 2 * t);   // smoothstep
      const [dx, dy] = DIR_VEC[this.transition.dir] || [0, 0];
      const offX = -dx * ROOM_PX_W * (1 - e);
      const offY = -dy * ROOM_PX_H * (1 - e);
      const cur = document.createElement('canvas');
      cur.width = ROOM_PX_W; cur.height = ROOM_PX_H;
      cur.getContext('2d').drawImage(this.renderer.canvas, 0, 0);

      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, ROOM_PX_W, ROOM_PX_H);
      g.drawImage(cur, Math.round(offX + dx * ROOM_PX_W), Math.round(offY + dy * ROOM_PX_H));
      g.drawImage(this.snapshot, Math.round(offX), Math.round(offY));
    }

    this.hud.draw(g, this);

    // 交互提示
    for (const m of this.room?.machines || []) {
      if (m.prompt) {
        this.renderer.text(g, '按 F 使用', m.px + WALL * TILE, m.py + WALL * TILE - 34, '#ffe694', 'center', 8);
      }
    }

    if (this.state === 'levelTransition') {
      g.fillStyle = rgba('#000000', 1 - this.levelFade);
      g.fillRect(0, 0, ROOM_PX_W, ROOM_PX_H);
      const chapter = CHAPTERS[Math.min(CHAPTERS.length - 1, Math.floor(this.level / 2))];
      this.renderer.text(g, `${chapter.name} ${(this.level % 2) + 1}`,
        ROOM_PX_W / 2, ROOM_PX_H / 2, rgba('#f0e8d8', 1 - this.levelFade), 'center', 16);
    }

    if (this.state === 'paused') this.drawPause(g);
    if (this.state === 'dead') this.drawGameOver(g);
    if (this.state === 'won') this.drawVictory(g);
  }

  drawTitle(g) {
    const t = this.renderer.time;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#120a08';
    g.fillRect(0, 0, ROOM_PX_W, ROOM_PX_H);

    // 背景里缓缓漂浮的血滴
    for (let i = 0; i < 26; i++) {
      const x = ((i * 97) % ROOM_PX_W);
      const y = ((i * 53 + t * (14 + i % 7) * 3) % (ROOM_PX_H + 40)) - 20;
      g.fillStyle = rgba('#6d0f14', 0.3 + (i % 5) * 0.06);
      g.fillRect(x, Math.round(y), 2, 4);
    }

    this.renderer.text(g, '以 撒 的 结 合', ROOM_PX_W / 2, 66, '#e8e0c8', 'center', 26);
    this.renderer.text(g, 'A ROGUELIKE DUNGEON CRAWLER', ROOM_PX_W / 2, 88, '#8a7a62', 'center', 8);

    const blink = Math.sin(t * 3) > -0.3;
    if (blink) {
      this.renderer.text(g, '按 空格 开始', ROOM_PX_W / 2, 130, '#ffe694', 'center', 12);
    }

    const lines = [
      'WASD 移动     方向键 / IJKL 射击',
      '空格 放置炸弹     E 使用主动道具     F 互动',
      'P 暂停     M 音乐开关     R 重开',
    ];
    lines.forEach((l, i) => {
      this.renderer.text(g, l, ROOM_PX_W / 2, 166 + i * 14, '#a89880', 'center', 8);
    });
  }

  drawPause(g) {
    g.fillStyle = rgba('#000000', 0.62);
    g.fillRect(0, 0, ROOM_PX_W, ROOM_PX_H);
    this.renderer.text(g, '暂 停', ROOM_PX_W / 2, ROOM_PX_H / 2 - 16, '#f0e8d8', 'center', 18);
    this.renderer.text(g, '按 P 继续', ROOM_PX_W / 2, ROOM_PX_H / 2 + 8, '#c8bea0', 'center', 9);
    const s = this.player.stats;
    const info = [
      `伤害 ${s.damage.toFixed(1)}   射速 ${(30 / (s.tearDelay + 1)).toFixed(2)}/秒`,
      `移速 ${s.speed.toFixed(2)}   射程 ${s.range.toFixed(1)}   弹速 ${s.shotSpeed.toFixed(2)}`,
    ];
    info.forEach((l, i) => {
      this.renderer.text(g, l, ROOM_PX_W / 2, ROOM_PX_H / 2 + 30 + i * 12, '#a89880', 'center', 8);
    });
  }

  drawGameOver(g) {
    g.fillStyle = rgba('#1a0000', 0.72);
    g.fillRect(0, 0, ROOM_PX_W, ROOM_PX_H);
    this.renderer.text(g, '你 死 了', ROOM_PX_W / 2, ROOM_PX_H / 2 - 26, '#c8302c', 'center', 24);
    const m = Math.floor(this.stats.time / 60), sec = Math.floor(this.stats.time % 60);
    const chapter = CHAPTERS[Math.min(CHAPTERS.length - 1, Math.floor((this.level - 1) / 2))];
    const lines = [
      `倒在 ${chapter.name} ${(this.level - 1) % 2 + 1}`,
      `探索房间 ${this.stats.rooms}   道具 ${this.player.items.length}`,
      `用时 ${m}:${String(sec).padStart(2, '0')}`,
    ];
    lines.forEach((l, i) => {
      this.renderer.text(g, l, ROOM_PX_W / 2, ROOM_PX_H / 2 + 4 + i * 14, '#c8bea0', 'center', 9);
    });
    this.renderer.text(g, '按 R 重新开始', ROOM_PX_W / 2, ROOM_PX_H - 30, '#ffe694', 'center', 11);
  }

  drawVictory(g) {
    g.fillStyle = rgba('#000000', 0.7);
    g.fillRect(0, 0, ROOM_PX_W, ROOM_PX_H);
    this.renderer.text(g, '通 关', ROOM_PX_W / 2, ROOM_PX_H / 2 - 30, '#ffe694', 'center', 26);
    const m = Math.floor(this.stats.time / 60), sec = Math.floor(this.stats.time % 60);
    const lines = [
      `你走完了全部 ${MAX_LEVEL} 层`,
      `探索房间 ${this.stats.rooms}   道具 ${this.player.items.length}`,
      `用时 ${m}:${String(sec).padStart(2, '0')}`,
    ];
    lines.forEach((l, i) => {
      this.renderer.text(g, l, ROOM_PX_W / 2, ROOM_PX_H / 2 + 2 + i * 14, '#c8bea0', 'center', 9);
    });
    this.renderer.text(g, '按 R 再来一次', ROOM_PX_W / 2, ROOM_PX_H - 30, '#ffe694', 'center', 11);
  }
}

function pillEffect(kind, sign) {
  return (s) => {
    if (kind === 'speed') s.speed += 0.2 * sign;
    if (kind === 'damage') s.damage += 1 * sign;
    if (kind === 'range') s.range += 2 * sign;
  };
}
