/**
 * level.js — the stage runner (extends WorldScene).
 *
 * Given a level id, it builds the world (terrain comes from WorldScene), spawns
 * data-defined enemies and pickups, tracks the run statistics that feed the
 * rank screen (time, damage taken, kills, secrets, peak style), detects secret
 * zones and the exit, and handles death/respawn. On reaching the exit it scores
 * the run via systems/rank.js, records the result, grants any clear-gated
 * unlocks, and hands off to the results screen.
 *
 * @module scenes/level
 */

import { WorldScene } from "./worldscene.js";
import { Enemy } from "../entities/enemy.js";
import { Pickup } from "../entities/pickup.js";
import { drawHUD } from "../ui/hud.js";
import { panel, text, title } from "../ui/widgets.js";
import { aabb } from "../engine/mathx.js";
import { computeRank } from "../systems/rank.js";
import { CONFIG } from "../config.js";
import { ResultsScene } from "./results.js";
import { PauseScene } from "./pause.js";

const W = CONFIG.view.width;
const H = CONFIG.view.height;

export class LevelScene extends WorldScene {
  /** @param {object} app @param {{levelId:string}} opts */
  constructor(app, { levelId } = {}) {
    super(app);
    this.levelId = levelId;
  }

  onEnter() {
    const def = this.app.data.levels.find((l) => l.id === this.levelId);
    this.loadLevel(def);
    this.app.progression.setLastArea(def.name);
    this.app.audio.playMusic(def.music ?? "stage");

    this._spawnContent(def);
    this._initStats(def);
    this._bindEvents();

    this.finished = false;
    this.deathTimer = 0;
    this.introTimer = def.tip ? 4 : 0;
    this.shardsAtStart = this.app.progression.data.shards;

    if (def.intro && this.app.data.dialogue[def.intro]) {
      this.startDialogue(this.app.data.dialogue[def.intro]);
    }
  }

  onExit() {
    // Always unsubscribe bus listeners when leaving the scene.
    this._unsub?.forEach((off) => off());
  }

  _spawnContent(def) {
    const prog = this.app.progression;
    this.enemies = (def.enemies ?? []).map((e) =>
      new Enemy(this.app, this.app.data.enemies[e.type], e.x, e.y)
    );
    this.pickups = (def.pickups ?? [])
      .filter((spec) => {
        // Don't respawn one-time pickups already collected, or owned emblems.
        if (spec.kind === "emblem") return !prog.hasEmblem(spec.id);
        if (spec.kind === "echo") return !prog.data.echoLogs.includes(spec.id);
        if (spec.id) return !prog.wasPickedUp(spec.id);
        return true;
      })
      .map((spec) => new Pickup(this.app, spec, this.app.data.items.pickups[spec.kind]));

    this.secrets = (def.secrets ?? []).map((s) => ({ ...s, found: false }));
  }

  _initStats(def) {
    const par = def.par ?? {};
    this.stats = {
      time: 0,
      damage: 0,
      kills: 0,
      secrets: 0,
      style: 0, // peak style reached
      totalKills: par.totalKills ?? this.enemies.length,
      totalSecrets: par.totalSecrets ?? this.secrets.length,
    };
    this.par = par;
  }

  _bindEvents() {
    const bus = this.app.bus;
    this._unsub = [
      bus.on("player:damaged", ({ amount }) => { this.stats.damage += amount; }),
      bus.on("enemy:killed", () => {
        this.stats.kills++;
        this.player.addStyle(20); // kill bonus to style
      }),
    ];
  }

  update(dt) {
    if (this.finished) return;

    if (!this.dialogueActive && this.app.input.pressed("pause")) {
      this.app.scenes.push(new PauseScene(this.app, { context: "level", levelId: this.def.id }));
      return;
    }

    this.baseUpdate(dt);
    if (this.dialogueActive) return;

    if (this.introTimer > 0) this.introTimer -= dt;

    // Run timer + peak style.
    this.stats.time += dt;
    if (this.player.style > this.stats.style) this.stats.style = this.player.style;

    this._checkSecrets();
    this._checkDeath(dt);
    this._checkExit();
  }

  _checkSecrets() {
    const box = this.player.aabb;
    for (const s of this.secrets) {
      if (!s.found && aabb(box, s)) {
        s.found = true;
        this.stats.secrets++;
        this.app.audio.sfx("emblem");
        this.particles.sparkle(s.x + s.w / 2, s.y + s.h / 2, "#ffd86b", 20);
        this._spawnShard(s.x + s.w / 2, s.y + s.h / 2, 10); // secret reward
        this.app.bus.emit("secret:found", s.id);
      }
    }
  }

  _checkDeath(dt) {
    if (!this.player.dead) return;
    this.deathTimer += dt;
    if (this.deathTimer >= 1.4) {
      // Respawn at the start checkpoint with a damage penalty for ranking.
      this.deathTimer = 0;
      this.stats.damage += 30;
      this.player.reset(this.def.spawn.x, this.def.spawn.y);
      this.player.hp = this.player.maxHp;
      this.player.iframes = 1.2;
      this.camera.snapTo(this.player.aabb);
    }
  }

  _checkExit() {
    if (this.player.dead || !this.def.exit) return;
    if (aabb(this.player.aabb, this.def.exit)) this._finish();
  }

  _finish() {
    this.finished = true;
    const result = computeRank(this.stats, {
      parTime: this.par.parTime ?? 90,
      maxDamage: this.par.maxDamage ?? 100,
      totalKills: this.stats.totalKills,
      totalSecrets: this.stats.totalSecrets,
      styleTarget: this.par.styleTarget ?? 200,
    });

    const newBest = this.app.progression.recordRank(this.def.id, {
      rank: result.tier,
      time: this.stats.time,
      kills: this.stats.kills,
      secrets: this.stats.secrets,
      damage: this.stats.damage,
    });

    const unlocked = this._grantClearUnlocks();
    const shardsGained = this.app.progression.data.shards - this.shardsAtStart;

    this.app.audio.sfx("rankup");
    this.app.scenes.replace(new ResultsScene(this.app, {
      levelId: this.def.id,
      levelName: this.def.name,
      result,
      stats: { ...this.stats },
      par: this.par,
      newBest,
      unlocked,
      shardsGained,
    }));
  }

  /** Unlock any cheats/art gated behind clearing this level. Returns names. */
  _grantClearUnlocks() {
    const gate = `clear:${this.def.id}`;
    const names = [];
    for (const cheat of this.app.data.unlocks.cheats) {
      if (cheat.unlockedBy === gate && this.app.progression.unlock(cheat.id)) {
        names.push(`Cheat: ${cheat.name}`);
      }
    }
    for (const art of this.app.data.unlocks.art) {
      if (art.unlockedBy === gate && this.app.progression.unlock(art.id)) {
        names.push(`Art: ${art.name}`);
      }
    }
    return names;
  }

  render(ctx) {
    this.renderWorld(ctx);
    const cam = { x: this.camera.renderX, y: this.camera.renderY };
    this._drawExit(ctx, cam);
    this._drawSecretHints(ctx, cam);

    drawHUD(ctx, this.app, this.player, this.stats);

    // Intro tip card.
    if (this.introTimer > 0 && this.def.tip) {
      const a = Math.min(1, this.introTimer) * Math.min(1, (4 - this.introTimer) * 4);
      ctx.globalAlpha = Math.max(0, a);
      panel(ctx, W / 2 - 280, H - 100, 560, 56, { glow: 8, edge: "#ffd86b" });
      text(ctx, this.def.tip, W / 2, H - 70, { size: 15, align: "center", color: "#ffd86b" });
      ctx.globalAlpha = 1;
    }

    if (this.player.dead) this._drawDeath(ctx);
    this.drawDialogue(ctx);
  }

  _drawExit(ctx, cam) {
    const e = this.def.exit;
    if (!e) return;
    const x = e.x - cam.x;
    const y = e.y - cam.y;
    const t = performance.now() / 300;
    ctx.save();
    ctx.fillStyle = "#7dffb0";
    ctx.globalAlpha = 0.2 + Math.sin(t) * 0.1;
    ctx.fillRect(x - 6, y - 6, e.w + 12, e.h + 12);
    ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(x, y, x, y + e.h);
    g.addColorStop(0, "rgba(125,255,176,0.5)");
    g.addColorStop(1, "rgba(79,209,255,0.3)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, e.w, e.h);
    ctx.restore();
    text(ctx, "EXIT", x + e.w / 2, y - 14, { size: 13, align: "center", color: "#7dffb0" });
  }

  /** Faint shimmer over undiscovered secret zones, for the curious. */
  _drawSecretHints(ctx, cam) {
    for (const s of this.secrets) {
      if (s.found) continue;
      const x = s.x - cam.x;
      const y = s.y - cam.y;
      ctx.fillStyle = "rgba(255,216,107,0.05)";
      ctx.fillRect(x, y, s.w, s.h);
    }
  }

  _drawDeath(ctx) {
    ctx.fillStyle = `rgba(20,0,10,${Math.min(0.6, this.deathTimer)})`;
    ctx.fillRect(0, 0, W, H);
    if (this.deathTimer > 0.3) {
      title(ctx, "DATA LOSS", W / 2, H / 2 - 10, { size: 42, glow: "#ff5d8f", color: "#ff9ec0" });
      text(ctx, "Recovering from last checkpoint...", W / 2, H / 2 + 30, {
        size: 14, align: "center", color: "#b8c0e0",
      });
    }
  }
}
