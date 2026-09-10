function updateProjectiles(dt){
  for(let i=G.projectiles.length-1;i>=0;i--){
    const p=G.projectiles[i];
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;
    const t=tileAt(p.x,p.y);
    // Hit solid tiles
    if(t===T.WALL || (t===T.CHASM && !G.chasmed[Math.floor(p.y/TILE)*1000+Math.floor(p.x/TILE)]) || p.life<=0){
      if(t===T.WALL) addSat(p.x,p.y,5);
      boom(p.x,p.y,5,p.col,{spd:70,settles:true});
      G.projectiles.splice(i,1); continue;
    }
    let removed=false;
    if(p.fromPlayer){
      // Check boss first
      if(G.boss && Math.hypot(p.x-G.boss.x,p.y-G.boss.y)<G.boss.sz+5){
        hitBoss(p.dmg);
        boom(p.x,p.y,12,C.rouge,{settles:true});
        G.projectiles.splice(i,1); removed=true;
      }
      if(!removed) for(let j=G.enemies.length-1;j>=0;j--){
        const e=G.enemies[j];
        if(Math.hypot(p.x-e.x,p.y-e.y)<e.sz+5){
          hitEnemy(j,p.dmg);
          boom(p.x,p.y,12,C.rouge,{settles:true});
          G.projectiles.splice(i,1); removed=true; break;
        }
      }
    } else {
      // Enemy projectile hits player (iframes apply here too)
      if(G.iframes<=0 && Math.hypot(p.x-G.px,p.y-G.py)<G.psize+5){
        G.rouge=Math.max(0,G.rouge-p.dmg);
        G.iframes=0.25; // brief iframes so one shot doesn't chain
        G.shakeMag=4;
        boom(p.x,p.y,6,C.rouge,{settles:false});
        G.projectiles.splice(i,1); removed=true;
      }
    }
    if(!removed && G.projectiles[i]===undefined) continue; // already spliced
  }
}