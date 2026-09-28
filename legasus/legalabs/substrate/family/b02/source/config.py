def parse_config(text):
    result = {}
    for raw in str(text).split("\n"):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, value = line.split("=", 1)
            result[key.strip()] = value.strip()
    return result
