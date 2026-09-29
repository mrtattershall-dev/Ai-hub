function addMsg(role,text){
  const c=document.getElementById('chatMessages'),d=document.createElement('div');
  d.className='chatmsg';
  d.innerHTML=`<div class="avatar ${role}">${role==='ai'?'🤖':'👤'}</div><div class="bubble ${role}">${text}</div>`;
  c.appendChild(d); c.scrollTop=c.scrollHeight;
}