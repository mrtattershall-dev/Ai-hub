function makeTorch(x,z) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.8,5), new THREE.MeshLambertMaterial({color:0x2a1a08}));
  pole.position.set(x,0.9,z); scene.add(pole);
  const fl = new THREE.PointLight(0xb84010, 1.8, 7);
  fl.position.set(x,1.9,z);
  fl.userData.base=1.8; fl.userData.speed=2+Math.random()*3; fl.userData.phase=Math.random()*Math.PI*2;
  scene.add(fl); torchLights.push(fl);
}