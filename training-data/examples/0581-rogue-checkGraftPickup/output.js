function checkGraftPickup(){
  if(graftCooldown>0) return;
  for(let i=G.organDrops.length-1;i>=0;i--){
    const d=G.organDrops[i];
    if(Math.hypot(G.px-d.x,G.py-d.y)<26){
      equipOrgan(d.org);
      G.organDrops.splice(i,1);
      G.graftsEquipped++;
      graftCooldown=0.8; // 0.8s before next auto-pickup
      playSound('graft');
      return;
    }
  }
}