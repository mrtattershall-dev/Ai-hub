function tickBLMineHazards(dt) {
  if (!gameState.inBLMine) return;
  const fl = gameState.blMineFloor;
  const cfg = BL_MINE_FLOOR_CFG[fl];
  _blMineHazardTimer -= dt;
  if (_blMineHazardTimer > 0) return;
  _blMineHazardTimer = cfg.hazardInterval * (0.7 + Math.random() * 0.6);
  if (Math.random() > cfg.hazardChance) return;
  // Gas pocket — company mine vented sulfur gas
  const msgs = [
    '⚠️ Gas pocket — sulfur smell, eyes stinging. Move through quickly!',
    '⚠️ Pressure vent — air goes bad for a moment. Don\'t linger.',
    '⚠️ Old gas line rupture — faint yellow haze. Keep moving.',
  ];
  const msg = msgs[Math.floor(Math.random()*msgs.length)];
  showMsg(msg);
  // Damage if player is on a deep floor and doesn't move
  if (fl >= 3) {
    const gasDmg = player._mineCanary ? 3 : 8;
    setTimeout(() => {
      if (gameState.inBLMine && gameState.blMineFloor === fl) {
        damagePlayer(gasDmg, 'gas');
        if (gasDmg > 3) showMsg('💨 Gas exposure — took ' + gasDmg + ' damage.');
      }
    }, 3500);
  }
}