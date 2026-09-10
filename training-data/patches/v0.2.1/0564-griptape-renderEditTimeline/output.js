function renderEditTimeline() {
  const tl = document.getElementById('edit-timeline');
  // Remove old clips
  [...tl.querySelectorAll('.edit-clip')].forEach(c => c.remove());
  const W = tl.offsetWidth || 580;
  const perClip = Math.min(100, Math.floor(W / Math.max(1, editState.clips.length)) - 4);
  editState.clips.forEach((clip, i) => {
    const el = document.createElement('div');
    el.className = 'edit-clip' + (clip.beatSync ? ' beat' : '');
    el.style.left  = (i * (perClip + 4) + 2) + 'px';
    el.style.width = perClip + 'px';
    el.textContent = clip.name.slice(0,8);
    el.title = clip.name + ' (' + clip.pts + 'pts)';
    el.addEventListener('click', () => {
      clip.beatSync = !clip.beatSync;
      el.classList.toggle('beat', clip.beatSync);
      recalcMultiplier();
    });
    tl.appendChild(el);
  });
  recalcMultiplier();
}