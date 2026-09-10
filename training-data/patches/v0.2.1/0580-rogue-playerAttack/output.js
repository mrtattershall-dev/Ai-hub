function playerAttack(){
  if(G.attackCd>0) return;
  const orgId=G.grafts[0];
  const org=ORGANS[orgId];

  // Only cost rouge if there are enemies nearby or we fire a projectile
  const hasPrimary=!!org;
  const attackRange = hasPrimary && org.type==='melee' ? (orgId==='ORG-10'?115:95) : 95;

  if(!hasPrimary){
    // Default pulse: instant melee in 95px radius
    const cl=nearestEnemy(attackRange);
    if(cl>=0){ G.rouge=Math.max(0,G.rouge-3); hitEnemy(cl,15); }
    else { tryHitBoss(attackRange,15); G.rouge=Math.max(0,G.rouge-3); }
    boom(G.px,G.py,8,C.rouge,{settles:true,spd:100,up:true});
    G.attackCd=0.42;
    playSound('attack');
    return;
  }

  G.rouge=Math.max(0,G.rouge-3);
  G.attackCd=org.cd;

  // Neuron-Spine: +10% movement speed (handled in updatePlayer)
  // Tumor-Chassis: armor block (handled in contact damage)

  if(org.type==='ranged'){
    // ORG-05: Tendril-Aorta — pull nearest enemy or boss toward player
    if(orgId==='ORG-05'){
      const cl=nearestEnemy(280);
      if(cl>=0){
        const en=G.enemies[cl];
        const dx=G.px-en.x, dy=G.py-en.y, dist=Math.hypot(dx,dy)||1;
        const pullSpd=320;
        en.x+=dx/dist*pullSpd*org.cd;
        en.y+=dy/dist*pullSpd*org.cd;
        boom(en.x,en.y,14,'#cc44aa',{settles:false,spd:120});
        hitEnemy(cl, org.dmg);
        if(G.synergy==='tendril_blade' && (G.grafts[0]==='ORG-02'||G.grafts[1]==='ORG-02'))
          hitEnemy(cl, ORGANS['ORG-02'].dmg);
      } else if(G.boss){
        // Pull boss (partial)
        const bx=G.boss.x-G.px, by=G.boss.y-G.py, bd=Math.hypot(bx,by)||1;
        G.boss.x-=bx/bd*80; G.boss.y-=by/bd*80;
        hitBoss(org.dmg);
        boom(G.boss.x,G.boss.y,14,'#cc44aa',{settles:false,spd:120});
      }
    } else {
      spawnProj(G.px,G.py,G.mx,G.my,org.dmg,true,C.bright);
      if(orgId==='ORG-01'){
        const a=Math.atan2(G.my-G.py,G.mx-G.px);
        spawnProj(G.px,G.py, G.px+Math.cos(a+0.28)*200, G.py+Math.sin(a+0.28)*200, org.dmg*0.75, true, C.bright);
        spawnProj(G.px,G.py, G.px+Math.cos(a-0.28)*200, G.py+Math.sin(a-0.28)*200, org.dmg*0.75, true, C.bright);
      }
    }
  } else {
    // Melee: hit nearest enemy in range, fall back to boss
    const cl=nearestEnemy(attackRange);
    if(cl>=0){
      hitEnemy(cl,org.dmg);
      if(orgId==='ORG-06'){
        const healAmt = G.synergy==='jaw_pump' ? 25 : 15;
        G.rouge=Math.min(G.maxRouge,G.rouge+healAmt);
      }
    } else {
      tryHitBoss(attackRange, org.dmg);
    }
    boom(G.px,G.py,16,C.rouge,{settles:true,spd:130});
  }
  playSound('attack');
}