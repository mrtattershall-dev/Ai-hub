function bench(x, z, ry=0) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(3,0.12,0.8), mats.concreteLight);
  seat.position.y=0.6; g.add(seat);
  [-1.2,1.2].forEach(dx => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.6,0.8), mats.steel);
    leg.position.set(dx,0.3,0); g.add(leg);
  });
  g.position.set(x,0.5,z); g.rotation.y=ry;
  g.traverse(c => { c.castShadow=true; c.receiveShadow=true; });
  scene.add(g);
}