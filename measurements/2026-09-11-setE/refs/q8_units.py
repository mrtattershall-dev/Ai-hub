# Reference solution (final state of chain q8) - used only to prove checks-E.mjs can pass.
import sys

MASS = {"g": 1.0, "kg": 1000.0, "oz": 28.349523125, "lb": 16 * 28.349523125}
TSP = 4.92892159375
VOL = {"ml": 1.0, "l": 1000.0, "tsp": TSP, "tbsp": 3 * TSP, "cup": 48 * TSP}
TEMP = ("C", "F", "K")
ALIASES = {
    "g": "g", "gram": "g", "grams": "g", "kg": "kg", "kilogram": "kg", "kilograms": "kg",
    "oz": "oz", "ounce": "oz", "ounces": "oz", "lb": "lb", "lbs": "lb", "pound": "lb", "pounds": "lb",
    "ml": "ml", "milliliter": "ml", "milliliters": "ml", "millilitre": "ml", "millilitres": "ml",
    "l": "l", "liter": "l", "liters": "l", "litre": "l", "litres": "l",
    "tsp": "tsp", "teaspoon": "tsp", "teaspoons": "tsp", "tbsp": "tbsp", "tablespoon": "tbsp", "tablespoons": "tbsp",
    "cup": "cup", "cups": "cup",
}
FRACS = [(0.0, ""), (0.25, "1/4"), (1 / 3, "1/3"), (0.5, "1/2"), (2 / 3, "2/3"), (0.75, "3/4"), (1.0, "")]


def _kind(u):
    if u in MASS:
        return "mass"
    if u in VOL:
        return "volume"
    if u in TEMP:
        return "temp"
    raise ValueError(f"unknown unit: {u!r}")


def _to_c(v, u):
    return v if u == "C" else (v - 32) * 5 / 9 if u == "F" else v - 273.15


def _from_c(c, u):
    return c if u == "C" else c * 9 / 5 + 32 if u == "F" else c + 273.15


def convert(value, from_unit, to_unit, density=None):
    a, b = _kind(from_unit), _kind(to_unit)
    if a == "temp" or b == "temp":
        if a != b:
            raise ValueError("cannot convert between a temperature and something else")
        return _from_c(_to_c(value, from_unit), to_unit)
    if a == b:
        table = MASS if a == "mass" else VOL
        return value * table[from_unit] / table[to_unit]
    if density is None:
        raise ValueError("converting between mass and volume needs a density")
    if a == "mass":
        return value * MASS[from_unit] / density / VOL[to_unit]
    return value * VOL[from_unit] * density / MASS[to_unit]


def _number(tok):
    if "/" in tok:
        a, b = tok.split("/", 1)
        return int(a) / int(b)
    return float(tok)


def parse_quantity(text):
    parts = str(text).strip().split()
    if len(parts) not in (2, 3):
        raise ValueError(f"cannot parse {text!r}")
    unit = ALIASES.get(parts[-1].lower())
    if unit is None:
        raise ValueError(f"unknown unit in {text!r}")
    try:
        qty = sum(_number(p) for p in parts[:-1])
    except (ValueError, ZeroDivisionError):
        raise ValueError(f"cannot parse {text!r}")
    return (qty, unit)


def scale_recipe(recipe, factor):
    return [(qty * factor, unit, name) for qty, unit, name in recipe]


def format_quantity(qty, unit):
    whole = int(qty // 1)
    frac = qty - whole
    for f, s in FRACS:
        if abs(frac - f) <= 0.01:
            w = whole + (1 if f == 1.0 else 0)
            text = f"{w} {s}" if (w and s) else (s or f"{w}")
            return f"{text} {unit}"
    return f"{('%.2f' % qty).rstrip('0').rstrip('.')} {unit}"


def to_metric(recipe):
    out = []
    for qty, unit, name in recipe:
        try:
            k = _kind(unit)
        except ValueError:
            k = None
        if k == "mass":
            out.append((round(convert(qty, unit, "g"), 1), "g", name))
        elif k == "volume":
            out.append((round(convert(qty, unit, "ml"), 1), "ml", name))
        else:
            out.append((qty, unit, name))
    return out


def shopping_list(recipes):
    lines = []
    for recipe in recipes:
        for qty, unit, name in recipe:
            found = False
            for line in lines:
                if line[2] != name:
                    continue
                if line[1] == unit:
                    line[0] += qty
                    found = True
                    break
                try:
                    line[0] += convert(qty, unit, line[1])
                    found = True
                    break
                except ValueError:
                    continue
            if not found:
                lines.append([qty, unit, name])
    return [tuple(l) for l in sorted(lines, key=lambda l: l[2])]


def main(argv):
    value, frm, to = argv
    print(f"{convert(float(value), frm, to):.2f} {to}")


if __name__ == "__main__":
    if len(sys.argv) == 4:
        main(sys.argv[1:])
