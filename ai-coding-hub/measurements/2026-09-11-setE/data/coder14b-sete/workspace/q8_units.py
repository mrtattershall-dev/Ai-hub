def convert(value, from_unit, to_unit, density=None):
    # Conversion factors
    conversion_factors = {
        'g': 1,
        'kg': 1000,
        'oz': 28.349523125,
        'lb': 28.349523125 * 16,
        'C': 1,
        'F': 1,
        'K': 1
    }
    
    # Check if units are valid
    if from_unit not in conversion_factors or to_unit not in conversion_factors:
        raise ValueError("Unknown unit")

    # Check if density is provided for mass-volume conversion
    if density is not None:
        if from_unit in ['g', 'kg', 'oz', 'lb'] and to_unit in ['ml', 'l']:
            value_in_grams = value * conversion_factors[from_unit]
            converted_value = value_in_grams / density
            return converted_value
        elif from_unit in ['ml', 'l'] and to_unit in ['g', 'kg', 'oz', 'lb']:
            value_in_grams = value * density
            converted_value = value_in_grams / conversion_factors[to_unit]
            return converted_value
        else:
            raise ValueError("Density conversion only between mass and volume")
    else:
        raise ValueError("Density must be provided for mass-volume conversion")

    # Check if density is provided for mass-volume conversion
    if density is not None:
        if from_unit in ['g', 'kg', 'oz', 'lb'] and to_unit in ['ml', 'l']:
            value_in_grams = value * conversion_factors[from_unit]
            converted_value = value_in_grams / density
            return converted_value
        elif from_unit in ['ml', 'l'] and to_unit in ['g', 'kg', 'oz', 'lb']:
            value_in_grams = value * density
            converted_value = value_in_grams / conversion_factors[to_unit]
            return converted_value
        else:
            raise ValueError("Density conversion only between mass and volume")

    # Check if density is provided for mass-volume conversion
    if density is not None:
        if from_unit in ['g', 'kg', 'oz', 'lb'] and to_unit in ['ml', 'l']:
            value_in_grams = value * conversion_factors[from_unit]
            converted_value = value_in_grams / density
            return converted_value
        elif from_unit in ['ml', 'l'] and to_unit in ['g', 'kg', 'oz', 'lb']:
            value_in_grams = value * density
            converted_value = value_in_grams / conversion_factors[to_unit]
            return converted_value
        else:
            raise ValueError("Density conversion only between mass and volume")

    # Check if density is provided for mass-volume conversion
    if density is not None:
        if from_unit in ['g', 'kg', 'oz', 'lb'] and to_unit in ['ml', 'l']:
            value_in_grams = value * conversion_factors[from_unit]
            converted_value = value_in_grams / density
            return converted_value
        elif from_unit in ['ml', 'l'] and to_unit in ['g', 'kg', 'oz', 'lb']:
            value_in_grams = value * density
            converted_value = value_in_grams / conversion_factors[to_unit]
            return converted_value
        else:
            raise ValueError("Density conversion only between mass and volume")
    
    # Check if conversion is between temperatures
    if from_unit in ['C', 'F', 'K'] and to_unit in ['C', 'F', 'K']:
        if from_unit == to_unit:
            return value
        elif from_unit == 'C':
            if to_unit == 'F':
                return (value * 9/5) + 32
            elif to_unit == 'K':
                return value + 273.15
        elif from_unit == 'F':
            if to_unit == 'C':
                return (value - 32) * 5/9
            elif to_unit == 'K':
                return (value - 32) * 5/9 + 273.15
        elif from_unit == 'K':
            if to_unit == 'C':
                return value - 273.15
            elif to_unit == 'F':
                return (value - 273.15) * 9/5 + 32
    else:
        raise ValueError("Temperature conversion only")
    
    # Convert value
    value_in_grams = value * conversion_factors[from_unit]
    converted_value = value_in_grams / conversion_factors[to_unit]
    
    return converted_value

if __name__ == "__main__":
    # Test cases
    assert convert(100, 'g', 'kg') == 0.1
    assert convert(1, 'kg', 'g') == 1000
    assert convert(1, 'oz', 'g') == 28.349523125
    assert convert(1, 'lb', 'g') == 453.59237
    assert convert(16, 'oz', 'lb') == 1
    assert convert(1, 'lb', 'oz') == 16
    print("All tests passed")
def parse_quantity(text):
    import re
    from fractions import Fraction

    # Define unit mappings
    units = {
        'kg': 'kilograms', 'kilogram': 'kilograms',
        'g': 'grams', 'gram': 'grams',
        'l': 'liters', 'liter': 'liters', 'litre': 'liters',
        'ml': 'milliliters', 'milliliter': 'milliliters',
        'cup': 'cups', 'cups': 'cups',
        'tablespoon': 'tablespoons', 'tablespoons': 'tablespoons',
        'teaspoon': 'teaspoons', 'teaspoons': 'teaspoons',
        'ounce': 'ounces', 'ounces': 'ounces',
        'pound': 'pounds', 'pounds': 'pounds'
    }

    # Regular expression to match the quantity
    pattern = re.compile(r'(\d+/\d+|\d+(\.\d+)?)\s*(\w+)')
    match = pattern.match(text.strip())

    if not match:
        raise ValueError(f"Unsupported quantity format: {text}")

    # Extract the number and unit
    number_str, _, unit = match.groups()
    number = Fraction(number_str)

    # Normalize the unit
    unit = unit.lower()
    if unit in units:
        unit = units[unit]
    else:
        raise ValueError(f"Unsupported unit: {unit}")

    return (float(number), unit)
def scale_recipe(recipe, factor):
    return [(qty * factor, unit, name) for qty, unit, name in recipe]
from fractions import Fraction

def format_quantity(qty, unit):
    # Check if the quantity is within 0.01 of a whole number plus a half, third, or quarter
    if abs(qty - round(qty)) < 0.01:
        return f"{int(round(qty))} {unit}"
    elif abs(qty - round(qty * 2) / 2) < 0.01:
        return f"{int(round(qty * 2) / 2)} 1/2 {unit}"
    elif abs(qty - round(qty * 3) / 3) < 0.01:
        return f"{int(round(qty * 3) / 3)} 1/3 {unit}"
    elif abs(qty - round(qty * 4) / 4) < 0.01:
        return f"{int(round(qty * 4) / 4)} 1/4 {unit}"
    else:
        # Format with at most 2 decimals and no trailing zeros
        return f"{qty:.2f} {unit}".rstrip('0').rstrip('.')
def to_metric(recipe):
    metric_recipe = []
    for qty, unit, name in recipe:
        if unit in ['kg', 'g', 'oz', 'lb']:
            # Convert mass to grams
            converted_qty = convert(qty, unit, 'g')
        elif unit in ['l', 'ml', 'cup', 'tablespoon', 'teaspoon']:
            # Convert volume to milliliters
            converted_qty = convert(qty, unit, 'ml')
        else:
            # Leave other units unchanged
            converted_qty = qty
        metric_recipe.append((round(converted_qty, 1), unit, name))
    return metric_recipe
def shopping_list(recipes):
    from collections import defaultdict

    # Dictionary to store aggregated items
    aggregated_items = defaultdict(list)

    for recipe in recipes:
        for item in recipe:
            qty, unit, name = item
            if name not in aggregated_items:
                aggregated_items[name].append((qty, unit))
            else:
                # Find the first occurrence's unit
                first_unit = aggregated_items[name][0][1]
                # Convert the current item's quantity to the first occurrence's unit
                converted_qty = convert(qty, unit, first_unit)
                aggregated_items[name].append((converted_qty, first_unit))

    # Combine quantities of items with the same name
    combined_items = []
    for name, items in aggregated_items.items():
        total_qty = sum(item[0] for item in items)
        combined_items.append((total_qty, items[0][1], name))

    # Sort the combined items by name
    combined_items.sort(key=lambda x: x[2])

    return combined_items
