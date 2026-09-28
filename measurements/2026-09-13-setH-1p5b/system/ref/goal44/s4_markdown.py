# POSITIVE WITNESS for probe goal44.links - the canonical seed plus goal 44 and nothing else.
# Used only to prove the probe accepts a correct implementation. Never shown to the model.
import re

_CODE = "\x00CODE%d\x00"
_LINK = "\x00LINK%d\x00"


def _escape(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _inline(text):
    codes = []
    links = []

    def take_code(m):
        codes.append("<code>" + _escape(m.group(1)) + "</code>")
        return _CODE % (len(codes) - 1)

    text = re.sub(r"`([^`]*)`", take_code, text)

    # goal 44: [text](url) -> <a href="url">text</a>, a double quote in the url written as &quot;
    def take_link(m):
        label = _escape(m.group(1))
        url = _escape(m.group(2)).replace('"', "&quot;")
        links.append('<a href="' + url + '">' + label + "</a>")
        return _LINK % (len(links) - 1)

    text = re.sub(r"\[([^\]]*)\]\(([^)]*)\)", take_link, text)

    text = _escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", text)

    for i, c in enumerate(codes):
        text = text.replace(_CODE % i, c)
    for i, a in enumerate(links):
        text = text.replace(_LINK % i, a)
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
