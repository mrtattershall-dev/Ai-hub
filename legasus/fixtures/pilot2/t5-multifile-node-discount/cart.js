const { round2 } = require('./pricing');
function cartTotal(items, percent) {
  return round2(items.reduce((a, i) => a + i.price * i.qty, 0) * (1 - percent / 100));
}
module.exports = { cartTotal };
