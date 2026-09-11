# Reference solution (final state of chain s4) - used only to prove checks-F.mjs can pass.
import re

HEADING = re.compile(r"^(#{1,3}) (.*)$")
OL_ITEM = re.compile(r"^\d+\. ")


def _esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _inline(text):
    out = []
    for i, part in enumerate(re.split(r"(`[^`]*`)", text)):
        if i % 2 == 1:
            out.append("<code>" + _esc(part[1:-1]) + "</code>")
            continue
        s = _esc(part)
        s = re.sub(r"\[([^\]]*)\]\(([^)\s]*)\)",
                   lambda m: '<a href="%s">%s</a>' % (m.group(2).replace('"', "&quot;"), m.group(1)), s)
        s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"\*(.+?)\*", r"<em>\1</em>", s)
        out.append(s)
    return "".join(out)


def to_html(text):
    lines = text.split("\n")
    blocks, para = [], []

    def flush():
        if para:
            blocks.append("<p>" + _inline(" ".join(l.strip() for l in para)) + "</p>")
            para.clear()

    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            flush()
            j, body = i + 1, []
            while j < len(lines) and not lines[j].startswith("```"):
                body.append(lines[j])
                j += 1
            blocks.append("<pre><code>" + _esc("\n".join(body)) + "</code></pre>")
            i = j + 1
            continue
        if not line.strip():
            flush()
            i += 1
            continue
        m = HEADING.match(line)
        if m:
            flush()
            level = len(m.group(1))
            blocks.append("<h%d>%s</h%d>" % (level, _inline(m.group(2).strip()), level))
            i += 1
            continue
        if line.startswith("- "):
            flush()
            items = []
            while i < len(lines) and lines[i].startswith("- "):
                items.append("<li>" + _inline(lines[i][2:].strip()) + "</li>")
                i += 1
            blocks.append("<ul>" + "".join(items) + "</ul>")
            continue
        if OL_ITEM.match(line):
            flush()
            items = []
            while i < len(lines) and OL_ITEM.match(lines[i]):
                items.append("<li>" + _inline(OL_ITEM.sub("", lines[i]).strip()) + "</li>")
                i += 1
            blocks.append("<ol>" + "".join(items) + "</ol>")
            continue
        if line.startswith("> "):
            flush()
            inner = []
            while i < len(lines) and lines[i].startswith("> "):
                inner.append(lines[i][2:])
                i += 1
            blocks.append("<blockquote>" + to_html("\n".join(inner)) + "</blockquote>")
            continue
        para.append(line)
        i += 1
    flush()
    return "\n".join(blocks)


def toc(text):
    out, seen, in_code = [], {}, False
    for line in text.split("\n"):
        if line.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        m = HEADING.match(line)
        if not m:
            continue
        title = m.group(2).strip()
        base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
        seen[base] = seen.get(base, 0) + 1
        out.append((len(m.group(1)), title, base if seen[base] == 1 else "%s-%d" % (base, seen[base])))
    return out


if __name__ == "__main__":
    assert to_html("a\nb\n\nc") == "<p>a b</p>\n<p>c</p>"
    assert to_html("# Hi") == "<h1>Hi</h1>"
    assert to_html("**x** and *y*") == "<p><strong>x</strong> and <em>y</em></p>"
    assert toc("# A\n## A") == [(1, "A", "a"), (2, "A", "a-2")]
