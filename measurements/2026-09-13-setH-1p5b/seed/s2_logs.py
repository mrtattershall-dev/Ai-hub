# CANONICAL REFERENCE - cumulative correct state after setH goals 2, 12, 22, 32.
# Goal 42 (percentile) and goal 52 (by_hour) are HELD OUT and deliberately not implemented.
#
#   goal  2  parse_line(line) -> dict(ip, time, method, path, status, bytes, seconds);
#            ValueError for a line that does not have that shape; "-" bytes means 0
#   goal 12  parse_log(text), bad_lines(text) - 1-based line numbers of non-blank malformed lines
#   goal 22  status_counts(entries), error_rate(entries) - fraction >= 500, rounded to 4 dp
#   goal 32  top_paths(entries, n=3) - most requested first, ties by path, query string stripped
import re

_LINE = re.compile(
    r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) [^"]*" (\d+) (\d+|-) (\d+(?:\.\d+)?)\s*$'
)


def parse_line(line):
    m = _LINE.match(str(line))
    if not m:
        raise ValueError("line does not have the expected shape")
    ip, time, method, path, status, nbytes, seconds = m.groups()
    return {
        "ip": ip,
        "time": time,
        "method": method,
        "path": path,
        "status": int(status),
        "bytes": 0 if nbytes == "-" else int(nbytes),
        "seconds": float(seconds),
    }


def parse_log(text):
    out = []
    for line in str(text).split("\n"):
        if line.strip() == "":
            continue
        try:
            out.append(parse_line(line))
        except ValueError:
            continue
    return out


def bad_lines(text):
    out = []
    for i, line in enumerate(str(text).split("\n"), start=1):
        if line.strip() == "":
            continue
        try:
            parse_line(line)
        except ValueError:
            out.append(i)
    return out


def status_counts(entries):
    counts = {}
    for e in entries:
        counts[e["status"]] = counts.get(e["status"], 0) + 1
    return counts


def error_rate(entries):
    if not entries:
        return 0.0
    bad = sum(1 for e in entries if e["status"] >= 500)
    return round(bad / len(entries), 4)


def top_paths(entries, n=3):
    counts = {}
    for e in entries:
        path = e["path"].split("?")[0]
        counts[path] = counts.get(path, 0) + 1
    ordered = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return ordered[:n]


if __name__ == "__main__":
    L = '127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 0.045'
    d = parse_line(L)
    assert d["ip"] == "127.0.0.1"
    assert d["time"] == "10/Oct/2023:13:55:36 +0000"
    assert d["method"] == "GET" and d["path"] == "/index.html"
    assert d["status"] == 200 and d["bytes"] == 2326 and d["seconds"] == 0.045
    try:
        parse_line("nope")
        raise AssertionError("expected ValueError")
    except ValueError:
        pass
    text = L + "\n\nnot a log line\n" + L
    assert len(parse_log(text)) == 2
    assert bad_lines(text) == [3]
    entries = parse_log(text)
    assert status_counts(entries) == {200: 2}
    assert error_rate(entries) == 0.0
    assert top_paths(entries) == [("/index.html", 2)]
    print("ok")
