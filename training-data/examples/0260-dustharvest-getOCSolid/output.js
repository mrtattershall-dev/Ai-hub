function getOCSolid(x,y) {
  const t = getOCT(x,y);
  if (t===OC.WALL||t===OC.ROCK||t===OC.POST||t===OC.CRATE) return true;
  // Deep ocean — passable only when player is on the boat
  if (t===OC.DEEP) return !(player && player._onBoat);
  // Boat deck / gangplank — boat deck only solid if player doesn't own a boat
  if (t===OC.BOAT_HULL) return true;
  if (t===OC.BOAT_DECK) return !hasBoat();
  if (t===OC.GANGPLANK) return false; // always walkable — player needs to reach it to board
  return false;
}