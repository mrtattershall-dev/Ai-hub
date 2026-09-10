function branchHintText(outcome, isGood) {
  // Visual/audio cues — geologist's eye makes them more accurate
  const misleadRate = player._geologistEye ? 0.15 : 0.40;
  // The hint is correct (misleadRate)% of the time it's wrong
  const richHints  = ['glints with a metallic sheen', 'rings with a clear tone when tapped', 'shows dense crystal inclusions'];
  const safeHints  = ['looks solid and workable', 'has clean straight fractures', 'smells of iron — standard ore'];
  const hollowHints= ['sounds hollow when tapped', 'has a dusty, dry texture', 'crumbles at the edges'];
  const gasHints   = ['has a faint sulfur smell', 'looks discolored around the edges', 'feels warm to the touch'];
  // Apply mislead chance
  const lied = Math.random() < misleadRate;
  if (!lied) {
    // Correct hint
    if (outcome === 'richVein' || outcome === 'gemCache') return richHints[Math.floor(Math.random()*richHints.length)];
    if (outcome === 'hollow' || outcome === 'collapse') return hollowHints[Math.floor(Math.random()*hollowHints.length)];
    if (outcome === 'gasPocket') return gasHints[Math.floor(Math.random()*gasHints.length)];
    if (outcome === 'fossil') return 'has unusual bone-like striations in the rock';
    return safeHints[Math.floor(Math.random()*safeHints.length)];
  } else {
    // Misleading hint — point opposite
    if (outcome === 'richVein') return hollowHints[Math.floor(Math.random()*hollowHints.length)];
    if (outcome === 'hollow') return richHints[Math.floor(Math.random()*richHints.length)];
    return safeHints[Math.floor(Math.random()*safeHints.length)];
  }
}