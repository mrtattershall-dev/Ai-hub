function updateDeepJungleMovement(dx, dy, dt, spd) {
  if (!gameState.inDeepJungle) return;

  const nx = player.x + dx * spd * dt;
  const ny = player.y + dy * spd * dt;

  // Tile-based collision using deep map
  const tx = Math.floor(nx / DJ_T), ty = Math.floor(ny / DJ_T);

  // ASCEND tile check
  if (ty <= 0 || getDJT(Math.floor(player.x / DJ_T), ty) === JG.ASCEND) {
    exitDeepJungle();
    return;
  }

  const solid = getDJSolid(tx, ty);
  if (!solid) {
    player.x = nx; player.y = ny;
    // Explore
    _revealDeepArea(tx, ty, 4);
    // Formation proximity hint
    if (getDJT(tx, ty) === JG.FORMATION && !jungleTalkSeen.has('formation_first_contact')) {
      jungleTalkSeen.add('formation_first_contact');
      showMsg('🌑 The formation. You can feel it before you see it — a low vibration in the ground. The same feeling as the mine.');
      setTimeout(() => showMsg('🌑 Tobias mentioned sealed crates. Silas mentioned a singing vein. This is what they were extracting.'), 4000);
      setTimeout(() => showMsg('🌑 The Verdant Court has been watching this thing for longer than anyone has been alive.'), 8000);
      gameState._formationDiscovered = true;
    }
    // Ancient Court entrance
    if (getDJT(tx, ty) === JG.ANCIENT_FLOOR && !jungleTalkSeen.has('court_zone_entered')) {
      jungleTalkSeen.add('court_zone_entered');
      showMsg('🏛 The stonework is too large. The proportions are wrong — not hostile, just inhuman.');
      showMsg('🏛 Something moves in the far end of the chamber. Not threatening. Present.');
      gameState._courtZoneEntered = true;
      // Placeholder for Slice 18 emissary encounter
      if (typeof _tryCourtEmissaryEncounter === 'function') _tryCourtEmissaryEncounter();
    }
    // ROOT tile — slight movement penalty
    if (getDJT(tx, ty) === JG.ROOT) player.stamina = Math.max(0, player.stamina - 0.08 * dt);
  } else {
    // Slide along walls
    const solidX = getDJSolid(Math.floor(nx / DJ_T), Math.floor(player.y / DJ_T));
    const solidY = getDJSolid(Math.floor(player.x / DJ_T), ty);
    if (!solidX) player.x = nx;
    if (!solidY) player.y = ny;
  }
}