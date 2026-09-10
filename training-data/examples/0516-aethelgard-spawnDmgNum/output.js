function spawnDmgNum(dmg,worldPos,color='#c8c880',cls=''){
  const div=document.createElement('div');
  div.className='dmg-num'+cls;
  div.style.color=color;
  const v=worldPos.clone().project(camera);
  div.style.left=((v.x*0.5+0.5)*innerWidth+(Math.random()-0.5)*25)+'px';
  div.style.top=((-v.y*0.5+0.5)*innerHeight)+'px';
  div.textContent=typeof dmg==='string'?dmg:Math.round(dmg);
  document.getElementById('damage-numbers').appendChild(div);
  setTimeout(()=>div.remove(),900);
}