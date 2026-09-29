function showStatusTag(msg, col='#c85a10'){
  const el=document.getElementById('status-tags');
  const tag=document.createElement('div');
  tag.className='status-tag'; tag.style.color=col; tag.style.borderColor=col+'55';
  tag.textContent=msg; el.appendChild(tag);
  setTimeout(()=>{ tag.style.transition='opacity 0.5s'; tag.style.opacity='0'; setTimeout(()=>tag.remove(),500); },2500);
}