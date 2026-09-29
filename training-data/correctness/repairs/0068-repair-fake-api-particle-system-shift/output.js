// ═══════════════════════════════════════════════════════
//  PARTICLES MODULE  –  Skid marks, sparks, boost flames
// ═══════════════════════════════════════════════════════
const Particles = (() => {

  // ── Skid mark segments (persistent, fade over time) ──
  const skidMarks = [];
  const MAX_SKID = 800;

  function addSkid(x, y, angle, alpha) {
    if (skidMarks.length >= MAX_SKID) skidMarks.shift();
    skidMarks.push({ x, y, angle, alpha, life: 1.0 });
  }

  function updateSkids(dt) {
    for (const s of skidMarks) {
      s.life -= dt * 0.07; // fade very slowly
    }
    // Remove fully faded
    for (let i = skidMarks.length - 1; i >= 0; i--) {
      if (skidMarks[i].life <= 0) skidMarks.splice(i, 1);
    }
  }

  // ── Spark / dust particles (pooled) ──────────────────
  const sparks = [];
  const POOL_SIZE = 400;
  // Pre-fill pool
  for (let i = 0; i < POOL_SIZE; i++) {
    sparks.push({ active: false });
  }

  function emitSparks(x, y, count, color, speedMult = 1) {
    let emitted = 0;
    for (const s of sparks) {
      if (!s.active && emitted < count) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (40 + Math.random() * 120) * speedMult;
        Object.assign(s, {
          active: true,
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.4 + Math.random() * 0.4,
          maxLife: 0.4 + Math.random() * 0.4,
          color,
          size: 2 + Math.random() * 3,
          gravity: 60,
        });
        s.maxLife = s.life;
        emitted++;
      }
      if (emitted >= count) break;
    }
  }

  function emitBoostFlame(x, y, angle, color) {
    for (let i = 0; i < 3; i++) {
      for (const s of sparks) {
        if (!s.active) {
          const spread = (Math.random() - 0.5) * 0.8;
          const a = angle + Math.PI + spread;
          const speed = 80 + Math.random() * 140;
          const life = 0.1 + Math.random() * 0.18;
          Object.assign(s, {
            active: true,
            x: x + (Math.random()-0.5)*10, y: y + (Math.random()-0.5)*10,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            life, maxLife: life,
            color: i === 0 ? '#fff' : (i === 1 ? color : '#ff8800'),
            size: 3 + Math.random() * 5,
            gravity: -20,
          });
          break;
        }
      }
    }
  }

  function emitDust(x, y) {
    for (let i = 0; i < 2; i++) {
      for (const s of sparks) {
        if (!s.active) {
          const angle = Math.random() * Math.PI * 2;
          const life = 0.3 + Math.random() * 0.3;
          Object.assign(s, {
            active: true,
            x: x + (Math.random()-0.5)*20, y: y + (Math.random()-0.5)*20,
            vx: Math.cos(angle) * (15 + Math.random() * 30),
            vy: Math.sin(angle) * (15 + Math.random() * 30),
            life, maxLife: life,
            color: 'rgba(180,160,100,',
            size: 4 + Math.random() * 8,
            gravity: -10,
            isDust: true,
          });
          break;
        }
      }
    }
  }

  function updateSparks(dt) {
    for (const s of sparks) {
      if (!s.active) continue;
      s.x  += s.vx * dt;
      s.y  += s.vy * dt;
      s.vy += s.gravity * dt;
      s.vx *= 0.96;
      s.life -= dt;
      if (s.life <= 0) s.active = false;
    }
  }

  // ── Screen shake ─────────────────────────────────────
  let shakeX = 0, shakeY = 0, shakeMag = 0, shakeDuration = 0;
  function screenShake(magnitude, duration) {
    shakeMag = Math.max(shakeMag, magnitude);
    shakeDuration = Math.max(shakeDuration, duration);
  }
  function updateShake(dt) {
    if (shakeDuration > 0) {
      shakeDuration -= dt;
      const t = shakeDuration <= 0 ? 0 : 1;
      shakeX = (Math.random()-0.5) * shakeMag * 2 * t;
      shakeY = (Math.random()-0.5) * shakeMag * 2 * t;
      shakeMag *= 0.88;
    } else {
      shakeX = 0; shakeY = 0; shakeMag = 0;
    }
  }

  function update(dt) {
    updateSkids(dt);
    updateSparks(dt);
    updateShake(dt);
  }

  function clear() {
    skidMarks.length = 0;
    for (const s of sparks) s.active = false;
    shakeMag = 0; shakeDuration = 0;
  }

  return {
    addSkid, updateSkids,
    emitSparks, emitBoostFlame, emitDust,
    screenShake, updateShake,
    update, clear,
    getSkids: () => skidMarks,
    getSparks: () => sparks,
    getShake: () => ({ x: shakeX, y: shakeY }),
  };
})();
