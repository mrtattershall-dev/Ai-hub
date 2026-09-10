function registerZone(def) {
  if (ZONES[def.id]) {
    console.warn(`[zones] duplicate zone id: ${def.id}`);
    return;
  }
  ZONES[def.id] = Object.assign({
    mapData:  null,
    enemies:  [],
    music:    null,
    connects: {},
  }, def);
  if (DEBUG) console.log(`[zones] registered: ${def.id}`);
}