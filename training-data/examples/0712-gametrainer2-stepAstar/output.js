function stepAstar(s) {
  if (!s.searching||s.open.length===0) { s.searching=false; return; }
  const cur=s.open.reduce((a,b)=>a.f<b.f?a:b);
  if (cur===s.goal) {
    s.searching=false; s.done=true;
    let n=s.goal; while(n){s.path.unshift(n);n=n.parent;}
    s.won=true; return;
  }
  s.open.splice(s.open.indexOf(cur),1);
  cur.state='closed';
  const dirs=[[0,1],[0,-1],[1,0],[-1,0]];
  for (const [dr,dc] of dirs) {
    const nr=cur.r+dr, nc=cur.c+dc;
    if (nr<0||nr>=GROWS||nc<0||nc>=GCOLS) continue;
    const nb=s.grid[nr][nc];
    if (nb.wall||nb.state==='closed') continue;
    const g=cur.g+1;
    if (g<nb.g) {
      nb.parent=cur; nb.g=g; nb.h=hDist(nb,s.goal); nb.f=g+nb.h;
      if (nb.state!=='open') { nb.state='open'; s.open.push(nb); }
    }
  }
}