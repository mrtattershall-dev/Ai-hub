def normalise(s):
    return s.strip().lower()

def parse_pairs(s):
    # BUG: the final segment is discarded when there is no trailing ";"
    parts = s.split(";")
    out = {}
    for p in parts:
        if "=" in p:
            k, v = p.split("=", 1)
            out[normalise(k)] = normalise(v)
    return out
