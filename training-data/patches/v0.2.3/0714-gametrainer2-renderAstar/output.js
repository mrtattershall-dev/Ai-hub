function renderAstar(s) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const cw=canvas.width/GCOLS, ch=canvas.height/GROWS;
  for (const row of s.grid) for (const cell of row) {
    let fill='#0c0b08';
    if (cell.wall) fill='#2c2a22';
    else if (cell===s.start) fill='#5ecf7a33';
    else if (cell===s.goal) fill='#e8a83233';
    else if (s.path.includes(cell)) fill='#e8a83222';
    else if (cell.state==='open') fill='#5ecf7a15';
    else if (cell.state==='closed') fill='#3a383022';
    ctx.fillStyle=fill;
    ctx.fillRect(cell.c*cw, cell.r*ch, cw-1, ch-1);
    if (s.path.includes(cell)&&cell!==s.start&&cell!==s.goal) {
      ctx.fillStyle='#e8a832';
      ctx.fillRect(cell.c*cw+cw/2-3,cell.r*ch+ch/2-3,6,6);
    }
    if (cell===s.start) { ctx.fillStyle='#5ecf7a'; ctx.font='bold 12px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('S',cell.c*cw+cw/2,cell.r*ch+ch/2); }
    if (cell===s.goal)  { ctx.fillStyle='#e8a832'; ctx.font='bold 12px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('G',cell.c*cw+cw/2,cell.r*ch+ch/2); }
    // f/g labels on open
    if (cell.state==='open'&&cell!==s.start&&cell!==s.goal&&cw>26) {
      ctx.fillStyle='#5ecf7a66'; ctx.font='8px monospace'; ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText(Math.round(cell.f),cell.c*cw+cw/2,cell.r*ch+1);
    }
  }
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  // Legend
  const ly=canvas.height-26;
  const items=[['#5ecf7a','open list'],['#3a3830','closed'],['#e8a832','path'],['#2c2a22','wall']];
  items.forEach(([c,l],i)=>{ ctx.fillStyle=c; ctx.fillRect(8+i*110,ly,10,10); ctx.fillStyle='#4a4838'; ctx.font='10px monospace'; ctx.fillText(l,22+i*110,ly+9); });
  ctx.fillStyle='#4a4838'; ctx.font='11px monospace';
  ctx.fillText('left-click: set goal  |  right-click/drag: draw walls', 8, canvas.height-36);
  ctx.fillText(`open: ${s.open.length}  closed: ${s.grid.flat().filter(c=>c.state==='closed').length}  path: ${s.path.length}`, 8, 18);
}