# CANONICAL REFERENCE - cumulative correct state after setH goals 4, 14, 24, 34.
# Goal 44 (links) and goal 54 (unordered lists) are HELD OUT and deliberately not implemented.
#
#   goal  4  blank-line separated blocks -> <p>...</p>, inner lines joined with one space,
#            blocks joined with "\n"; & < > escaped
#   goal 14  a line starting with 1-3 '#' and a space -> <h1>/<h2>/<h3>, always its own block
#   goal 24  **text** -> <strong>, *text* -> <em>; unpaired markers stay literal
#   goal 34  `code` -> <code>, escaped, and * / ** inside it are NOT emphasis
#
# Inline code is extracted to placeholders BEFORE emphasis runs, so markers inside code survive.
import re

_CODE = "\x00CODE%d\x00"


def _escape(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _inline(text):
    # 1. pull out `code` spans first so emphasis cannot reach inside them
    codes = []

    def take(m):
        codes.append("<code>" + _escape(m.group(1)) + "</code>")
        return _CODE % (len(codes) - 1)

    text = re.sub(r"`([^`]*)`", take, text)

    # 2. escape everything else
    text = _escape(text)

    # 3. emphasis - strong first so ** is not eaten by the single-* rule
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", text)

    # 4. put the code spans back
    for i, c in enumerate(codes):
        text = text.replace(_CODE % i, c)
    return text


def _is_heading(line):
    m = re.match(r"^(#{1,3}) (.*)$", line)
    return (len(m.group(1)), m.group(2)) if m else None


def to_html(text):
    blocks = []
    current = []

    def flush():
        if current:
            blocks.append("<p>" + _inline(" ".join(current)) + "</p>")
            del current[:]

    for line in str(text).split("\n"):
        if line.strip() == "":
            flush()
            continue
        h = _is_heading(line)
        if h:
            flush()
            level, body = h
            blocks.append("<h%d>%s</h%d>" % (level, _inline(body), level))
            continue
        current.append(line.strip())
    flush()
    return "\n".join(blocks)


if __name__ == "__main__":
    assert to_html("a\nb") == "<p>a b</p>"
    assert to_html("a\n\nb") == "<p>a</p>\n<p>b</p>"
    assert to_html("1 < 2 & 3 > 0") == "<p>1 &lt; 2 &amp; 3 &gt; 0</p>"
    assert to_html("# Title") == "<h1>Title</h1>"
    assert to_html("x\n## Sub\ny") == "<p>x</p>\n<h2>Sub</h2>\n<p>y</p>"
    assert to_html("**b** and *i*") == "<p><strong>b</strong> and <em>i</em></p>"
    assert to_html("a * b") == "<p>a * b</p>"
    assert to_html("`a*b*c`") == "<p><code>a*b*c</code></p>"
    print("ok")
