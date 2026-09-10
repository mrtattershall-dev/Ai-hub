export class Player {
  constructor(app, x = 0, y = 0) {
    this.app = app;
    this.w = 34;
    this.h = 52;
    this.reset(x, y);

    // Pull live stats from progression so upgrades take effect immediately.
    this.maxHp = app.progression.maxHP();
    this.hp = this.maxHp;
    this.attacks = buildAttacks(app.progression);

    this.fsm = new StateMachine(this, STATES, "fall");
  }

  reset(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.facing = 1;          // 1 right, -1 left
    this.grounded = false;
    this.hitCeiling = false;
    this.touchingWall = false;
    this.wallDir = 0;

    // timers / flags
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.doubleJumpUsed = false;
    this.airDashUsed = false;
    this.dodgeCooldown = 0;
    this.iframes = 0;
    this.burstCooldown = 0;

    // combat
    this.comboIndex = 0;
    this.queuedChain = false;
    this.activeHitbox = null;
    this.style = 0;           // current style/combo meter
    this.styleTimer = 0;

    this.alive = true;
    this.dead = false;
  }

  get aabb() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  // ---- damage in ----------------------------------------------------------

  /** Incoming damage from enemies/hazards. Ignored during i-frames. */
  takeDamage(amount, knockX = 0) {
    if (this.iframes > 0 || !this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.iframes = COMBAT.baseIFrames;
    this.style = Math.max(0, this.style - 30); // getting hit hurts your style
    this.vx = knockX;
    this.vy = -240;
    this.app.audio.sfx(this.hp <= 0 ? "death" : "hurt");
    this.app.bus.emit("player:damaged", { amount, hp: this.hp });
    if (this.hp <= 0) {
      this.alive = false;
      this.fsm.change("dead");
    } else {
      this.fsm.change("hurt");
    }
    return true;
  }

  addStyle(points) {
    this.style = clamp(this.style + points, 0, 999);
    this.styleTimer = 0;
    this.app.bus.emit("style:changed", this.style);
  }

  // ---- main update --------------------------------------------------------

  update(dt, world) {
    this.world = world;
    const input = this.app.input;

    // Global timers tick regardless of state.
    this.iframes = Math.max(0, this.iframes - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.burstCooldown = Math.max(0, this.burstCooldown - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    // Style meter decays when idle.
    this.styleTimer += dt;
    if (this.styleTimer > 0.6) this.style = Math.max(0, this.style - COMBAT.styleDecay * dt);

    // Buffer a jump press so it survives a few frames of being airborne.
    if (input.pressed("jump")) this.jumpBuffer = PHYSICS.jumpBuffer;

    this.fsm.update(dt);

    // Integrate + collide (states set vx/vy; physics resolves position).
    moveAndCollide(this, world.solids, dt);

    if (this.grounded) {
      this.coyote = PHYSICS.coyoteTime;
      this.doubleJumpUsed = false;
      this.airDashUsed = false;
    }
    if (this.hitCeiling && this.vy < 0) this.vy = 0;

    // Hazards (electrified rails, etc.).
    for (const hz of world.hazards ?? []) {
      if (
        this.x < hz.x + hz.w && this.x + this.w > hz.x &&
        this.y < hz.y + hz.h && this.y + this.h > hz.y
      ) {
        this.takeDamage(hz.damage, this.facing * -300);
      }
    }

    // Fell out of the world.
    if (this.y > world.height + 200 && this.alive) this.takeDamage(9999, 0);
  }

  // ---- shared movement helpers --------------------------------------------

  _horizontal(dt, accelOverride) {
    const input = this.app.input;
    const dir = input.axisX();
    const onGround = this.grounded;
    const target = dir * this.app.progression.runSpeed();
    if (dir !== 0) this.facing = dir > 0 ? 1 : -1;
    const accel = accelOverride ?? (onGround ? PHYSICS.runAccel : PHYSICS.airAccel);
    if (dir !== 0) {
      this.vx = approach(this.vx, target, accel * dt);
    } else {
      const friction = onGround ? PHYSICS.groundFriction : PHYSICS.airFriction;
      this.vx = approach(this.vx, 0, friction * dt);
    }
  }

  _gravity(dt, scale = 1) {
    const g = PHYSICS.gravity * (this.app.progression.cheatOn("lowgrav") ? 0.45 : 1) * scale;
    this.vy = Math.min(this.vy + g * dt, PHYSICS.maxFallSpeed);
  }

  /** Returns true if a jump (ground/coyote or double) was consumed. */
  _tryJump() {
    if (this.jumpBuffer <= 0) return false;
    if (this.grounded || this.coyote > 0) {
      this.vy = -PHYSICS.jumpSpeed;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.app.audio.sfx("jump");
      this.world.particles.dust(this.x + this.w / 2, this.y + this.h, 0);
      return true;
    }
    if (!this.doubleJumpUsed) {
      this.vy = -PHYSICS.doubleJumpSpeed;
      this.doubleJumpUsed = true;
      this.jumpBuffer = 0;
      this.app.audio.sfx("doublejump");
      this.world.particles.sparkle(this.x + this.w / 2, this.y + this.h, "#4fd1ff", 8);
      return true;
    }
    return false;
  }

  /** Variable jump height: releasing jump while rising cuts the arc. */
  _jumpCut() {
    if (!this.app.input.down("jump") && this.vy < 0) {
      this.vy *= PHYSICS.jumpCutMultiplier;
    }
  }

  _fireBurst() {
    if (this.burstCooldown > 0) return false;
    this.burstCooldown = this.app.progression.burstCooldown();
    const px = this.facing > 0 ? this.x + this.w : this.x;
    this.world.spawnProjectile({
      x: px, y: this.y + this.h * 0.4, vx: this.facing * 560, vy: 0,
      damage: COMBAT.burstDamage, owner: "player", color: "#4fd1ff", radius: 7, pierce: false,
    });
    this.app.audio.sfx("shoot");
    this.addStyle(6);
    return true;
  }

  // ---- attack execution shared by attack states ---------------------------

  _runAttack(def, dt, fsm) {
    const t = fsm.timer;
    // Spawn the hitbox exactly once, when the active window opens.
    if (!this.activeHitbox && t >= def.active[0] && t <= def.active[1]) {
      this.activeHitbox = makeHitbox(this, def);
    }
    // While active, resolve hits each frame (dedup is internal to the hitbox).
    if (this.activeHitbox && t <= def.active[1]) {
      const hits = resolveHits(this.activeHitbox, this.world.enemies);
      if (hits.length) this._onHit(hits, def);
    }
    if (t > def.active[1]) this.activeHitbox = null;
  }

  _onHit(hits, def) {
    Hitstop.add(COMBAT.hitstop);
    this.world.camera.shake(def.type === "heavy" || def.type === "slam" ? 9 : 5);
    this.addStyle(def.style * hits.length);
    this.app.audio.sfx("hit");
    for (const e of hits) {
      this.world.particles.hitSpark(
        e.x + e.w / 2, e.y + e.h / 2,
        def.type === "heavy" ? "#ffd86b" : "#fff", def.type === "slam" ? 16 : 10
      );
    }
  }

  // ---- rendering ----------------------------------------------------------

  render(ctx, cam) {
    const x = Math.round(this.x - cam.x);
    const y = Math.round(this.y - cam.y);

    // Flicker while invulnerable.
    if (this.iframes > 0 && Math.floor(this.iframes * 30) % 2 === 0) return;

    const bigHead = this.app.progression.cheatOn("bighead");

    // Body
    ctx.fillStyle = "#222a44";
    ctx.fillRect(x, y + (bigHead ? 16 : 0), this.w, this.h - (bigHead ? 16 : 0));
    // Jacket accent
    ctx.fillStyle = "#ff5d8f";
    ctx.fillRect(x + 4, y + 18, this.w - 8, 10);
    // Head
    const headH = bigHead ? 34 : 18;
    const headW = bigHead ? this.w + 14 : this.w - 8;
    ctx.fillStyle = "#ffd3b0";
    ctx.fillRect(x + (this.w - headW) / 2, y - (bigHead ? 16 : 0), headW, headH);
    // Visor (faces movement direction)
    ctx.fillStyle = "#4fd1ff";
    const vx = this.facing > 0 ? x + headW / 2 : x + (this.w - headW) / 2 + 2;
    ctx.fillRect(vx, y + 4 - (bigHead ? 12 : 0), headW / 2 - 2, 5);

    // Active hitbox debug (only with debug overlay on).
    if (this.app.debug && this.activeHitbox) {
      ctx.strokeStyle = "rgba(255,80,120,0.8)";
      ctx.strokeRect(
        this.activeHitbox.x - cam.x, this.activeHitbox.y - cam.y,
        this.activeHitbox.w, this.activeHitbox.h
      );
    }
  }
}