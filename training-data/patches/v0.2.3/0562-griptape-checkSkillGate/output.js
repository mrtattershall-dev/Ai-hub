function checkSkillGate(gestureKey) {
  const req = trickRequirements[gestureKey] ?? 0;
  if (player.skate < req) {
    const g = flickGestures[gestureKey];
    const el=elSkillGate;
    el.textContent = (g ? g.name : gestureKey).toUpperCase() + ' — REQUIRES SKATE ' + req;
    el.style.opacity = '1';
    clearTimeout(skillGateTimeout);
    skillGateTimeout = setTimeout(() => { el.style.opacity = '0'; }, 1400);
    return false; // blocked
  }
  return true; // allowed
}