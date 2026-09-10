function showTetherBeam(from,to){
  const dir=to.clone().sub(from); const len=dir.length();
  const geo=new THREE.CylinderGeometry(0.04,0.04,len,4);
  const mat=new THREE.MeshLambertMaterial({color:0xc85a10,emissive:0x8b2500,emissiveIntensity:2});
  const beam=new THREE.Mesh(geo,mat);
  const mid=from.clone().add(to).multiplyScalar(0.5); mid.y+=0.5;
  beam.position.copy(mid); beam.lookAt(to); beam.rotateX(Math.PI/2);
  scene.add(beam); setTimeout(()=>scene.remove(beam),280);
}