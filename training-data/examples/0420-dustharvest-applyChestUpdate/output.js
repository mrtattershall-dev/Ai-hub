function applyChestUpdate(msg) {
  const incoming = msg.slots || [];
  for (let i = 0; i < chestSlots.length; i++) {
    chestSlots[i] = incoming[i] || null;
  }
  // Call _origRefreshChestUI directly — NOT the wrapped version.
  // The wrapper calls broadcastChest(), which would echo the message back
  // to the sender and create an infinite broadcast loop.
  if (chestOpen) _origRefreshChestUI();
}