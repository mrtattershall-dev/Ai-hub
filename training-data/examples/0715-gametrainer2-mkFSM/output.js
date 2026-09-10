function mkFSM() {
  const enemies=[];
  for (let i=0;i<4;i++) enemies.push({ x:80+i*(canvas.width||600)/5, y:(canvas.height||400)*0.4+((i%2)*100), r:18, state:'idle', timer:0, health:3, statesSeen:new Set(['idle']), label:'idle', flash:0 });
  return { player:{x:300,y:300,r:16,vx:0,vy:0}, enemies, statesUnlocked:new Set(), won:false };
}