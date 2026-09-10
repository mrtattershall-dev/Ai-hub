function _revealRuinsArea(tx, ty, radius) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx*dx+dy*dy > radius*radius) continue;
      const nx = tx+dx, ny = ty+dy;
      if (nx>=0 && nx<RU_W && ny>=0 && ny<RU_H) exploredRuins[ny*RU_W+nx] = 2;
    }
  }
}