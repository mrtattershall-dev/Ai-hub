function spawnBadlandsEnemyNear() {
  if(badlandsEnemies.length >= 14) return;
  const px = Math.floor(player.x / T); // player tile X

  // Zone thresholds match buildBadlands
  const DEEP_X = 25, MID_X = 55;

  // Each zone has its own weighted pool
  let pool;
  if (px < DEEP_X) {
    // Deep — desperados, dust devils, scorpions, vultures. No rattlers/outlaws.
    pool = ['desperado','desperado','dustDevil','dustDevil','dustDevil',
            'dustScorpion','dustScorpion','vulture'];
  } else if (px < MID_X) {
    // Mid — mixed, all types, desperado rare
    pool = ['outlaw','outlaw','outlaw','vulture','vulture',
            'dustScorpion','dustScorpion','rattler','dustDevil','desperado'];
  } else {
    // Entry — outlaws and rattlers only, easy
    pool = ['outlaw','outlaw','outlaw','outlaw','rattler','rattler','rattler','vulture'];
  }

  const typeKey = pool[Math.floor(Math.random()*pool.length)];
  const angle=Math.random()*Math.PI*2, dist=280+Math.random()*180;
  const sx=Math.max(T,Math.min((BL_W-1)*T, player.x+Math.cos(angle)*dist));
  const sy=Math.max(T,Math.min((BL_H-1)*T, player.y+Math.sin(angle)*dist));
  spawnBadlandsEnemy(typeKey,sx,sy);
}