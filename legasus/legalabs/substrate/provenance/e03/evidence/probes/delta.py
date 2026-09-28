import cart
c = cart.Cart()
assert c.gift_count() == 0, c.gift_count()
c.add_gift("mug"); c.add_gift("pen")
assert c.gift_count() == 2, c.gift_count()
c.add_item("x"); c.add_coupon("SAVE")
assert c.gift_count() == 2, "the lists must stay separate"
assert c.item_count() == 1 and c.coupon_count() == 1
print("OK")
