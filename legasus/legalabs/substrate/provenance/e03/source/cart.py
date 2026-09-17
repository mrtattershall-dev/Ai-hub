class Cart:
    def __init__(self):
        self._items = []
        self._coupons = []

    def add_item(self, sku):
        self._items.append(sku)

    def item_count(self):
        return len(self._items)

    def add_coupon(self, code):
        self._coupons.append(code)

    def coupon_count(self):
        return len(self._coupons)
