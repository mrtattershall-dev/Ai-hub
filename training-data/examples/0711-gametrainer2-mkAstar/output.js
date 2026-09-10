function mkAstar() {
  const grid=[];
  for (let r=0;r<GROWS;r++) { grid[r]=[]; for(let c=0;c<GCOLS;c++) grid[r][c]={r,c,wall:false,g:Infinity,f:Infinity,h:0,parent:null,state:'none'}; }
  // Random walls
  for (let i=0;i<60;i++) {
    const r=1+Math.floor(Math.random()*(GROWS-2)), c=1+Math.floor(Math.random()*(GCOLS-2));
    grid[r][c].wall=true;
  }
  return { grid, start:grid[GROWS-2][1], goal:grid[1][GCOLS-2], path:[], searching:false, done:false, step:0, open:[], closed:[], won:false, clicks:0 };
}