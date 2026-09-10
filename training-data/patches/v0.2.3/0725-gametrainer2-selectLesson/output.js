function selectLesson(i){
  app.cur=i; buildSidebar(); buildConcept();
  document.getElementById('startOverlay').classList.remove('hidden');
  document.getElementById('winOverlay').classList.add('hidden');
  document.getElementById('olTitle').textContent='🎮 '+LESSONS[i].title;
  document.getElementById('olDesc').textContent=LESSONS[i].concept.desc;
  if (animId) cancelAnimationFrame(animId);
}