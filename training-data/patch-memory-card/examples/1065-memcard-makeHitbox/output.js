export function makeHitbox(owner, def) {
  const cx = owner.x + owner.w / 2;
  const cy = owner.y + owner.h / 2 + (def.yOffset ?? 0);
  const w = def.width;
  const h = def.height;
  // Place the box on the facing side, slightly overlapping the body.
  const x = owner.facing >= 0 ? cx - 4 : cx - w + 4;
  return {
    x,
    y: cy - h / 2,
    w,
    h,
    damage: def.damage,
    knockback: def.knockback,
    launch: def.launch ?? 0,
    type: def.type ?? "light",
    facing: owner.facing,
    _hit: new Set(), // targets already struck by this instance
  };
}