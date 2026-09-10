function getInputDir(){
  const dir=new THREE.Vector3();
  const fwd=new THREE.Vector3(-Math.sin(G.cameraYaw),0,-Math.cos(G.cameraYaw));
  const right=new THREE.Vector3(Math.cos(G.cameraYaw),0,-Math.sin(G.cameraYaw));
  if(G.keys['w']||G.keys['arrowup']) dir.add(fwd);
  if(G.keys['s']||G.keys['arrowdown']) dir.sub(fwd);
  if(G.keys['a']||G.keys['arrowleft']) dir.sub(right);
  if(G.keys['d']||G.keys['arrowright']) dir.add(right);
  if(dir.lengthSq()>0) dir.normalize();
  return dir;
}