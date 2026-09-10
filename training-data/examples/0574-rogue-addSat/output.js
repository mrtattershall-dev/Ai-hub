function addSat(px,py,amt){
  const c=Math.floor(px/TILE), r=Math.floor(py/TILE);
  if(r<0||r>=ROWS||c<0||c>=COLS) return;
  // Acidic-Kidney: triple saturation gain on wall tiles
  const hasAcid=(G.grafts&&(G.grafts[0]==='ORG-04'||G.grafts[1]==='ORG-04'));
  const t0=G.map[r][c];
  if(hasAcid && t0===T.WALL) amt*=3;
  const prev=G.sat[r][c];
  G.sat[r][c]=Math.min(100,prev+amt);
  const s=G.sat[r][c], t=G.map[r][c];
  // Wall dissolves at 80
  if(t===T.WALL && s>=80 && prev<80){
    G.map[r][c]=T.FLOOR; G.tilesTransformed++;
    boom(c*TILE+20,r*TILE+20,10,C.iron,{spd:80,settles:false});
  }
  // Chasm bridges at 80
  if(t===T.CHASM && s>=80 && !G.chasmed[r*1000+c]){
    G.chasmed[r*1000+c]=true; G.tilesTransformed++;
  }
  // Bio-door tile itself at 60
  if(t===T.BIODOOR && s>=60){ G.doored[r*1000+c]=true; G.tilesTransformed++; }
  // Bio-door unlocks from adjacent saturation avg
  for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
    const nr=r+dr, nc=c+dc;
    if(nr<0||nr>=ROWS||nc<0||nc>=COLS) continue;
    if(G.map[nr][nc]!==T.BIODOOR) continue;
    let tot=0,cnt=0;
    for(const [dr2,dc2] of [[-1,0],[1,0],[0,-1],[0,1]]){
      const nr2=nr+dr2,nc2=nc+dc2;
      if(nr2>=0&&nr2<ROWS&&nc2>=0&&nc2<COLS){ tot+=G.sat[nr2][nc2]; cnt++; }
    }
    if(cnt && tot/cnt>=60) G.doored[nr*1000+nc]=true;
  }

  // Bio-Generator awakens at sat>=70 — triggers enemy wave
  if(t===T.BIO_GEN && s>=70 && !G.genAwake[r*1000+c]){
    G.genAwake[r*1000+c]=true;
    G.tilesTransformed++;
    triggerBioGenWave(c*TILE+TILE/2, r*TILE+TILE/2);
  }

  // Spore Vent activates at sat>=50
  if(t===T.SPORE_VENT && s>=50 && !G.ventActive[r*1000+c]){
    G.ventActive[r*1000+c]=true;
    G.tilesTransformed++;
    playSound('spore');
  }
}