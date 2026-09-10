const BEHAVIORS = {
  chaser: {
    idle: {
      update(e, dt, fsm) {
        e.vx = approach(e.vx, 0, 600 * dt);
        const { dist, dx } = e._toPlayer(e.world);
        if (dist < e.def.aggroRange) { e.facing = Math.sign(dx) || e.facing; return "chase"; }
      },
    },
    chase: {
      update(e, dt) {
        const { dist, dx } = e._toPlayer(e.world);
        e.facing = Math.sign(dx) || e.facing;
        e.vx = approach(e.vx, e.facing * e.def.speed, 1000 * dt);
        if (dist > e.def.aggroRange * 1.3) return "idle";
        if (dist < e.def.attackRange && e.attackTimer <= 0) return "windup";
      },
    },
    windup: {
      enter(e) { e.vx = 0; e.telegraph = 0; },
      update(e, dt, fsm) {
        e.telegraph = clamp(fsm.timer / e.def.attackWindup, 0, 1);
        e.vx = approach(e.vx, 0, 1200 * dt);
        if (fsm.timer >= e.def.attackWindup) return "attack";
      },
      exit(e) { e.telegraph = 0; },
    },
    attack: {
      enter(e) {
        e.app.audio.sfx("light");
        e._meleeHit(e.world);
        e.attackTimer = e.def.attackCooldown;
        e.vx = e.facing * 120; // small lunge
      },
      update(e, dt, fsm) {
        e.vx = approach(e.vx, 0, 900 * dt);
        if (fsm.timer >= 0.25) return "chase";
      },
    },
    hurt: {
      enter(e) { e.telegraph = 0; },
      update(e, dt, fsm) {
        e.vx = approach(e.vx, 0, 700 * dt);
        if (fsm.timer >= 0.22) return "chase";
      },
    },
  },

  // Brute reuses chaser logic but is slower and tuned via its data def.
  brute: null, // filled below by cloning chaser

  turret: {
    idle: {
      update(e, dt) {
        const { dist, dx } = e._toPlayer(e.world);
        e.facing = Math.sign(dx) || e.facing;
        if (dist < e.def.fireRange) return "aim";
      },
    },
    aim: {
      update(e, dt, fsm) {
        const { dist, dx } = e._toPlayer(e.world);
        e.facing = Math.sign(dx) || e.facing;
        e.telegraph = clamp(fsm.timer / 0.4, 0, 1);
        if (dist > e.def.fireRange * 1.2) return "idle";
        if (fsm.timer >= 0.4 && e.attackTimer <= 0) return "fire";
      },
      exit(e) { e.telegraph = 0; },
    },
    fire: {
      enter(e) {
        const { dx, dy, dist } = e._toPlayer(e.world);
        const sp = e.def.projectileSpeed;
        e.world.spawnProjectile({
          x: e.x + e.w / 2, y: e.y + e.h * 0.35,
          vx: (dx / dist) * sp, vy: (dy / dist) * sp,
          damage: e.def.projectileDamage, owner: "enemy", color: "#b06bff", radius: 6,
        });
        e.app.audio.sfx("shoot");
        e.attackTimer = e.def.fireRate;
      },
      update(e, dt, fsm) {
        if (fsm.timer >= 0.2) return "aim";
      },
    },
    hurt: {
      update(e, dt, fsm) {
        if (fsm.timer >= 0.18) return "aim";
      },
    },
  },
};