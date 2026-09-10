function getBaitBonus() {
  // Returns weight boost for specific fish based on equipped bait
  const b = _fish.baitId;
  if (!b) return null;
  const BAIT_MAP = {
    corn:       { ids:['catfish','bassfish','snapperTurtle'], mult:2.2 },
    potato:     { ids:['perch','commonFish'], mult:1.8 },
    blueberry:  { ids:['sunfish','goldenfish'], mult:2.5 },
    glowroot:   { ids:['goldenfish','snapperTurtle'], mult:3.0 },
    carrot:     { ids:['commonFish','perch','catfish'], mult:1.6 },
    worm:       { ids:['catfish','bassfish','perch','mudcat'], mult:2.0 },
  };
  return BAIT_MAP[b] || null;
}