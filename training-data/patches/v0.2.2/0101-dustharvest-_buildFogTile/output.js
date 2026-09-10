function _buildFogTile(bucket) {
  const sz = T; // 32px
  let off;
  if (typeof OffscreenCanvas !== 'undefined') {
    off = new OffscreenCanvas(sz, sz);
  } else {
    off = document.createElement('canvas');
    off.width = off.height = sz;
  }
  const oc = off.getContext('2d');
  let s = bucket >>> 0;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };

  oc.fillStyle = 'rgba(18,17,24,0.97)';
  oc.fillRect(0, 0, sz, sz);

  const puffs1 = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < puffs1; i++) {
    oc.fillStyle = `rgba(38,36,50,${0.6 + rng() * 0.25})`;
    oc.beginPath(); oc.ellipse(rng()*sz, rng()*sz, 8+rng()*10, 5+rng()*7, rng()*Math.PI, 0, Math.PI*2); oc.fill();
  }
  const puffs2 = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < puffs2; i++) {
    oc.fillStyle = `rgba(58,55,72,${0.5 + rng() * 0.3})`;
    oc.beginPath(); oc.ellipse(rng()*sz, rng()*sz, 5+rng()*8, 3+rng()*5, rng()*Math.PI, 0, Math.PI*2); oc.fill();
  }
  const wisps = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < wisps; i++) {
    oc.fillStyle = `rgba(80,76,100,${0.2 + rng() * 0.2})`;
    oc.beginPath(); oc.ellipse(rng()*sz*0.6, rng()*sz*0.6, 3+rng()*6, 2+rng()*4, rng()*Math.PI, 0, Math.PI*2); oc.fill();
  }
  _fogCache.set(bucket, off);
  return off;
}