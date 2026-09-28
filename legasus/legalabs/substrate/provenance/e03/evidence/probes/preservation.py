import cart
c = cart.Cart()
c.add_item("x"); c.add_item("y")
assert c.item_count() == 2, c.item_count()
c.add_coupon("SAVE")
assert c.coupon_count() == 1, c.coupon_count()
print("OK")
