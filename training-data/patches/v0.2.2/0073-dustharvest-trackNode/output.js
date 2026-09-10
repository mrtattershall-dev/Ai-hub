function trackNode(nodeType, qty) {
  stats.nodesByType[nodeType] = (stats.nodesByType[nodeType] || 0) + qty;
  if (nodeType === 'wood' || nodeType === 'deadwood' || nodeType === 'charredWood') stats.woodChopped += qty;
  else if (nodeType === 'stone' || nodeType === 'skullrock' || nodeType === 'stoneShard') stats.stoneGathered += qty;
  else if (nodeType === 'herb' || nodeType === 'tumbleweed' || nodeType === 'driedHerb') stats.herbsGathered += qty;
}