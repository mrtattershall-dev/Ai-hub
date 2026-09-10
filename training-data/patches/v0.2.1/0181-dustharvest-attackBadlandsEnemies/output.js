function attackBadlandsEnemies() {
  const range=(player._attackRange||20)+4;
  const facing={right:[1,0],left:[-1,0],up:[0,-1],down:[0,1]}[player.facing]||[1,0];
  for(let i=badlandsEnemies.length-1;i>=0;i--) {
    const e=badlandsEnemies[i];
    const ex=e.x-player.x, ey=e.y-player.y;
    const dist=Math.hypot(ex,ey);
    if(dist>range+16) continue;
    const dot=(ex*facing[0]+ey*facing[1])/dist;
    if(dot<0.3) continue;
    const dmg=player._attackDmg||12;
    e.hp-=dmg;
    spawnParticles(e.x,e.y,'#e04020',4,'💥');
    if(e.hp<=0) {
      const def=BADLANDS_ENEMY_DEFS[e.type];
      def.loot.forEach(([item,mn,mx])=>{
        if(item==='gold') { player.gold+=applyHeatLootMult(mn+Math.floor(Math.random()*(mx-mn+1))); return; }
        const qty=mn+Math.floor(Math.random()*(mx-mn+1));
        if(qty>0) addItem(item,qty);
      });
      rollHeatDrops();
      onBLEnemyKilled(e.type); // bounty tracking
      onBLKillHeat(e.type);    // heat tracking
      spawnParticles(e.x,e.y,'#f0d060',6,'⭐');
      badlandsEnemies.splice(i,1);
    }
  }
}