# Reference solution (final state of chain q2) - used only to prove checks-E.mjs can pass.
import csv
import io
import operator
import sys
from collections import Counter


def parse_csv(text):
    if not text.strip():
        return []
    rows = list(csv.reader(io.StringIO(text)))
    headers = rows[0]
    return [dict(zip(headers, r)) for r in rows[1:] if r]


def to_csv(rows, headers=None):
    if headers is None:
        headers = list(rows[0].keys()) if rows else []
    out = io.StringIO()
    w = csv.writer(out, lineterminator="\n")
    w.writerow(headers)
    for r in rows:
        w.writerow([r.get(h, "") for h in headers])
    return out.getvalue().rstrip("\n")


def select(rows, columns):
    out = []
    for r in rows:
        for c in columns:
            if c not in r:
                raise KeyError(c)
        out.append({c: r[c] for c in columns})
    return out


def _num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


OPS = {"=": operator.eq, "!=": operator.ne, "<": operator.lt, ">": operator.gt, "<=": operator.le, ">=": operator.ge}


def where(rows, column, op, value):
    if op not in OPS:
        raise ValueError(f"unknown op {op!r}")
    f, out = OPS[op], []
    for r in rows:
        a, b = r[column], value
        na, nb = _num(a), _num(b)
        if na is not None and nb is not None:
            a, b = na, nb
        else:
            a, b = str(a), str(b)
        if f(a, b):
            out.append(r)
    return out


def order_by(rows, column, descending=False):
    numeric = all(_num(r[column]) is not None for r in rows)
    key = (lambda r: _num(r[column])) if numeric else (lambda r: str(r[column]))
    return sorted(rows, key=key, reverse=descending)


def group_count(rows, column):
    return dict(Counter(r[column] for r in rows))


def aggregate(rows, group_col, value_col, fn):
    if fn not in ("sum", "avg", "min", "max"):
        raise ValueError(f"unknown fn {fn!r}")
    groups = {}
    for r in rows:
        groups.setdefault(r[group_col], []).append(float(r[value_col]))
    out = {}
    for g, vs in groups.items():
        out[g] = {"sum": sum(vs), "avg": round(sum(vs) / len(vs), 2), "min": min(vs), "max": max(vs)}[fn]
    return out


def join(left, right, on):
    out = []
    for l in left:
        for r in right:
            if r[on] == l[on]:
                row = dict(l)
                for k, v in r.items():
                    if k == on:
                        continue
                    row["right_" + k if k in l else k] = v
                out.append(row)
    return out


def pivot(rows, index, column, value):
    out = {}
    for r in rows:
        d = out.setdefault(r[index], {})
        if r[column] in d:
            raise ValueError(f"repeated ({r[index]!r}, {r[column]!r})")
        d[r[column]] = r[value]
    return out


def main(argv):
    path = argv[0]
    wh, sel = None, None
    i = 1
    while i < len(argv):
        if argv[i] == "--where":
            wh = argv[i + 1]; i += 2
        elif argv[i] == "--select":
            sel = argv[i + 1].split(","); i += 2
        else:
            i += 1
    with open(path, encoding="utf-8") as f:
        rows = parse_csv(f.read())
    if wh:
        col, val = wh.split("=", 1)
        rows = where(rows, col, "=", val)
    if sel:
        rows = select(rows, sel)
    print(to_csv(rows, sel))


if __name__ == "__main__":
    if len(sys.argv) >= 2:
        main(sys.argv[1:])
