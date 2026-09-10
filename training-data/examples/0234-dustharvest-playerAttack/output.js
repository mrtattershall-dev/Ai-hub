function playerAttack() {
  if (player.attackCooldown > 0) return;
  if (player.stamina < ATTACK_STAMINA) { showMsg('⚠️ Too tired to fight!'); return; }

  player.attackCooldown = ATTACK_CD;
  player.attackFlash    = 0.2;
  player.stamina = Math.max(0, player.stamina - ATTACK_STAMINA);

  const dmg   = getEffectiveAttackDmg();
  const range = getEffectiveAttackRange();

  // Pistol ranged mode
  if (player._pistolMode && player._hasPistol) {
    let hit = false;
    const _plist = gameState.inBadlands ? badlandsEnemies : enemies;
    for (const e of _plist) {
      if (e.hidden) continue;
      const dist = Math.hypot(player.x - e.x, player.y - e.y);
      if (dist > 150) continue;
      const angle = Math.atan2(e.y - player.y, e.x - player.x);
      const facingAngle = { right:0, left:Math.PI, down:Math.PI/2, up:-Math.PI/2 }[player.facing] || 0;
      const diff = Math.abs(((angle - facingAngle) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (diff < Math.PI * 0.25) { // tighter arc for pistol
        e.hp -= 55;
        e.flashTimer = 0.18;
        spawnParticles(e.x, e.y, '#ff8020', 4, '-55');
        hit = true;
      }
    }
    // Cull dead badlands enemies after pistol shot
    if (gameState.inBadlands) {
      for (let i=badlandsEnemies.length-1;i>=0;i--) {
        const e=badlandsEnemies[i];
        if (e.hp<=0) {
          const def=BADLANDS_ENEMY_DEFS[e.type];
          if(def) def.loot.forEach(([item,mn,mx])=>{
            if(item==='gold'){player.gold+=applyHeatLootMult(mn+Math.floor(Math.random()*(mx-mn+1)));return;}
            const qty=mn+Math.floor(Math.random()*(mx-mn+1));
            if(qty>0) addItem(item,qty);
          });
          if(def) { rollHeatDrops(); onBLEnemyKilled(def.ai?e.type:e.type); onBLKillHeat(e.type); }
          spawnParticles(e.x,e.y,'#f0d060',6,'⭐');
          badlandsEnemies.splice(i,1);
        }
      }
    }
    if (!hit) spawnParticles(player.x, player.y, '#808060', 2, '💨');
    return;
  }

  // Melee arc in front of player
  const facingAngle = { right:0, left:Math.PI, down:Math.PI/2, up:-Math.PI/2 }[player.facing] || 0;
  let hit = false;
  const _enemyList = gameState.inBadlands ? badlandsEnemies : enemies;
  for (const e of _enemyList) {
    if (e.hidden) continue;
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    if (dist > range) continue;
    const angle = Math.atan2(e.y - player.y, e.x - player.x);
    const diff  = Math.abs(((angle - facingAngle) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
    if (diff < Math.PI * 0.65) {
      e.hp -= dmg;
      e.flashTimer = 0.18;
      spawnParticles(e.x, e.y, '#ff4020', 4, '-'+dmg);
      hit = true;
      dSound('hit');
    }
  }
  // Cull dead badlands enemies here
  if (gameState.inBadlands) {
    for (let i=badlandsEnemies.length-1;i>=0;i--) {
      const e=badlandsEnemies[i];
      if (e.hp<=0) {
        const def=BADLANDS_ENEMY_DEFS[e.type];
        if(def) def.loot.forEach(([item,mn,mx])=>{
          if(item==='gold'){player.gold+=applyHeatLootMult(mn+Math.floor(Math.random()*(mx-mn+1)));return;}
          const qty=mn+Math.floor(Math.random()*(mx-mn+1));
          if(qty>0) addItem(item,qty);
        });
        if(def) { rollHeatDrops(); onBLEnemyKilled(e.type); onBLKillHeat(e.type); }
        spawnParticles(e.x,e.y,'#f0d060',6,'⭐');
        badlandsEnemies.splice(i,1);
      }
    }
  }
  if (!hit) spawnParticles(player.x, player.y, '#808060', 2, '🔨');
}