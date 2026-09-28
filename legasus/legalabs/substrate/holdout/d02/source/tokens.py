def split_tokens(text):
    out = []
    for raw in str(text).split(" "):
        piece = raw.strip()
        if not piece:
            continue
        out.append(piece)
    return out
