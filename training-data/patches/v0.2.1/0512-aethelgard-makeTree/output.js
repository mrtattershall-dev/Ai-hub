function makeTree(x,z){
  const h=5+Math.random()*4;
  const t=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.19,h,6), new THREE.MeshLambertMaterial({color:0x18100a}));
  t.position.set(x,h/2,z); t.rotation.y=Math.random()*Math.PI; t.castShadow=true; scene.add(t);
  for(let i=0;i<3+Math.floor(Math.random()*3);i++){
    const b=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.08,1.4+Math.random(),4), new THREE.MeshLambertMaterial({color:0x120c06}));
    b.position.set(x+(Math.random()-0.5)*1.6,3+Math.random()*3.5,z+(Math.random()-0.5)*1.6);
    b.rotation.set((Math.random()-0.5)*1.3,Math.random()*Math.PI,(Math.random()-0.5)*1.3);
    b.castShadow=true; scene.add(b);
  }
}