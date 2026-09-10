function buildSidebar(){
  const el=document.getElementById('lessonList'); el.innerHTML='';
  LESSONS.forEach((l,i)=>{
    const d=document.createElement('div');
    d.className='lcard'+(i===app.cur?' active':'')+(app.done.has(i)?' done':'');
    d.innerHTML=`<div class="lnum">MODULE ${String(i+1).padStart(2,'0')}</div><div class="ltitle">${l.title}</div><span class="ltag ${l.tc}">${l.tag}</span>`;
    d.onclick=()=>selectLesson(i);
    el.appendChild(d);
  });
}