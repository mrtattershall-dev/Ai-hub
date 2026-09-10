export function resolveHits(hitbox, targets) {
  const hits = [];
  for (const target of targets) {
    if (!target.alive || hitbox._hit.has(target)) continue;
    if (!aabb(hitbox, target)) continue;
    hitbox._hit.add(target);
    const knockX = hitbox.facing * hitbox.knockback;
    const damaged = target.hurt(hitbox.damage, knockX, hitbox.launch, hitbox.type);
    // A target may return false to signal "blocked / no damage" (still consumed).
    if (damaged !== false) hits.push(target);
  }
  return hits;
}