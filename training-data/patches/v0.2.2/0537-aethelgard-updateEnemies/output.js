function updateEnemies(dt,t){
  MELEE_BUDGET.cooldown=Math.max(0,MELEE_BUDGET.cooldown-dt);
  if(MELEE_BUDGET.cooldown<=0) MELEE_BUDGET.count=0;
  G.nearExecutable=false;

  G.enemies.forEach(en=>{
    if(en.dead) return;
    const toPlayer=playerGroup.position.clone().sub(en.group.position);
    const dist=toPlayer.length();

    if(dist<25&&en.state!=='patrol'){
      const angle=Math.atan2(toPlayer.x,toPlayer.z);
      en.group.rotation.y+=(angle-en.group.rotation.y)*0.1;
    }

    // Execution check
    if(en.staggered&&en.hp<en.maxHp*0.3&&dist<3.5) G.nearExecutable=true;

    // Telegraph light update
    const atkLightTarget=en.telegraphActive?4:0;
    en.atkLight.intensity+=(atkLightTarget-en.atkLight.intensity)*dt*10;

    // Stagger handling
    if(en.staggered){
      en.staggerTimer-=dt;
      const maxStag=en.type==='boss'?3:4;
      const fp=Math.min(1,Math.max(0,(maxStag-en.staggerTimer)/0.3));
      en.group.rotation.z=(Math.PI/2)*fp;
      if(en.staggerTimer<=0){ en.staggered=false; en.state='alert'; en.group.rotation.z=0; }
      return;
    }
    en.group.rotation.z=0;

    switch(en.state){
      case 'patrol':{
        const tx=en.patrolCenter.x+Math.cos(en.patrolAngle)*en.patrolRadius;
        const tz=en.patrolCenter.z+Math.sin(en.patrolAngle)*en.patrolRadius;
        const mv=new THREE.Vector3(tx-en.group.position.x,0,tz-en.group.position.z);
        if(mv.length()<0.5) en.patrolAngle+=0.7;
        else { mv.normalize(); en.group.position.addScaledVector(mv,en.speed*0.5*dt); }
        const alertDist=en.type==='boss'?20:13;
        if(dist<alertDist){
          en.state='alert';
          if(en.type==='boss'&&!G.bossDetected){
            G.bossDetected=true;
            document.getElementById('boss-hud').style.opacity='1';
            SFX.bossRoar();
            showChapterText('Chapter I — Final Trial','Tiw, The Flayed General');
          }
        }
        break;
      }
      case 'alert':{
        const alertRange=en.type==='boss'?25:18;
        if(dist>alertRange){ en.state='patrol'; break; }
        en.attackTimer-=dt;
        // Advance / strafe
        const strafeDir=new THREE.Vector3(-toPlayer.z,0,toPlayer.x).normalize();
        en.group.position.addScaledVector(strafeDir,0.25*dt*(Math.random()<0.5?1:-1));
        if(dist>2.8&&dist<15){
          const approach=toPlayer.clone().normalize().multiplyScalar(en.speed*dt);
          en.group.position.add(approach);
        }
        // Check attack
        const atkRange=en.type==='boss'?3.5:2.8;
        if(en.attackTimer<=0&&dist<atkRange&&MELEE_BUDGET.count<2){
          en.state='telegraph';
          en.telegraphActive=true;
          en.telegraphTimer=en.type==='boss'?0.55:0.4;
          MELEE_BUDGET.count++; MELEE_BUDGET.cooldown=1.5;
        }
        break;
      }
      case 'telegraph':{
        // Wind-up visible warning
        en.telegraphTimer-=dt;
        if(en.telegraphTimer<=0){
          en.telegraphActive=false;
          en.state='attacking';
          en.attackActive=true;
          en.attackActiveTimer=en.type==='boss'?0.45:0.3;
          en.isAttacking=true;
          const lunge=toPlayer.clone().normalize().multiplyScalar(0.5);
          en.group.position.add(lunge);
        }
        break;
      }
      case 'attacking':{
        en.attackActiveTimer-=dt;
        if(en.attackActive&&en.attackActiveTimer<=0){
          en.attackActive=false; en.isAttacking=false;
          MELEE_BUDGET.count=Math.max(0,MELEE_BUDGET.count-1);
          if(dist<3.2){
            if(G.isParrying&&G.parryWindow>0) resolveParry(en);
            else takeDamage(en.dmg*(G.bloodDrunk?0.65:1));
          }
          en.state='recovering';
          en.attackTimer=en.attackCooldown+(en.type==='boss'?0:Math.random());
        }
        break;
      }
      case 'recovering':{
        en.attackTimer-=dt;
        if(en.attackTimer<=0) en.state='alert';
        break;
      }
    }

    // Clamp to arena
    const ab=ARENA_BOUND-1;
    en.group.position.x=Math.max(-ab,Math.min(ab,en.group.position.x));
    en.group.position.z=Math.max(-ab,Math.min(ab,en.group.position.z));

    // Bob animation
    if(en.state==='alert'||en.state==='attacking'||en.state==='telegraph'){
      en.group.children.forEach((c,ci)=>{
        if(c.isMesh&&c.userData.baseY!==undefined) c.position.y=c.userData.baseY+Math.sin(t*4+ci)*0.022;
      });
    } else {
      en.group.children.forEach(c=>{ if(c.isMesh&&c.userData.baseY!==undefined) c.position.y=c.userData.baseY; });
    }
  });
}