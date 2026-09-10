function showWin() {
  const lesson = LESSONS[app.currentLesson];
  if (!app.completedLessons.has(app.currentLesson)) {
    app.xp += lesson.xp;
    app.completedLessons.add(app.currentLesson);
    updateXP();
    updateProgress();
  }
  document.getElementById('winMsg').textContent = `+${lesson.xp} XP — ${lesson.concept.title} mastered.`;
  document.getElementById('winOverlay').classList.remove('hidden');
}