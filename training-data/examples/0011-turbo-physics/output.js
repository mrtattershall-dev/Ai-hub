// ═══════════════════════════════════════════════════════
//  PHYSICS MODULE  –  Car movement, drift, collisions
// ═══════════════════════════════════════════════════════
const Physics = (() => {

  // ── Car classes ────────────────────────────────────────
  const CAR_CLASSES = {
    speedster: {
      id: 'speedster',
      label: 'SPEEDSTER',
      desc: 'Top speed demon. Light, fast, fragile in corners.',
      color: '#00f5ff',
      trailColor: '#00f5ff',
      icon: '▲',
      stats: {
        maxSpeed:      380,
        acceleration:  380,
        brakeForce:    520,
        drag:          0.97,
        offTrackDrag:  0.78,
        turnSpeed:     2.5,
        driftFactor:   0.92,
        gripFactor:    0.28,
        boostForce:    620,
        boostMax:      100,
        boostRegen:    14,
        boostDrain:    32,
        boostMinTrig:  30,
        carW: 16, carH: 34,
      },
    },
    drifter: {
      id: 'drifter',
      label: 'DRIFTER',
      desc: 'Born sideways. Huge drift angle, earns style on corners.',
      color: '#bf5fff',
      trailColor: '#bf5fff',
      icon: '◆',
      stats: {
        maxSpeed:      300,   // was 310 — drifters trade raw pace for cornering
        acceleration:  440,
        brakeForce:    500,
        drag:          0.95,
        offTrackDrag:  0.80,
        turnSpeed:     3.4,
        driftFactor:   0.96,
        gripFactor:    0.18,
        boostForce:    500,
        boostMax:      100,
        boostRegen:    10,
        boostDrain:    40,
        boostMinTrig:  30,
        carW: 20, carH: 30,
      },
    },
    bruiser: {
      id: 'bruiser',
      label: 'BRUISER',
      desc: 'Heavy muscle car. Smashes rivals, slow to turn.',
      color: '#fb5607',
      trailColor: '#fb5607',
      icon: '■',
      stats: {
        maxSpeed:      345,   // was 290 — now competitive, still 10% behind Speedster
        acceleration:  540,   // was 500 — best raw punch off the line
        brakeForce:    700,   // was 680
        drag:          0.955, // was 0.94 — slightly less drag so top speed is reachable
        offTrackDrag:  0.82,
        turnSpeed:     2.55,  // was 2.2 — enough to navigate corners without being a bus
        driftFactor:   0.86,  // was 0.85
        gripFactor:    0.52,
        boostForce:    640,   // was 580 — boost feels punchy on a heavy car
        boostMax:      100,
        boostRegen:    18,    // was 16 — reward for holding line, not drifting
        boostDrain:    26,    // was 28 — longer boost duration
        boostMinTrig:  30,
        carW: 22, carH: 28,
      },
    },
  };

  // ── Car constants (base stats) ─────────────────────────
  const BASE = {
    maxSpeed:      320,    // px/s
    acceleration:  420,    // px/s²
    brakeForce:    580,    // px/s²
    drag:          0.96,   // per-frame multiplier (60fps)
    offTrackDrag:  0.80,
    turnSpeed:     2.8,    // rad/s
    driftFactor:   0.88,   // lateral velocity retention while drifting
    gripFactor:    0.35,   // lateral velocity kill when not drifting
    boostForce:    540,    // extra accel during boost
    boostMax:      100,
    boostRegen:    12,     // per second
    boostDrain:    35,     // per second
    boostMinTrig:  30,     // minimum boost to activate
    carW:          18,
    carH:          32,
  };

  // ── Class-specific upgrade definitions ────────────────
  const UPGRADE_DEFS = {
    speedster: [
      { key: 'accel',    label: 'ENGINE',     desc: 'Raises top speed ceiling',         max: 5, cost: 200,
        apply: (stats, lvl) => ({ ...stats, maxSpeed: stats.maxSpeed + lvl * 38 }) },
      { key: 'handling', label: 'AERO',       desc: 'Reduces drag, sharpens grip',      max: 5, cost: 250,
        apply: (stats, lvl) => ({ ...stats, drag: Math.min(0.985, stats.drag + lvl * 0.004), gripFactor: Math.max(0.15, stats.gripFactor - lvl * 0.02) }) },
      { key: 'topSpeed', label: 'NITRO TANK', desc: 'Longer boost duration',            max: 5, cost: 300,
        apply: (stats, lvl) => ({ ...stats, boostDrain: Math.max(16, stats.boostDrain - lvl * 3.2) }) },
    ],
    drifter: [
      { key: 'accel',    label: 'SLIDE TUNE', desc: 'Wilder drift angle retention',     max: 5, cost: 200,
        apply: (stats, lvl) => ({ ...stats, driftFactor: Math.min(0.985, stats.driftFactor + lvl * 0.009) }) },
      { key: 'handling', label: 'STEERING',   desc: 'Faster rotation through corners',  max: 5, cost: 250,
        apply: (stats, lvl) => ({ ...stats, turnSpeed: stats.turnSpeed + lvl * 0.28 }) },
      { key: 'topSpeed', label: 'BOOST REGEN',desc: 'Recharges boost much faster',      max: 5, cost: 300,
        apply: (stats, lvl) => ({ ...stats, boostRegen: stats.boostRegen + lvl * 4 }) },
    ],
    bruiser: [
      { key: 'accel',    label: 'TORQUE',     desc: 'Explosive off-the-line punch',     max: 5, cost: 200,
        apply: (stats, lvl) => ({ ...stats, acceleration: stats.acceleration + lvl * 55 }) },
      { key: 'handling', label: 'SUSPENSION', desc: 'Tighter braking + harder impacts', max: 5, cost: 250,
        apply: (stats, lvl) => ({ ...stats, brakeForce: stats.brakeForce + lvl * 48, turnSpeed: stats.turnSpeed + lvl * 0.14 }) },
      { key: 'topSpeed', label: 'TOP END',    desc: 'Raises max speed to close the gap',max: 5, cost: 300,
        apply: (stats, lvl) => ({ ...stats, maxSpeed: stats.maxSpeed + lvl * 32, drag: Math.min(0.975, stats.drag + lvl * 0.003) }) },
    ],
  };

  function applyUpgrades(stats, upgrades, carClassId = 'speedster') {
    const defs = UPGRADE_DEFS[carClassId] || UPGRADE_DEFS.speedster;
    let s = { ...stats };
    for (const def of defs) {
      const lvl = upgrades[def.key] || 0;
      if (lvl > 0) s = def.apply(s, lvl);
    }
    return s;
  }

  // ── Create car state ──────────────────────────────────
  function createCar(x, y, angle, isPlayer, upgrades = {}, aiSpeedMult = 1, carClassId = 'speedster') {
    const cls = CAR_CLASSES[carClassId] || CAR_CLASSES.speedster;
    const baseStats = applyUpgrades({ ...cls.stats }, upgrades, carClassId);
    return {
      x, y,
      vx: 0, vy: 0,
      angle,
      speed: 0,
      drifting: false,
      onTrack: true,
      boost: cls.stats.boostMax,
      boostActive: false,
      isPlayer,
      upgrades,
      carClass: carClassId,
      stats: { ...baseStats, maxSpeed: baseStats.maxSpeed * aiSpeedMult },
      // lap tracking
      lap: 1,
      progress: 0,
      checkpointsPassed: new Set(),
      lapStartTime: 0,
      lapTimes: [],
      finished: false,
      finishTime: Infinity,
      place: 1,
      // collision — bruiser hits harder
      radius: cls.stats.carW + 2,
      // visual
      skidding: false,
      lastX: x, lastY: y,
      raceArmed: false,
      spawnDisabled: false, // set true on GO — disables all spawn-area lap logic
      color: cls.color,
      trailColor: cls.trailColor,
      carW: cls.stats.carW,
      carH: cls.stats.carH,
    };
  }

  // ── Update a single car ───────────────────────────────
  function update(car, dt, track, inputAccel, inputBrake, inputLeft, inputRight, useBoost) {
    if (car.finished || car.eliminated) return;

    const stats = car.stats;

    // ── Boost regen / drain ─────────────────────────────
    const boostTrigger = useBoost && car.boost >= stats.boostMinTrig;
    if (boostTrigger) {
      car.boostActive = true;
      car.boost = Math.max(0, car.boost - stats.boostDrain * dt);
      if (car.boost <= 0) car.boostActive = false;
    } else {
      car.boostActive = false;
      car.boost = Math.min(stats.boostMax, car.boost + stats.boostRegen * dt);
    }

    // ── Longitudinal force ──────────────────────────────
    const fwd = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const right = { x: Math.cos(car.angle + Math.PI/2), y: Math.sin(car.angle + Math.PI/2) };

    // Current speed along heading
    const forwardVel = car.vx * fwd.x + car.vy * fwd.y;
    const lateralVel = car.vx * right.x + car.vy * right.y;

    let accelForce = 0;
    if (inputAccel) {
      accelForce = stats.acceleration;
      if (car.boostActive) accelForce = Math.max(accelForce, stats.boostForce); // boost replaces, not stacks
    }
    if (inputBrake) {
      if (forwardVel > 5) {
        // Normal braking — proportional to how fast we're going so we stop cleanly
        accelForce -= stats.brakeForce;
      } else if (forwardVel > 0) {
        // Almost stopped — gentle drag to zero, never reverse
        accelForce -= forwardVel * 80;
      }
      // forwardVel <= 0: don't brake at all — car is already stopped or stationary
    }

    // Off-track penalty
    const dragMult = car.onTrack ? 1 : 0.45;
    const drag     = car.onTrack ? stats.drag : stats.offTrackDrag;

    // Apply forward acceleration
    car.vx += fwd.x * accelForce * dt * dragMult;
    car.vy += fwd.y * accelForce * dt * dragMult;

    // Drag
    car.vx *= Math.pow(drag, 60 * dt);
    car.vy *= Math.pow(drag, 60 * dt);

    // ── Lateral (grip / drift) ──────────────────────────
    car.lateralVel = lateralVel; // expose for Drift module

    // Drift triggers:
    //  1. Significant lateral velocity already building
    //  2. Hard braking at speed (weight transfer)
    //  3. Steering at high speed with low grip cars (oversteer initiation)
    const absLat = Math.abs(lateralVel);
    const isBrakeDrift = inputBrake && Math.abs(forwardVel) > 55;
    const isSliding    = absLat > 12; // lower threshold so drift can build
    car.drifting = isSliding || isBrakeDrift;
    car.skidding = car.drifting && car.onTrack;

    // Blend grip/drift factor — at the threshold edge, blend smoothly
    // This prevents the snap between full grip and full drift
    let lateralDamp;
    if (car.drifting) {
      // Already sliding: use drift factor (retain lateral vel)
      lateralDamp = stats.driftFactor;
    } else {
      // Gripping: kill lateral vel. gripFactor is now a KILL fraction per second,
      // not a retain factor — makes bruiser feel planted, drifter feel loose
      lateralDamp = stats.gripFactor;
    }
    car.vx -= right.x * lateralVel * (1 - Math.pow(lateralDamp, 60 * dt));
    car.vy -= right.y * lateralVel * (1 - Math.pow(lateralDamp, 60 * dt));

    // Clamp speed — boost cannot exceed 1.5× maxSpeed to prevent tunneling
    const spd = Math.sqrt(car.vx*car.vx + car.vy*car.vy);
    const maxSpd = stats.maxSpeed * (car.onTrack ? 1.5 : 0.55);
    if (spd > maxSpd) {
      car.vx = car.vx / spd * maxSpd;
      car.vy = car.vy / spd * maxSpd;
    }
    car.speed = Math.sqrt(car.vx*car.vx + car.vy*car.vy);

    // ── Steering ────────────────────────────────────────
    const speedRatio = Math.min(1, car.speed / 120);
    const steerAngle = stats.turnSpeed * dt * speedRatio;
    if (inputLeft)  car.angle -= steerAngle;
    if (inputRight) car.angle += steerAngle;

    // ── Move ─────────────────────────────────────────────
    car.lastX = car.x;
    car.lastY = car.y;
    car.x += car.vx * dt;
    car.y += car.vy * dt;

    // ── On-track check ───────────────────────────────────
    car.onTrack = Tracks.isOnTrack(car, track.pts, track.halfWidth + 10);

    // Push back if totally off (strong enough to hold boosting cars)
    if (!car.onTrack) {
      const nearest = Tracks.nearestPointIdx(car, track.pts);
      const tp = track.pts[nearest];
      const dx = tp.x - car.x, dy = tp.y - car.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 0.1) {
        const excess = Math.max(0, dist - track.halfWidth + 12);
        const pushStrength = 0.35;
        const nx = dx / dist, ny = dy / dist;
        car.x += nx * excess * pushStrength;
        car.y += ny * excess * pushStrength;
        const outDot = car.vx * (-nx) + car.vy * (-ny);
        if (outDot > 0) {
          car.vx -= (-nx) * outDot * 0.8;
          car.vy -= (-ny) * outDot * 0.8;
        }
      }
    }

    // ── Boost pad check ─────────────────────────────────
    for (const pad of track.boosts) {
      if (!pad.active) {
        pad.timer += dt;
        if (pad.timer > 5) { pad.active = true; pad.timer = 0; }
        continue;
      }
      const dx = car.x - pad.x, dy = car.y - pad.y;
      if (Math.sqrt(dx*dx + dy*dy) < 30) {
        car.boost = Math.min(stats.boostMax, car.boost + 40);
        if (car.isPlayer) Audio.playBoostPickup();
        pad.active = false;
        pad.timer = 0;
      }
    }

    // ── Checkpoint / lap progress ────────────────────────
    updateLapProgress(car, track);

    return car;
  }

  function updateLapProgress(car, track) {
    if (car.finished) return;

    // Get nearest point idx
    const idx = Tracks.nearestPointIdx(car, track.pts);
    const newProgress = track.dists[idx] / track.totalLen;

    // Check gates (must pass through in order)
    const gates = track.gates;
    for (const gate of gates) {
      if (car.checkpointsPassed.has(gate.idx)) continue;
      // Car must be physically close to the gate centre
      const dx = car.x - gate.cx, dy = car.y - gate.cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < track.halfWidth * 1.2) {
        // AND progress must be near this gate's position (not behind it by more than 15%)
        const progressDiff = car.progress - gate.progress;
        const nearGateProgress = Math.abs(progressDiff) < 0.15 ||
          (gate.progress < 0.15 && car.progress > 0.85); // wrap-around case
        if (nearGateProgress) {
          car.checkpointsPassed.add(gate.idx);
          // Arm finish line when LAST checkpoint is passed —
          // car has been all the way around and is now approaching the line.
          // This prevents any false finish trigger from spawn proximity.
          if (gate.idx === gates.length - 1) car.raceArmed = true;
        }
      }
    }

    // Lap complete: cross start/finish and all checkpoints passed
    // spawnDisabled is set on GO — before that, no lap logic runs at all
    if (!car.spawnDisabled) return;

    const allGates = gates.length;
    const dx = car.x - track.pts[0].x, dy = car.y - track.pts[0].y;
    const nearStart = Math.sqrt(dx*dx + dy*dy) < track.halfWidth * 1.5;

    // ── Two-marker lap system ─────────────────────────────
    // START marker: behind pts[0], arms the finish logic when crossed
    // FINISH marker: at pts[0] (checkered flag), counts laps only when armed
    //
    // car.raceArmed = false → car hasn't crossed start yet
    // car.raceArmed = true  → car crossed start, finish line is live
    //
    // This means: no matter how close to the finish line a car spawns,
    // it MUST cross the start marker first before any lap counts.

    // Track forward direction at the line (used for both markers)
    const trackFwdX = track.pts[1].x - track.pts[0].x;
    const trackFwdY = track.pts[1].y - track.pts[0].y;
    const trackFwdLen = Math.sqrt(trackFwdX*trackFwdX + trackFwdY*trackFwdY) || 1;
    const movingForward = (car.vx * trackFwdX + car.vy * trackFwdY) / trackFwdLen > 5;

    // ── Finish line: only counts when car.raceArmed = true ──────
    // raceArmed is set by the game loop once racing begins (after countdown).
    // This means no lap can ever complete until the game explicitly arms it,
    // regardless of where the car spawns relative to the finish line.
    if (car.raceArmed && nearStart && movingForward && car.onTrack) {
      if (car.checkpointsPassed.size >= allGates && car.progress < 0.1) {
        if (car.lap >= track.laps) {
          car.finished = true;
          car.finishTime = Game.raceTimer;
          if (car.isPlayer) Audio.playLapComplete();
        } else {
          car.lap++;
          car.checkpointsPassed.clear();
          if (car.isPlayer) Audio.playLapComplete();
        }
      }
    }

    // Update progress (careful with wrap-around)
    // Guard: if car is off-track the nearest-point snap can teleport progress
    // wildly. Only update progress when on track or the delta is plausible.
    const prevProgress = car.progress;
    const rawDelta = newProgress - prevProgress;
    // Allow forward motion up to 0.15 per frame, or a wrap from ~1→0
    const isWrap = prevProgress > 0.85 && newProgress < 0.15;
    const isPlausible = rawDelta >= 0 && rawDelta < 0.15;
    if (car.onTrack && (isPlausible || isWrap)) {
      car.progress = newProgress;
    } else if (car.onTrack) {
      // Large jump while on track — clamp to safe delta
      car.progress = prevProgress + Math.min(Math.max(rawDelta, -0.02), 0.15);
    }
    // While off track, freeze progress to prevent false lap triggers
  }

  // ── Car-car collision ────────────────────────────────
  function resolveCarCollisions(cars) {
    // Reset collision flags each frame
    for (const car of cars) car.justCollided = false;

    for (let i = 0; i < cars.length; i++) {
      for (let j = i+1; j < cars.length; j++) {
        const a = cars[i], b = cars[j];
        if (a.finished || b.finished || a.eliminated || b.eliminated) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const minDist = a.radius + b.radius;
        if (dist < minDist && dist > 0.1) {
          const nx = dx/dist, ny = dy/dist;
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;
          // Exchange some velocity
          // Only apply impulse if cars are approaching each other (dot > 0)
          const relVx = a.vx - b.vx, relVy = a.vy - b.vy;
          const dot = relVx*nx + relVy*ny;
          if (dot > 0) {
            const impulse = dot * 0.55;
            a.vx -= nx * impulse; a.vy -= ny * impulse;
            b.vx += nx * impulse; b.vy += ny * impulse;
          }
          if (a.isPlayer || b.isPlayer) {
            Audio.playCollision();
            if (a.isPlayer) a.justCollided = true;
            if (b.isPlayer) b.justCollided = true;
          }
        }
      }
    }
  }

  // ── Compute race positions ───────────────────────────
  function updatePositions(cars) {
    const sorted = [...cars]
      .filter(c => !c.finished && !c.eliminated)
      .sort((a, b) => {
        const aTotal = (a.lap - 1) + a.progress;
        const bTotal = (b.lap - 1) + b.progress;
        return bTotal - aTotal;
      });

    const finishedSorted = [...cars].filter(c => c.finished).sort((a,b) => a.finishTime - b.finishTime);
    const allSorted = [...finishedSorted, ...sorted];
    allSorted.forEach((c, i) => c.place = i + 1);
  }

  return { createCar, update, resolveCarCollisions, updatePositions, BASE, CAR_CLASSES, UPGRADE_DEFS };
})();
