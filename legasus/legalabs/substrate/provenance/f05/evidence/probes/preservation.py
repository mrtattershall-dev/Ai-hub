import colors
assert colors.to_rgb("#ff0000") == (255, 0, 0), colors.to_rgb("#ff0000")
assert colors.luminance((255, 255, 255)) == 255.0, colors.luminance((255, 255, 255))
assert colors.is_dark("#000000")
assert not colors.is_dark("#ffffff")
print("OK")
