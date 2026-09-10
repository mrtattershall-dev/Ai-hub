function makeGuard(x, z, patrolA, patrolB) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.55,0.28), mats.guard);
  torso.position.y=1.0; torso.castShadow=true; g.add(torso);
  const hd = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.26,0.26), mats.guardFace);
  hd.position.y=1.42; hd.castShadow=true; g.add(hd);
  const cap2 = new THREE.Mesh(new THREE.BoxGeometry(0.30,0.07,0.30), mat(0x0a1a3a));
  cap2.position.y=1.58; g.add(cap2);
  [-0.10,0.10].forEach(lx => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13,0.38,0.14), mat(0x0a1a3a));
    leg.position.set(lx,0.49,-0.05); leg.castShadow=true; g.add(leg);
  });
  const coneMat = new THREE.MeshBasicMaterial({ color:0xef5350, transparent:true, opacity:0.0, side:THREE.DoubleSide, depthWrite:false });
  const coneMesh = new THREE.Mesh(new THREE.ConeGeometry(4,8,8,1,true), coneMat);
  coneMesh.position.set(0,0.8,-4); coneMesh.rotation.x=Math.PI/2; g.add(coneMesh);
  g.position.set(x,0.5,z); scene.add(g);
  guards.push({ group:g, patrolA:new THREE.Vector3(patrolA[0],0.5,patrolA[1]), patrolB:new THREE.Vector3(patrolB[0],0.5,patrolB[1]), target:0, speed:2.2+Math.random()*0.5, alertLevel:0, coneMat });
}