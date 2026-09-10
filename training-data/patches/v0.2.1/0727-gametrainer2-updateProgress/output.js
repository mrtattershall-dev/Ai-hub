function updateProgress(){
  document.getElementById('scoreRows').innerHTML=LESSONS.map((l,i)=>`
    <div class="srow"><span class="sk">${l.title}</span>
    <span class="sv" style="color:${app.done.has(i)?'var(--green)':'var(--muted)'}">${app.done.has(i)?'+'+l.xp+' XP':'—'}</span></div>`).join('');
  document.getElementById('conceptTags').innerHTML=[...app.done].map(i=>`<span class="ltag ${LESSONS[i].tc}">${LESSONS[i].tag}</span>`).join('')||'<span style="color:var(--muted);font-size:12px">Complete lessons to unlock</span>';
}