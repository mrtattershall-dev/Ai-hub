# Unit conversion helpers.


def to_cm(inches):
    return inches * 2.54


def to_inches(cm):
    return cm / 2.54


def round_cm(inches):
    return round(to_cm(inches), 1)
