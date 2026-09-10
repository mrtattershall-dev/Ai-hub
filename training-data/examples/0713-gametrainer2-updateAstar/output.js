function updateAstar(s, keys, mouse) {
  if (s.searching) for (let i=0;i<3;i++) stepAstar(s);
  if (mouse.click) {
    const cw=canvas.width/GCOLS, ch=canvas.height/GROWS;
    const gc=Math.floor(mouse.clickX/cw), gr=Math.floor(mouse.clickY/ch);
    if (gc>=0&&gc<GCOLS&&gr>=0&&gr<GROWS) {
      const cell=s.grid[gr][gc];
      if (cell!==s.start) {
        if (mouse.btn===2) { cell.wall=!cell.wall; }
        else { s.goal=cell; }
        resetAstar(s);
        s.clicks++;
      }
    }
    mouse.click=false;
  }
  if (mouse.rightDown) {
    const cw=canvas.width/GCOLS, ch=canvas.height/GROWS;
    const gc=Math.floor(mouse.x/cw), gr=Math.floor(mouse.y/ch);
    if (gc>=0&&gc<GCOLS&&gr>=0&&gr<GROWS) {
      const cell=s.grid[gr][gc];
      if (cell!==s.start&&cell!==s.goal) { cell.wall=true; resetAstar(s); }
    }
  }
}