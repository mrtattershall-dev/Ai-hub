function drawPlayer() {
  const cam   = gameState.camera;
  const sx    = Math.round(player.x - cam.x);
  const sy    = Math.round(player.y - cam.y);
  const t     = Date.now();
  const wf    = player.walkFrame || 0;
  // Walking: full body bob. Idle: no translation — chest breathe is handled inside drawCharacter via cfg
  const isMovingNow = keys['ArrowLeft']||keys['ArrowRight']||keys['ArrowUp']||keys['ArrowDown']||
                      keys['KeyA']||keys['KeyD']||keys['KeyW']||keys['KeyS'];
  const bob   = isMovingNow ? Math.sin(t * 0.003) * 1.5 : 0;
  // Idle breathe: very subtle chest scale pulse — passed to drawCharacter so only torso is affected
  const idleBreath = isMovingNow ? 0 : Math.sin(t * 0.0012) * 0.5;

  // Build cfg from player customization (with safe defaults)
  const cfg = {
    gender:     player.gender     || 'male',
    skinTone:   player.skinTone   || 0,
    hairStyle:  player.hairStyle  || 0,
    hairColor:  player.hairColor  || 1,
    shirtStyle: player.shirtStyle || 0,
    shirtColor: player.shirtColor || 0,
    pantsColor: player.pantsColor || 0,
    hatColor:   player.hatColor   || 0,
  };

  // Shadow
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 2, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw the character using the shared engine
  // sy+bob so the whole character bobs on walk stride; idle is no translate
  if (!isMovingNow && idleBreath !== 0) {
    // Very subtle chest-only scale for breathing — scale the torso area slightly
    ctx.save();
    const chestCY = sy - 16; // approximate torso center
    ctx.translate(sx, chestCY);
    ctx.scale(1, 1 + idleBreath * 0.018);
    ctx.translate(-sx, -chestCY);
    drawCharacter(ctx, sx, sy + bob, player.facing, wf, player.sprinting, cfg);
    ctx.restore();
  } else {
    drawCharacter(ctx, sx, sy + bob, player.facing, wf, player.sprinting, cfg);
  }

  // ── Tool icon ──
  const ti = {
    till:'⛏', water:'💧',
    plant:(CROPS[player.selectedSeed]&&CROPS[player.selectedSeed].icon)||'🌱',
    harvest:'🌾'
  };
  ctx.font = '13px serif'; ctx.textAlign = 'center';
  ctx.fillText(ti[player.tool] || '', sx, sy - 44 + bob);

  if (inventory.totalWeight > getEffectiveWeightCap() * 0.8) {
    ctx.fillStyle = 'rgba(220,80,30,.9)'; ctx.font = '7px sans-serif';
    ctx.fillText('⚠ HEAVY', sx, sy - 52 + bob);
  }
}