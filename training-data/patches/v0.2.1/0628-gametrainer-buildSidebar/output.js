function buildSidebar() {
  const list = document.getElementById('lessonList');
  list.innerHTML = '';
  LESSONS.forEach((l, i) => {
    const div = document.createElement('div');
    div.className = 'lesson-card' + (i === app.currentLesson ? ' active' : '') + (app.completedLessons.has(i) ? ' done' : '');
    div.innerHTML = `<div class="lesson-num">MODULE ${String(i+1).padStart(2,'0')}</div>
      <div class="lesson-title">${l.title}</div>
      <span class="lesson-tag ${l.tagClass}">${l.tag}</span>`;
    div.onclick = () => selectLesson(i);
    list.appendChild(div);
  });
}