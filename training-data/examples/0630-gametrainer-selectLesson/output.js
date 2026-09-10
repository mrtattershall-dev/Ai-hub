function selectLesson(i) {
  app.currentLesson = i;
  buildSidebar();
  buildConceptPanel();
  document.getElementById('startOverlay').classList.remove('hidden');
  document.getElementById('winOverlay').classList.add('hidden');
  const lesson = LESSONS[i];
  document.getElementById('startOverlay').querySelector('h2').textContent = '🎮 ' + lesson.title;
  document.getElementById('startOverlay').querySelector('p').textContent = lesson.concept.desc;
  if (animId) cancelAnimationFrame(animId);
}