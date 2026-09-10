function createEnemy(x,z,type='thrall'){
  const group=new THREE.Group(); group.position.set(x,0,z);
  const cfgs={
    thrall:  {bodyCol:0x1a1410,h:1.7, hp:100,poise:40,  dmg:12, speed:1.8,label:'Husked Thrall',   atk:2.5},
    elite:   {bodyCol:0x201018,h:1.88,hp:260,poise:80,  dmg:28, speed:2.2,label:'Iron-Plate Zealot',atk:2.0},
    boss:    {bodyCol:0x18080a,h:2.2, hp:700,poise:300, dmg:45, speed:1.5,label:'Tiw, The Flayed General',atk:1.5},
  };
  const cfg=cfgs[type]||cfgs.thrall;
  const bm=new THREE.MeshLambertMaterial({color:cfg.bodyCol});
  const s=cfg.h/1.7;

  const torsoE=new THREE.Mesh(new THREE.BoxGeometry(0.65*s,0.8*s,0.35*s),bm); torsoE.position.y=1.3*s; torsoE.castShadow=true; group.add(torsoE);
  const headE=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.38,0.35),bm); headE.position.y=cfg.h-0.12; group.add(headE);
  [-0.18,0.18].forEach(xo=>{ const l=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.7*s,0.22),bm); l.position.set(xo,0.4*s,0); group.add(l); });
  [-0.42,0.42].forEach(xo=>{ const a=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.65*s,0.18),bm); a.position.set(xo,1.2*s,0); group.add(a); });

  if(type==='elite'){
    const wep=new THREE.Mesh(new THREE.BoxGeometry(0.06,1.3,0.06), new THREE.MeshLambertMaterial({color:0x2a2520}));
    wep.position.set(0.54,1.2*s,0.3); group.add(wep);
    const shld=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.7,0.55), new THREE.MeshLambertMaterial({color:0x1e1c18}));
    shld.position.set(-0.54,1.2*s,0.1); group.add(shld);
  }
  if(type==='boss'){
    // Exposed musculature
    const muscleMat=new THREE.MeshLambertMaterial({color:0x5a0f0f,emissive:0x3a0808,emissiveIntensity:0.5});
    const muscles=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.75,0.32),muscleMat); muscles.position.y=1.45; group.add(muscles);
    const stump=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,0.55,8), new THREE.MeshLambertMaterial({color:0x3c1010})); stump.position.set(-0.55,1.35,0); group.add(stump);
    const acidMat=new THREE.MeshLambertMaterial({color:0x1a3a10,emissive:0x0a2a08,emissiveIntensity:1});
    const acid=new THREE.Mesh(new THREE.SphereGeometry(0.14,6,4),acidMat); acid.position.set(-0.55,0.85,0); group.add(acid);
    // Staples
    const stapleMat=new THREE.MeshLambertMaterial({color:0x3a3030,emissive:0x1a0808,emissiveIntensity:0.3});
    for(let i=0;i<6;i++){
      const st=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.04,0.04),stapleMat);
      st.position.set((Math.random()-0.5)*0.5,1.2+Math.random()*0.6,(Math.random()-0.5)*0.2);
      group.add(st);
    }
  }
  scene.add(group);
  group.children.forEach(c=>{ if(c.isMesh) c.userData.baseY=c.position.y; });

  // Attack telegraph light
  const atkLight=new THREE.PointLight(0xff2000, 0, 5);
  group.add(atkLight);

  const en={
    group,type,label:cfg.label,
    hp:cfg.hp,maxHp:cfg.hp,
    poise:cfg.poise,maxPoise:cfg.poise,
    dmg:cfg.dmg,speed:cfg.speed,
    state:'patrol',
    staggered:false,staggerTimer:0,
    attackTimer:cfg.atk+Math.random(),attackCooldown:cfg.atk,
    attackWindupTimer:0,
    isAttacking:false,attackActive:false,attackActiveTimer:0,
    dead:false,
    patrolAngle:Math.random()*Math.PI*2,
    patrolRadius:3+Math.random()*3,
    patrolCenter:new THREE.Vector3(x,0,z),
    atkLight,
    telegraphActive:false, telegraphTimer:0,
    phase:1,
  };
  en.group.userData.enemy=en;
  return en;
}