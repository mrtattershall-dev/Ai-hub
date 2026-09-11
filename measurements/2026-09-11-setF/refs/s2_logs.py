# Reference solution (final state of chain s2) - used only to prove checks-F.mjs can pass.
import math
import re
import sys
from datetime import datetime

LINE = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) (\d+|-)(?: (\d+(?:\.\d+)?))?$')
MONTHS = {m: i + 1 for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split())}


def parse_line(line):
    m = LINE.match(line.strip())
    if not m:
        raise ValueError("not an access-log line: " + line[:60])
    ip, time, method, path, status, size, secs = m.groups()
    return {"ip": ip, "time": time, "method": method, "path": path, "status": int(status),
            "bytes": 0 if size == "-" else int(size), "seconds": float(secs) if secs is not None else None}


def parse_log(text):
    out = []
    for line in text.splitlines():
        if not line.strip():
            continue
        try:
            out.append(parse_line(line))
        except ValueError:
            pass
    return out


def bad_lines(text):
    bad = []
    for i, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            parse_line(line)
        except ValueError:
            bad.append(i)
    return bad


def status_counts(entries):
    out = {}
    for e in entries:
        out[e["status"]] = out.get(e["status"], 0) + 1
    return out


def error_rate(entries):
    if not entries:
        return 0.0
    return round(sum(1 for e in entries if e["status"] >= 500) / len(entries), 4)


def top_paths(entries, n=3):
    counts = {}
    for e in entries:
        p = e["path"].split("?", 1)[0]
        counts[p] = counts.get(p, 0) + 1
    return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:n]


def percentile(entries, p):
    vals = sorted(e["seconds"] for e in entries if e.get("seconds") is not None)
    if isinstance(p, bool) or not isinstance(p, (int, float)) or not 0 < p <= 100 or not vals:
        raise ValueError("need 0 < p <= 100 and at least one value")
    return vals[max(1, math.ceil(p * len(vals) / 100)) - 1]


def _ts(field):
    # '10/Oct/2023:13:55:36 +0000' -> '2023-10-10 13:55:36'
    day, mon, rest = field.split("/", 2)
    year, hh, mm, ss = rest.split(" ")[0].split(":")
    return "%s-%02d-%02d %s:%s:%s" % (year, MONTHS[mon], int(day), hh, mm, ss)


def by_hour(entries):
    out = {}
    for e in entries:
        k = _ts(e["time"])[:13]
        out[k] = out.get(k, 0) + e["bytes"]
    return out


def between(entries, start, end):
    return [e for e in entries if start <= _ts(e["time"]) < end]


def sessions(entries, gap_minutes=30):
    by_ip = {}
    for e in entries:
        by_ip.setdefault(e["ip"], []).append(datetime.strptime(_ts(e["time"]), "%Y-%m-%d %H:%M:%S"))
    out = {}
    for ip, times in by_ip.items():
        times.sort()
        n = 1
        for a, b in zip(times, times[1:]):
            if (b - a).total_seconds() > gap_minutes * 60:
                n += 1
        out[ip] = n
    return out


def main(args):
    top = 3
    if "--top" in args:
        i = args.index("--top")
        top = int(args[i + 1])
        args = args[:i] + args[i + 2:]
    with open(args[0], encoding="utf-8") as fh:
        entries = parse_log(fh.read())
    print("requests: %d" % len(entries))
    print("errors: %d" % sum(1 for e in entries if e["status"] >= 500))
    for path, count in top_paths(entries, top):
        print("%s %d" % (path, count))


if __name__ == "__main__":
    if len(sys.argv) > 1:
        main(sys.argv[1:])
    else:
        e = parse_line('127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045')
        assert e["status"] == 200 and e["bytes"] == 2326 and e["path"] == "/index.html"
        assert parse_line('::1 - - [10/Oct/2023:13:55:36 +0000] "GET / HTTP/1.1" 404 -')["seconds"] is None
        assert percentile([{"seconds": s} for s in (1, 2, 3, 4)], 50) == 2
