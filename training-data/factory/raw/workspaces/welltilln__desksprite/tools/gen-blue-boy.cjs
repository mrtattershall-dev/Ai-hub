// Generate skins/blue-boy.json from the legacy render model (run once / on change).
// Run: node tools/gen-blue-boy.cjs
const fs = require('fs'), path = require('path');
const { legacyGrid, gridToFrame, PALETTE } = require('./blue-boy-legacy.cjs');

const skin = {
  name: 'blue-boy',
  author: 'welltilln',
  palette: PALETTE,
  size: { w: 14, h: 14 },
  anchor: { x: 7, y: 14 },
  frames: {
    idle: gridToFrame(legacyGrid('idle')),
    walk: [gridToFrame(legacyGrid('walk0')), gridToFrame(legacyGrid('walk1'))],
    held: gridToFrame(legacyGrid('held')),
    carry: gridToFrame(legacyGrid('carry')),   // clipboard overlay drawn while "working"
  },
};
fs.writeFileSync(path.join(__dirname, '../skins/blue-boy.json'), JSON.stringify(skin, null, 2) + '\n');
console.log('wrote skins/blue-boy.json');
