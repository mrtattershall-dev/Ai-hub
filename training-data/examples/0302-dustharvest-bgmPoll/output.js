function bgmPoll(dt) {
  if (!BGM.running) return;
  _bgmPollTimer -= dt;
  if (_bgmPollTimer > 0) return;
  _bgmPollTimer = 3;

  const h=(gameState.timeOfDay||0)/60;
  const isNight = h>=20||h<6;
  let target;

  if (gameState.inHoboCamp) {
    target = 'hobo';
  } else if (gameState.inOcean) {
    // Ocean day/night both use the ocean track; pirates don't change music (tension stays ambient)
    target = 'ocean';
  } else if (gameState.inMine) {
    target = 'mine';
  } else if (gameState.inBadlands) {
    // Badlands day = badlands track, night = combat escalates correctly
    const hasCombat = enemies.length>0 && enemies.some(e=>Math.hypot(player.x-e.x,player.y-e.y)<320);
    target = hasCombat ? 'combat' : 'badlands';
  } else if (gameState.zone === 'Wilderness') {
    target = isNight ? 'night' : 'wilderness';
  } else if (gameState.zone === 'Town' || (gameState.zone && gameState.zone.includes('Town'))) {
    target = isNight ? 'night' : 'town';
  } else {
    // Farm / default — day/night/combat
    const hasCombat = isNight && enemies.some(e=>Math.hypot(player.x-e.x,player.y-e.y)<320);
    target = isNight ? (hasCombat?'combat':'night') : 'day';
  }

  if (BGM.mode !== target) bgmSetMode(target);
}