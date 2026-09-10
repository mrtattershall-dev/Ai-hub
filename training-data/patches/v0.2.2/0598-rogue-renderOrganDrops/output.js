function renderOrganDrops(){
  for(const d of G.organDrops){
    const o=ORGANS[d.org];
    const pulse=0.5+0.5*Math.sin(G.time*8+d.id*10);
    // Glow base
    ctx.fillStyle=o?o.col:C.gold; ctx.globalAlpha=0.55+pulse*0.4;
    ctx.beginPath(); ctx.arc(d.x,d.y,9,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    // Icon
    ctx.fillStyle=C.white; ctx.font='12px serif'; ctx.textAlign='center';
    ctx.fillText(o?o.icon:'?',d.x,d.y+4);
    // Countdown ring
    const frac=d.timer/(d.maxTimer||4.0);
    ctx.strokeStyle=frac>0.5?C.gold:'#ff9900'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(d.x,d.y,13,-Math.PI/2,-Math.PI/2+frac*Math.PI*2); ctx.stroke();
    // Name label above
    ctx.fillStyle=`rgba(255,183,3,${0.6+pulse*0.3})`; ctx.font='7px Courier New';
    ctx.fillText(o?o.name.split('-')[0].toUpperCase():'ORG',d.x,d.y-16);
  }
}