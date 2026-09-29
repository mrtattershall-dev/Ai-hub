function addThinking(){
  const c=document.getElementById('chatMessages'),d=document.createElement('div');
  d.className='chatmsg'; d.id='thinking';
  d.innerHTML=`<div class="avatar ai">🤖</div><div class="bubble ai"><div class="thinking"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
  c.appendChild(d); c.scrollTop=c.scrollHeight;
}