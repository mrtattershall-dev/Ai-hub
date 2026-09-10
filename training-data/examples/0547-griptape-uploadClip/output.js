function uploadClip() {
  if (!player.pendingUpload) return;
  player.pendingUpload=false; sgBtn.disabled=true; sgBtn.textContent='[ UPLOADING... ]';
  const gain=Math.floor(player.clipScore/30);
  const comments=clipComments[faction]||clipComments.gutter;
  followers+=gain; player.clout=Math.min(100,player.clout+gain*0.5);
  sgFollEl.textContent=followers+' followers';
  const post=document.createElement('div'); post.className='sg-post new';
  post.textContent='+'+gain+' followers — "'+comments[Math.floor(Math.random()*comments.length)]+'"';
  sgFeed.prepend(post);
  if (sgFeed.children.length>4) sgFeed.removeChild(sgFeed.lastChild);
  player.clipScore=0; toast('+'+gain+' followers on SkateGram','success');
  setTimeout(()=>{ sgBtn.textContent='[ UPLOAD CLIP — SKATE FIRST ]'; },2000);
}