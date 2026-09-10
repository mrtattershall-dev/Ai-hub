function lampDecor(x, z) {
  cyl(0.06,0.06,8,6,mats.steel,x,4,z);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,1.5),mats.steel);
  arm.position.set(x,7.8,z-0.7); scene.add(arm);
  cyl(0.3,0.3,0.2,8,new THREE.MeshStandardMaterial({color:0xffc947,emissive:0xffc947,emissiveIntensity:1.5}),x,7.6,z-1.3);
}