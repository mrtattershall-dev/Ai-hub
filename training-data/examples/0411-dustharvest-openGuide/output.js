function openGuide() {
  guideOpen = true;
  document.getElementById('guideOverlay').classList.add('open');
  if (!_guideCoverDrawn) { _drawGuideCover(); _guideCoverDrawn = true; }
  // Update player-name references in the guide
  const n = player.name || 'Stranger';
  const storyBtn = document.getElementById('gtab-story');
  if (storyBtn) storyBtn.textContent = n;
  const storyTitle = document.getElementById('guide-story-title');
  if (storyTitle) storyTitle.textContent = `Who is ${n}?`;
  const storyDesc = document.getElementById('guide-story-desc');
  if (storyDesc) storyDesc.innerHTML = `${n} came to the frontier the same way most people did — <b>a deed, a loan, and an idea that hard work would settle the rest.</b> The bank holds the mortgage. Weekly payments start at $500 and climb $200 each week. Miss too many and the land goes back to whoever holds the paper.`;
}