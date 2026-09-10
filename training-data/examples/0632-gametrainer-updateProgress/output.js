function updateProgress() {
  const rows = LESSONS.map(l => `
    <div class="score-row">
      <span class="score-key">${l.title}</span>
      <span class="score-val" style="color:${app.completedLessons.has(LESSONS.indexOf(l)) ? 'var(--green)' : 'var(--muted)'}">
        ${app.completedLessons.has(LESSONS.indexOf(l)) ? '+' + l.xp + ' XP' : '—'}
      </span>
    </div>`).join('');
  document.getElementById('scoreRows').innerHTML = rows;
  const tags = [...app.completedLessons].map(i => `<span class="lesson-tag ${LESSONS[i].tagClass}">${LESSONS[i].tag}</span>`).join('');
  document.getElementById('conceptsLearned').innerHTML = tags || '<span style="color:var(--muted);font-size:12px">Complete lessons to earn concepts</span>';
}