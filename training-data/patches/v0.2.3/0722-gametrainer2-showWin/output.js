function showWin(){
  const l=LESSONS[app.cur];
  if (!app.done.has(app.cur)){ app.xp+=l.xp; app.done.add(app.cur); updateXP(); updateProgress(); }
  document.getElementById('winMsg').textContent=`+${l.xp} XP — ${l.concept.title} mastered.`;
  document.getElementById('winOverlay').classList.remove('hidden');
}