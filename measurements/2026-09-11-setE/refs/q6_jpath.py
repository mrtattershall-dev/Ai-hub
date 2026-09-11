# Reference solution (final state of chain q6) - used only to prove checks-E.mjs can pass.
import copy

_MISSING = object()


class _Many(list):
    pass


def _segs(path):
    if isinstance(path, (list, tuple)):
        return list(path)
    return [] if path == "" else str(path).split(".")


def _step(cur, seg):
    if isinstance(cur, list):
        i = int(seg)
        if i < 0 or i >= len(cur):
            raise IndexError(seg)
        return cur[i]
    if isinstance(cur, dict):
        if seg in cur:
            return cur[seg]
        if not isinstance(seg, str) and str(seg) in cur:
            return cur[str(seg)]
    raise KeyError(seg)


def _get(data, segs):
    if not segs:
        return data
    s, rest = segs[0], segs[1:]
    if s == "*":
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = list(data.values())
        else:
            raise KeyError(s)
        out = _Many()
        for it in items:
            try:
                r = _get(it, rest)
            except (KeyError, IndexError, ValueError, TypeError):
                continue
            if isinstance(r, _Many):
                out.extend(r)
            else:
                out.append(r)
        return out
    return _get(_step(data, s), rest)


def get(data, path, default=_MISSING):
    try:
        r = _get(data, _segs(path))
    except (KeyError, IndexError, ValueError, TypeError):
        if default is not _MISSING:
            return default
        raise KeyError(f"path not found: {path}")
    return list(r) if isinstance(r, _Many) else r


def set_path(data, path, value):
    segs = _segs(path)
    cur = data
    for s in segs[:-1]:
        if isinstance(cur, list):
            i = int(s)
            if i < 0 or i >= len(cur):
                raise IndexError(f"index {s} out of range in {path}")
            cur = cur[i]
        else:
            if s not in cur:
                cur[s] = {}
            cur = cur[s]
    last = segs[-1]
    if isinstance(cur, list):
        i = int(last)
        if i < 0 or i >= len(cur):
            raise IndexError(f"index {last} out of range in {path}")
        cur[i] = value
    else:
        cur[last] = value


def delete(data, path):
    segs = _segs(path)
    try:
        parent = _get(data, segs[:-1])
    except (KeyError, IndexError, ValueError, TypeError):
        raise KeyError(f"path not found: {path}")
    last = segs[-1]
    if isinstance(parent, list):
        try:
            i = int(last)
        except ValueError:
            raise KeyError(f"path not found: {path}")
        if i < 0 or i >= len(parent):
            raise KeyError(f"path not found: {path}")
        return parent.pop(i)
    if isinstance(parent, dict) and last in parent:
        return parent.pop(last)
    raise KeyError(f"path not found: {path}")


def _leaves(data, prefix=()):
    if isinstance(data, dict):
        for k, v in data.items():
            yield from _leaves(v, prefix + (str(k),))
    elif isinstance(data, list):
        for i, v in enumerate(data):
            yield from _leaves(v, prefix + (str(i),))
    else:
        yield ".".join(prefix), data


def find(data, predicate):
    return sorted(p for p, v in _leaves(data) if predicate(v))


def flatten(data):
    return dict(_leaves(data))


def unflatten(flat):
    root = {}
    for path, v in flat.items():
        parts = path.split(".")
        cur = root
        for p in parts[:-1]:
            cur = cur.setdefault(p, {})
        cur[parts[-1]] = v

    def fix(x):
        if isinstance(x, dict):
            x = {k: fix(v) for k, v in x.items()}
            if x and all(k.isdigit() for k in x) and sorted(int(k) for k in x) == list(range(len(x))):
                return [x[str(i)] for i in range(len(x))]
        return x

    return fix(root)


def diff(a, b):
    fa, fb = flatten(a), flatten(b)
    out = []
    for k in sorted(set(fa) | set(fb)):
        if k in fa and k in fb:
            if fa[k] != fb[k]:
                out.append((k, fa[k], fb[k]))
        elif k in fa:
            out.append((k, fa[k], None))
        else:
            out.append((k, None, fb[k]))
    return out


def merge(a, b):
    out = copy.deepcopy(a)
    for k, v in b.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out
