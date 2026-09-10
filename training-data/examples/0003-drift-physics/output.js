// ═══════════════════════════════════════════════════════
//  DRIFT MODULE  –  Combo scoring + CR rewards
//
//  Only the player car is scored. AI cars ignored.
//
//  Drift score accumulates while:
//    - car.drifting === true
//    - lateralSpeed > MIN_LATERAL  (real slide, not micro-wiggles)
//    - car is on track
//    - speed > MIN_SPEED  (no cheating stationary)
//
//  Combo multiplier tiers:
//    x1  → 0 – 499 pts
//    x2  → 500 – 1499 pts
//    x3  → 1500 – 2999 pts
//    x4  → 3000+ pts
//
//  Combo breaks when:
//    - drifting stops for > BREAK_GRACE seconds
//    - car goes off track
//    - car collides (car.justCollided flag set by physics)
//
//  On break: award floor(score * multiplier / SCORE_TO_CR) CR
//  Minimum payout: COMBO_FLOOR pts (anything below is discarded silently)
// ═══════════════════════════════════════════════════════

const Drift = (() => {

  // ── Tuning constants ──────────────────────────────────
  const MIN_LATERAL    = 22;   // px/s lateral speed to count as a drift
  const MIN_SPEED      = 55;   // px/s forward speed floor
  const BREAK_GRACE    = 0.35; // seconds of non-drift before combo breaks
  const SCORE_RATE     = 1.0;  // score per px/s of lateral speed, per second
  const SCORE_TO_CR    = 80;   // score points per 1 CR earned
  const COMBO_FLOOR    = 120;  // minimum score for any payout
  const MULT_THRESHOLDS = [0, 500, 1500, 3000]; // score needed for x1/x2/x3/x4

  // Drifter gets a bonus score rate multiplier
  const CLASS_RATE = { drifter: 1.6, speedster: 1.0, bruiser: 0.75 };

  // ── Per-race state ────────────────────────────────────
  let score       = 0;   // current combo raw score
  let multiplier  = 1;   // current combo multiplier (1–4)
  let graceTimer  = 0;   // seconds since last valid drift frame
  let active      = false; // is a combo running?
  let sessionCR   = 0;   // CR earned this race from drift
  let lastPopup   = 0;   // throttle multiplier-up popups

  // Exposed for HUD rendering
  let displayScore = 0;  // smooth-lerped display value
  let displayAlpha = 0;  // 0-1 fade for the whole meter

  // ── Reset between races ───────────────────────────────
  function reset() {
    score = 0; multiplier = 1; graceTimer = 0;
    active = false; sessionCR = 0; lastPopup = 0;
    displayScore = 0; displayAlpha = 0;
  }

  // ── Called every race frame ───────────────────────────
  function update(player, dt) {
    if (!player || player.finished) return;

    const lateral = Math.abs(player.lateralVel || 0);
    const forward = player.speed;
    const rate    = CLASS_RATE[player.carClass] || 1.0;

    const isDrifting = player.drifting
      && player.onTrack
      && lateral > MIN_LATERAL
      && forward > MIN_SPEED;

    if (isDrifting) {
      graceTimer = 0;
      if (!active) active = true;

      // Accumulate score — lateral speed × rate × class bonus
      score += lateral * SCORE_RATE * rate * dt;

      // Update multiplier tier
      const newMult = calcMultiplier(score);
      if (newMult > multiplier) {
        multiplier = newMult;
        if (Date.now() - lastPopup > 800) {
          Renderer.showLapFlash(`x${multiplier} COMBO!`);
          Particles.screenShake(3, 0.2);
          lastPopup = Date.now();
        }
      }

      // Extra sparks for active drift — intensity scales with multiplier
      if (Math.random() < 0.35 * multiplier) {
        Particles.emitSparks(player.x, player.y, multiplier, player.color, 0.8);
      }

    } else {
      if (active) {
        graceTimer += dt;
        if (graceTimer > BREAK_GRACE || !player.onTrack || player.justCollided) {
          breakCombo(player);
        }
      }
    }

    // Smooth display lerp
    displayScore += (score - displayScore) * Math.min(1, dt * 8);
    const targetAlpha = active ? 1 : Math.max(0, displayAlpha - dt * 1.5);
    displayAlpha += (targetAlpha - displayAlpha) * Math.min(1, dt * 6);
  }

  function calcMultiplier(s) {
    for (let i = MULT_THRESHOLDS.length - 1; i >= 0; i--) {
      if (s >= MULT_THRESHOLDS[i]) return i + 1;
    }
    return 1;
  }

  function breakCombo(player) {
    if (score >= COMBO_FLOOR) {
      const earned = Math.floor(score * multiplier / SCORE_TO_CR);
      sessionCR += earned;

      // Award immediately to save data
      const save = SaveSystem.load();
      save.currency += earned;
      SaveSystem.save(save);

      // Flash the payout
      Renderer.showLapFlash(`+${earned} CR DRIFT!`);
      Particles.emitSparks(player.x, player.y, 12, player.color, 1.4);
      Particles.screenShake(4, 0.3);
    }

    score = 0;
    multiplier = 1;
    graceTimer = 0;
    active = false;
    lastPopup = 0;
  }

  // Force-break at race end (collect any lingering combo)
  function finalize(player) {
    if (active && score >= COMBO_FLOOR) {
      breakCombo(player);
    }
    active = false;
  }

  // ── HUD data (read by UI.updateHUD) ──────────────────
  function getHUD() {
    return {
      score:      Math.round(displayScore),
      multiplier,
      alpha:      displayAlpha,
      active,
      sessionCR,
      thresholds: MULT_THRESHOLDS,
    };
  }

  return { reset, update, finalize, getHUD };
})();
