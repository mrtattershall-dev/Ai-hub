export class WorldScene extends Scene {
  constructor(app) {
    super(app);
    this.camera = new Camera();
    this.particles = new ParticleSystem();
    this.dialogue = new DialogueRunner();
    /** @type {import('../entities/enemy.js').Enemy[]} */
    this.enemies = [];
    this.pickups = [];
    this.projectiles = [];
    this.solids = [];
    this.hazards = [];
  }

  /** Build the world from a level/hub definition. */
  loadLevel(def) {
    this.def = def;
    this.world = def.world;
    this.width = def.world.width;
    this.height = def.world.height;
    this.seed = hashString(def.id);

    this.solids = def.platforms.map((p) => ({ ...p }));
    this.hazards = (def.hazards ?? []).map((h) => ({ ...h }));

    this.player = new Player(this.app, def.spawn.x, def.spawn.y);
    this.camera.setBounds(0, 0, this.width, this.height);
    this.camera.snapTo(this.player.aabb);

    this.enemies = [];
    this.pickups = [];
    this.projectiles = [];
  }

  // ---- world object API used by entities ---------------------------------

  spawnProjectile(opts) {
    this.projectiles.push(new Projectile(opts));
  }

  /** Default reward handling for a killed enemy; LevelScene extends this. */
  onEnemyKilled(enemy) {
    // Scatter a few shard pickups that add up to the enemy's shard value.
    const n = Math.max(1, Math.round(enemy.def.shards / 3));
    const each = Math.ceil(enemy.def.shards / n);
    for (let i = 0; i < n; i++) {
      this._spawnShard(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, each);
    }
    this.particles.hitSpark(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.def.color, 18);
    this.camera.shake(7);
  }

  _spawnShard(x, y, value) {
    const meta = this.app.data.items.pickups.shard;
    const p = new Pickup(this.app, { kind: "shard", x, y, value }, meta);
    // Give it a little pop so drops scatter, then settle via baseUpdate gravity.
    p.vx = (Math.random() * 2 - 1) * 160;
    p.vy = -Math.random() * 200 - 80;
    this.pickups.push(p);
  }

  onPickup(_pickup) {}

  // ---- dialogue -----------------------------------------------------------

  startDialogue(lines, onComplete) {
    this.dialogue.start(lines, onComplete);
  }

  get dialogueActive() {
    return this.dialogue.active;
  }

  _updateDialogue(dt) {
    this.dialogue.update(dt);
    if (this.app.input.pressed("confirm") || this.app.input.pressed("interact")) {
      this.app.audio.sfx("cursor");
      this.dialogue.advance();
    }
  }

  // ---- shared update -------------------------------------------------------

  baseUpdate(dt) {
    if (this.dialogueActive) {
      this._updateDialogue(dt);
      return;
    }
    this.player.update(dt, this);
    for (const e of this.enemies) e.update(dt, this);
    for (const p of this.pickups) {
      // Falling shard pickups have simple gravity until they settle.
      if (p.vy != null && !p.collected) {
        p.vy += 1600 * dt;
        p.x += p.vx * dt;
        p.baseY += p.vy * dt;
        for (const s of this.solids) {
          if (s.oneWay) continue;
          if (p.baseY > s.y && p.baseY < s.y + s.h && p.x > s.x && p.x < s.x + s.w) {
            p.baseY = s.y; p.vy = null; p.vx = 0;
          }
        }
        if (p.baseY > this.height) p.collected = true;
      }
      p.update(dt, this);
    }
    for (const pr of this.projectiles) pr.update(dt, this);

    this.particles.update(dt);
    this.camera.follow(this.player, dt);

    // Cull dead/collected.
    this.enemies = this.enemies.filter((e) => e.alive);
    this.pickups = this.pickups.filter((p) => !p.collected);
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  // ---- shared render -------------------------------------------------------

  renderWorld(ctx) {
    const cam = { x: this.camera.renderX, y: this.camera.renderY };
    drawBackdrop(ctx, this.world, cam, this.seed);
    this._drawPlatforms(ctx, cam);
    this._drawHazards(ctx, cam);
    for (const p of this.pickups) p.render(ctx, cam);
    for (const e of this.enemies) e.render(ctx, cam);
    for (const pr of this.projectiles) pr.render(ctx, cam);
    this.player.render(ctx, cam);
    this.particles.render(ctx, cam);
    drawForegroundFog(ctx, this.world);
  }

  _drawPlatforms(ctx, cam) {
    for (const s of this.solids) {
      const x = s.x - cam.x;
      const y = s.y - cam.y;
      if (s.oneWay) {
        ctx.fillStyle = "#39456e";
        ctx.fillRect(x, y, s.w, 8);
        ctx.fillStyle = "#4fd1ff";
        ctx.fillRect(x, y, s.w, 2);
      } else {
        ctx.fillStyle = "#1b2138";
        ctx.fillRect(x, y, s.w, s.h);
        ctx.fillStyle = "#2a3658";
        ctx.fillRect(x, y, s.w, 6);
        ctx.fillStyle = "#4fd1ff";
        ctx.globalAlpha = 0.5;
        ctx.fillRect(x, y, s.w, 2);
        ctx.globalAlpha = 1;
        // subtle grid texture
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        for (let gx = x; gx < x + s.w; gx += 48) {
          ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + s.h); ctx.stroke();
        }
      }
    }
  }

  _drawHazards(ctx, cam) {
    const t = performance.now() / 120;
    for (const hz of this.hazards) {
      const x = hz.x - cam.x;
      const y = hz.y - cam.y;
      ctx.fillStyle = "#ff5d8f";
      ctx.globalAlpha = 0.7 + Math.sin(t) * 0.2;
      ctx.fillRect(x, y, hz.w, hz.h);
      // crackle line
      ctx.strokeStyle = "#fff";
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      for (let i = 0; i <= hz.w; i += 16) {
        ctx.lineTo(x + i, y + (Math.sin((i + performance.now() / 30) * 0.3) * 0.5 + 0.5) * hz.h);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  drawDialogue(ctx) {
    if (!this.dialogueActive) return;
    const line = this.dialogue.line;
    if (!line) return;
    const W = CONFIG.view.width;
    const boxY = CONFIG.view.height - 150;
    panel(ctx, 60, boxY, W - 120, 120, { glow: 12, edge: line.color ?? "#4fd1ff" });
    // Speaker tag.
    panel(ctx, 76, boxY - 18, 8 + line.speaker.length * 11, 30, { edge: line.color ?? "#4fd1ff", radius: 6 });
    text(ctx, line.speaker, 88, boxY + 2, { size: 15, color: line.color ?? "#4fd1ff", baseline: "middle", weight: 700 });
    // Body (typewriter).
    wrapText(ctx, this.dialogue.visibleText(), 88, boxY + 44, W - 176, 26, { size: 18, color: "#e8edff" });
    // Advance prompt.
    if (this.dialogue.lineComplete) {
      const blink = Math.sin(performance.now() / 200) > 0;
      if (blink) text(ctx, "▼", W - 100, boxY + 100, { size: 18, color: "#4fd1ff" });
    }
  }
}