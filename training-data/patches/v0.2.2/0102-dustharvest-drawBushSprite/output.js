function drawBushSprite(sx, sy, tx, ty) {
  const s = tx * 7 + ty * 13;
  const v = s % 4; // 4 fern variants

  // All variants: low ground-cover fern, no pot, no trunk
  // Fronds spread wide from center base, max height ~16px from bottom

  // Center soil hint
  ctx.fillStyle='rgba(40,25,10,.3)'; ctx.fillRect(sx+T/2-4,sy+T-8,8,5);

  if(v===0) {
    // Classic fern — arching fronds left and right
    // Left frond arch
    ctx.fillStyle='#2a5c18';
    ctx.fillRect(sx+T/2-10,sy+T-16,3,2); ctx.fillRect(sx+T/2-12,sy+T-14,2,2);
    ctx.fillRect(sx+T/2-11,sy+T-12,3,2); ctx.fillRect(sx+T/2-9,sy+T-10,2,2);
    ctx.fillStyle='#3a7820';
    ctx.fillRect(sx+T/2-9,sy+T-17,2,2); ctx.fillRect(sx+T/2-11,sy+T-15,2,2);
    ctx.fillRect(sx+T/2-10,sy+T-13,2,2); ctx.fillRect(sx+T/2-8,sy+T-11,2,2);
    // Right frond arch
    ctx.fillStyle='#2a5c18';
    ctx.fillRect(sx+T/2+7,sy+T-16,3,2); ctx.fillRect(sx+T/2+10,sy+T-14,2,2);
    ctx.fillRect(sx+T/2+8,sy+T-12,3,2); ctx.fillRect(sx+T/2+6,sy+T-10,2,2);
    ctx.fillStyle='#3a7820';
    ctx.fillRect(sx+T/2+7,sy+T-17,2,2); ctx.fillRect(sx+T/2+9,sy+T-15,2,2);
    ctx.fillRect(sx+T/2+7,sy+T-13,2,2); ctx.fillRect(sx+T/2+5,sy+T-11,2,2);
    // Center upright frond
    ctx.fillStyle='#348022';
    ctx.fillRect(sx+T/2-2,sy+T-20,4,2); ctx.fillRect(sx+T/2-2,sy+T-18,4,2);
    ctx.fillRect(sx+T/2-1,sy+T-16,3,2); ctx.fillRect(sx+T/2-1,sy+T-14,2,3);
    // Pinnules on center frond
    ctx.fillStyle='#4a9a28';
    ctx.fillRect(sx+T/2-4,sy+T-19,3,1); ctx.fillRect(sx+T/2+2,sy+T-19,3,1);
    ctx.fillRect(sx+T/2-4,sy+T-17,3,1); ctx.fillRect(sx+T/2+2,sy+T-17,3,1);
    ctx.fillRect(sx+T/2-3,sy+T-15,2,1); ctx.fillRect(sx+T/2+2,sy+T-15,2,1);

  } else if(v===1) {
    // Spreading ground fern — low wide fronds
    ctx.fillStyle='#286018';
    // Far left droop
    ctx.fillRect(sx+2,sy+T-11,3,2); ctx.fillRect(sx+4,sy+T-13,3,2);
    ctx.fillRect(sx+6,sy+T-15,3,2); ctx.fillRect(sx+8,sy+T-16,3,2);
    // Far right droop
    ctx.fillRect(sx+T-5,sy+T-11,3,2); ctx.fillRect(sx+T-7,sy+T-13,3,2);
    ctx.fillRect(sx+T-9,sy+T-15,3,2); ctx.fillRect(sx+T-11,sy+T-16,3,2);
    ctx.fillStyle='#3a7a20';
    // Pinnules on left
    ctx.fillRect(sx+3,sy+T-12,2,1); ctx.fillRect(sx+5,sy+T-14,2,1);
    ctx.fillRect(sx+7,sy+T-16,2,1); ctx.fillRect(sx+9,sy+T-17,2,1);
    // Pinnules on right
    ctx.fillRect(sx+T-5,sy+T-12,2,1); ctx.fillRect(sx+T-7,sy+T-14,2,1);
    ctx.fillRect(sx+T-9,sy+T-16,2,1); ctx.fillRect(sx+T-11,sy+T-17,2,1);
    // Center cluster
    ctx.fillStyle='#348a22';
    ctx.fillRect(sx+T/2-3,sy+T-18,6,3); ctx.fillRect(sx+T/2-4,sy+T-15,8,2);
    ctx.fillRect(sx+T/2-5,sy+T-13,10,2); ctx.fillRect(sx+T/2-3,sy+T-11,6,2);
    ctx.fillStyle='#4aaa28';
    ctx.fillRect(sx+T/2-2,sy+T-19,4,1); ctx.fillRect(sx+T/2-5,sy+T-16,3,1);
    ctx.fillRect(sx+T/2+3,sy+T-16,3,1);

  } else if(v===2) {
    // Fiddle-head fern — tightly coiled young fronds
    ctx.fillStyle='#2a6418';
    // Three fronds at different heights
    // Left frond — curled tip
    ctx.fillRect(sx+T/2-9,sy+T-14,3,3); ctx.fillRect(sx+T/2-8,sy+T-17,2,3);
    ctx.fillRect(sx+T/2-7,sy+T-19,3,2); ctx.fillRect(sx+T/2-5,sy+T-20,3,2);
    ctx.fillStyle='#3c8022';
    ctx.fillRect(sx+T/2-9,sy+T-15,2,1); ctx.fillRect(sx+T/2-7,sy+T-18,2,1);
    ctx.fillRect(sx+T/2-5,sy+T-20,2,1);
    // Right frond
    ctx.fillStyle='#286018';
    ctx.fillRect(sx+T/2+6,sy+T-14,3,3); ctx.fillRect(sx+T/2+5,sy+T-17,2,3);
    ctx.fillRect(sx+T/2+4,sy+T-19,3,2); ctx.fillRect(sx+T/2+2,sy+T-20,3,2);
    ctx.fillStyle='#3c8022';
    ctx.fillRect(sx+T/2+7,sy+T-15,2,1); ctx.fillRect(sx+T/2+5,sy+T-18,2,1);
    ctx.fillRect(sx+T/2+3,sy+T-20,2,1);
    // Center short frond
    ctx.fillStyle='#348a22';
    ctx.fillRect(sx+T/2-2,sy+T-21,4,5); ctx.fillRect(sx+T/2-3,sy+T-16,6,3);
    ctx.fillRect(sx+T/2-4,sy+T-13,8,2);
    ctx.fillStyle='#50a830';
    ctx.fillRect(sx+T/2-1,sy+T-22,2,2); // bright fiddle tip
    ctx.fillRect(sx+T/2-4,sy+T-17,3,1); ctx.fillRect(sx+T/2+2,sy+T-17,3,1);

  } else {
    // Broad-leaf fern — wide flat leaves
    ctx.fillStyle='#246018';
    // Left large leaf
    ctx.fillRect(sx+2,sy+T-14,5,3); ctx.fillRect(sx+4,sy+T-17,5,3);
    ctx.fillRect(sx+7,sy+T-19,4,3); ctx.fillRect(sx+9,sy+T-18,4,2);
    // Right large leaf
    ctx.fillRect(sx+T-7,sy+T-14,5,3); ctx.fillRect(sx+T-9,sy+T-17,5,3);
    ctx.fillRect(sx+T-11,sy+T-19,4,3); ctx.fillRect(sx+T-13,sy+T-18,4,2);
    ctx.fillStyle='#38801e';
    // Leaf highlights (midrib)
    ctx.fillRect(sx+3,sy+T-14,1,3); ctx.fillRect(sx+5,sy+T-17,1,3); ctx.fillRect(sx+8,sy+T-19,1,3);
    ctx.fillRect(sx+T-4,sy+T-14,1,3); ctx.fillRect(sx+T-6,sy+T-17,1,3); ctx.fillRect(sx+T-9,sy+T-19,1,3);
    // Small center sprout
    ctx.fillStyle='#3c8a22';
    ctx.fillRect(sx+T/2-3,sy+T-17,6,2); ctx.fillRect(sx+T/2-2,sy+T-19,4,2);
    ctx.fillRect(sx+T/2-1,sy+T-21,3,2);
    ctx.fillStyle='#52a828';
    ctx.fillRect(sx+T/2-3,sy+T-18,2,1); ctx.fillRect(sx+T/2+2,sy+T-18,2,1);
    ctx.fillRect(sx+T/2-2,sy+T-20,2,1); ctx.fillRect(sx+T/2+1,sy+T-20,2,1);
  }
}