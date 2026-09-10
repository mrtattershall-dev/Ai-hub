const STATES = {
  idle: {
    update(p, dt) {
      p._horizontal(dt);
      p._gravity(dt);
      if (!p.grounded) return "fall";
      if (p._tryJump()) return "jump";
      return chooseAction(p) ?? (Math.abs(p.vx) > 8 ? "run" : null);
    },
  },

  run: {
    enter(p) { p._dustTimer = 0; },
    update(p, dt) {
      p._horizontal(dt);
      p._gravity(dt);
      if (!p.grounded) return "fall";
      if (p._tryJump()) return "jump";
      const act = chooseAction(p);
      if (act) return act;
      // Footstep dust.
      p._dustTimer = (p._dustTimer ?? 0) + dt;
      if (p._dustTimer > 0.18 && Math.abs(p.vx) > 60) {
        p.world.particles.dust(p.x + p.w / 2, p.y + p.h, -p.facing, 2);
        p._dustTimer = 0;
      }
      if (Math.abs(p.vx) <= 8) return "idle";
    },
  },

  jump: {
    enter(p) { p.app.audio; },
    update(p, dt) {
      p._horizontal(dt);
      p._gravity(dt);
      p._jumpCut();
      if (p._tryJump()) return "jump"; // double jump
      const act = chooseAirAction(p);
      if (act) return act;
      if (p.vy >= 0) return "fall";
      if (p.grounded) return "idle";
    },
  },

  fall: {
    update(p, dt) {
      p._horizontal(dt);
      p._gravity(dt);
      if (p._tryJump()) return "jump";
      const act = chooseAirAction(p);
      if (act) return act;
      if (p.grounded) {
        p.app.audio.sfx("land");
        p.world.particles.dust(p.x + p.w / 2, p.y + p.h, 0, 5);
        return Math.abs(p.vx) > 8 ? "run" : "idle";
      }
    },
  },

  dodge: {
    enter(p) {
      p.iframes = Math.max(p.iframes, p.app.progression.dodgeIFrames());
      p.dodgeCooldown = PHYSICS.dodgeCooldown;
      const dir = p.app.input.axisX() || p.facing;
      p.facing = dir > 0 ? 1 : -1;
      p.vx = p.facing * PHYSICS.dodgeSpeed;
      p.app.audio.sfx("dodge");
    },
    update(p, dt) {
      p.vx = approach(p.vx, p.facing * PHYSICS.dodgeSpeed * 0.4, 1800 * dt);
      p._gravity(dt, 0.6);
      p.world.particles.spawn({
        x: p.x + p.w / 2, y: p.y + p.h / 2, vx: -p.facing * 60, vy: 0,
        life: 0.25, size: 5, color: "rgba(79,209,255,0.5)", drag: 3,
      });
      if (p.fsm.timer >= PHYSICS.dodgeTime) {
        return p.grounded ? "idle" : "fall";
      }
    },
  },

  airdash: {
    enter(p) {
      p.airDashUsed = true;
      const dir = p.app.input.axisX() || p.facing;
      p.facing = dir > 0 ? 1 : -1;
      p.vx = p.facing * PHYSICS.airDashSpeed;
      p.vy = 0;
      p.app.audio.sfx("dodge");
    },
    update(p, dt) {
      p.vy = 0; // float during the dash
      p.world.particles.spawn({
        x: p.x + p.w / 2, y: p.y + p.h / 2, vx: -p.facing * 120, vy: 0,
        life: 0.3, size: 6, color: "rgba(125,255,176,0.6)", drag: 2,
      });
      if (p.fsm.timer >= PHYSICS.airDashTime) return "fall";
    },
  },

  attackLight: {
    enter(p) {
      p.activeHitbox = null;
      p.queuedChain = false;
      p.app.audio.sfx(p.attacks.chain[p.comboIndex].sfx);
    },
    update(p, dt) {
      const def = p.attacks.chain[p.comboIndex];
      // Light momentum: small lunge, mostly planted.
      p.vx = approach(p.vx, 0, PHYSICS.groundFriction * 1.4 * dt);
      if (!p.grounded) p._gravity(dt);
      p._runAttack(def, dt, p.fsm);
      // Queue the next chain link if pressed after the active window.
      if (p.app.input.pressed("light") && p.comboIndex + 1 < p.attacks.chain.length) {
        p.queuedChain = true;
      }
      if (p.fsm.timer >= def.dur) {
        if (p.queuedChain) {
          p.comboIndex++;
          p.fsm.change("attackLight", true);
          return;
        }
        p.comboIndex = 0;
        return p.grounded ? "idle" : "fall";
      }
    },
    exit(p) { p.activeHitbox = null; },
  },

  attackHeavy: {
    enter(p) { p.activeHitbox = null; p.app.audio.sfx("heavy"); p.vx *= 0.3; },
    update(p, dt) {
      if (!p.grounded) p._gravity(dt);
      p.vx = approach(p.vx, 0, PHYSICS.groundFriction * dt);
      p._runAttack(p.attacks.heavy, dt, p.fsm);
      if (p.fsm.timer >= p.attacks.heavy.dur) return p.grounded ? "idle" : "fall";
    },
    exit(p) { p.activeHitbox = null; },
  },

  attackAir: {
    enter(p) { p.activeHitbox = null; p.app.audio.sfx("light"); },
    update(p, dt) {
      p._horizontal(dt, PHYSICS.airAccel * 0.6);
      p._gravity(dt, 0.8);
      p._runAttack(p.attacks.air, dt, p.fsm);
      if (p.grounded || p.fsm.timer >= p.attacks.air.dur) {
        p.activeHitbox = null;
        return p.grounded ? "idle" : "fall";
      }
    },
    exit(p) { p.activeHitbox = null; },
  },

  slam: {
    enter(p) { p.activeHitbox = null; p.vx = 0; p.vy = 0; p._slamWind = 0; },
    update(p, dt) {
      // Brief hover, then rocket down. Hitbox lives on impact.
      p._slamWind += dt;
      if (p._slamWind < 0.12) {
        p.vy = -40;
      } else {
        p.vy = PHYSICS.slamSpeed;
      }
      p._horizontal(dt, PHYSICS.airAccel * 0.3);
      if (p.grounded) {
        p.app.audio.sfx("slam");
        p.world.camera.shake(12);
        p.world.particles.dust(p.x + p.w / 2, p.y + p.h, 0, 14);
        p.activeHitbox = makeHitbox(p, p.attacks.slam);
        const hits = resolveHits(p.activeHitbox, p.world.enemies);
        if (hits.length) p._onHit(hits, p.attacks.slam);
        return "idle";
      }
    },
    exit(p) { p.activeHitbox = null; },
  },

  hurt: {
    update(p, dt) {
      p.vx = approach(p.vx, 0, 1200 * dt);
      p._gravity(dt);
      if (p.fsm.timer >= 0.28) return p.grounded ? "idle" : "fall";
    },
  },

  dead: {
    enter(p) {
      p.dead = true;
      p.vx = 0;
      p.app.bus.emit("player:died");
    },
    update(p, dt) {
      p.vx = approach(p.vx, 0, 800 * dt);
      p._gravity(dt);
    },
  },
};