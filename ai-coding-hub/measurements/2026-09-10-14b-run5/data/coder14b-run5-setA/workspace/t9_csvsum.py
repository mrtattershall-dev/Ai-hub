def sum_column(text, name):
    lines = text.strip().split('\n')
    if len(lines) < 2:
        raise ValueError('csv must have a header and at least one data row')
    header = lines[0].split(',')
    if name not in header:
        raise KeyError(f'unknown column {name}')
    col = header.index(name)
    total = 0
    for line in lines[1:]:
        parts = line.split(',')
        if len(parts) != len(header):
            raise ValueError('data row has the wrong number of columns')
        try:
            value = float(parts[col])
        except ValueError:
            raise ValueError(f'column {name} has a non-numeric value')
        total += value
    return total

# tests
csv = 'id,name,price\n1,apple,10\n2,banana,5\n3,orange,7'
assert sum_column(csv, 'price') == 22
try:
    sum_column(csv, 'weight')
except KeyError:
    print('unknown column caught')

try:
    sum_column(csv, 'price')
    print('sum ok')
except ValueError:
    print('csv error')

print('sum_column OK')